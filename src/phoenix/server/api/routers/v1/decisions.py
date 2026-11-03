"""Manage saved decisions, decision versions, and version tags over REST.

The routes mirror ``/v1/prompts``: a decision is addressed by its GlobalID or its name, a
version by its GlobalID, and a tag by its name within the version's decision. Errors are
RFC 9457 problem details.
"""

from typing import Any, Optional, Sequence, Union

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field, ValidationError, model_validator
from sqlalchemy import String, and_, cast, delete, func, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.orm.exc import StaleDataError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.decision_version_tags import (
    set_decision_version_tag,
    upsert_decision_version_tag,
)
from phoenix.server.api.routers.v1.decision_models import (
    Decision,
    DecisionData,
    DecisionVersion,
    DecisionVersionData,
    DecisionVersionTag,
    DecisionVersionTagData,
    encode_custom_provider_id,
    encode_decision_id,
    encode_decision_version_id,
    encode_decision_version_tag_id,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import (
    ProblemDetailsRoute,
    ProblemException,
    invalid_field,
    problem_responses,
)
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    Responses,
    location_of,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.decisions.validation import validate_decision_custom_provider
from phoenix.server.decisions.versions import InvalidDecisionVersion, clone_decision

_IntegrityError = (PostgreSQLIntegrityError, SQLiteIntegrityError)

router = APIRouter(tags=["decisions"], route_class=ProblemDetailsRoute)


def _errors(status_codes: list[int]) -> Responses:
    """Every error body on this router is problem details, 403 included (see
    ``evaluator_error_responses``)."""
    return problem_responses([*status_codes, 403])


_DECISION_IDENTIFIER = Path(description="The identifier of the decision: its GlobalID or name.")
_DECISION_VERSION_ID = Path(description="The GlobalID of the decision version.")

_RESPONSE_OPTIONS: dict[str, Any] = dict(
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)


class GetDecisionsResponseBody(PaginatedResponseBody[Decision]):
    pass


class GetDecisionResponseBody(ResponseBody[Decision]):
    pass


class GetDecisionVersionResponseBody(ResponseBody[DecisionVersion]):
    pass


class GetDecisionVersionsResponseBody(PaginatedResponseBody[DecisionVersion]):
    pass


class GetDecisionVersionTagsResponseBody(PaginatedResponseBody[DecisionVersionTag]):
    pass


class CreateDecisionRequestBody(V1RoutesBaseModel):
    decision: DecisionData
    version: DecisionVersionData
    tags: Optional[list[DecisionVersionTagData]] = None


class CreateDecisionResponseBody(ResponseBody[DecisionVersion]):
    pass


class CreateDecisionVersionRequestBody(V1RoutesBaseModel):
    version: DecisionVersionData
    tags: Optional[list[DecisionVersionTagData]] = None


class CreateDecisionVersionResponseBody(ResponseBody[DecisionVersion]):
    pass


class PatchDecisionRequestBody(V1RoutesBaseModel):
    """Fields to update on a decision. Omit a field to leave it unchanged."""

    description: Optional[str] = UNDEFINED
    metadata: dict[str, Any] = UNDEFINED

    @model_validator(mode="after")
    def _validate_patch(self) -> Self:
        if self.description is UNDEFINED and self.metadata is UNDEFINED:
            raise ValueError("at least one field must be provided")
        return self


class PatchDecisionResponseBody(ResponseBody[Decision]):
    pass


class CloneDecisionRequestBody(V1RoutesBaseModel):
    """The new decision's name, and optionally its own description and metadata."""

    name: Identifier = Field(description="The new decision's name. It must not be taken.")
    description: Optional[str] = Field(
        default=UNDEFINED, description="The copy's description. Omit to copy the source's."
    )
    metadata: dict[str, Any] = Field(
        default=UNDEFINED, description="The copy's metadata. Omit to copy the source's."
    )


class CloneDecisionResponseBody(ResponseBody[Decision]):
    pass


# --------------------------------------------------------------------------------------------
# Decisions
# --------------------------------------------------------------------------------------------


@router.get(
    "/decisions",
    operation_id="getDecisions",
    summary="List decisions",
    description="Retrieve a paginated list of saved decisions, newest first, optionally "
    "filtered by name or label. A decision can have multiple versions.",
    response_description="A list of decisions with pagination information",
    responses=_errors([422]),
    **_RESPONSE_OPTIONS,
)
async def list_decisions(
    request: Request,
    cursor: Optional[str] = Query(
        default=None, description="Cursor for pagination (a Decision GlobalID)"
    ),
    limit: int = Query(
        default=100, description="The max number of decisions to return at a time.", gt=0
    ),
    name: Optional[str] = Query(
        default=None,
        description="Only decisions whose name contains this text, ignoring case.",
    ),
    label_id: Optional[list[str]] = Query(
        default=None,
        description="Only decisions with any of these labels (DecisionLabel GlobalIDs). "
        "Repeat the parameter for more than one.",
    ),
) -> GetDecisionsResponseBody:
    stmt = select(models.Decision).order_by(models.Decision.id.desc())
    if name:
        stmt = stmt.where(
            cast(models.Decision.name, String).ilike(f"%{_escape_like(name)}%", escape="\\")
        )
    if label_id:
        label_rowids = [parse_decision_label_id(value) for value in label_id]
        stmt = stmt.where(
            models.Decision.id.in_(
                select(models.DecisionDecisionLabel.decision_id).where(
                    models.DecisionDecisionLabel.decision_label_id.in_(label_rowids)
                )
            )
        )
    if cursor:
        stmt = stmt.where(models.Decision.id <= parse_cursor(cursor, "Decision"))
    async with request.app.state.db() as session:
        decisions = list((await session.scalars(stmt.limit(limit + 1))).all())
    next_cursor = None
    if len(decisions) > limit:
        next_cursor = encode_decision_id(decisions[limit].id)
        decisions = decisions[:limit]
    return GetDecisionsResponseBody(
        data=[Decision.from_orm_decision(decision) for decision in decisions],
        next_cursor=next_cursor,
    )


@router.get(
    "/decisions/{decision_identifier}",
    operation_id="getDecision",
    summary="Get a decision",
    description="Retrieve a decision's name, description, and metadata by GlobalID or name. "
    "Its versions are listed by `GET /v1/decisions/{decision_identifier}/versions`.",
    response_description="The requested decision",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def get_decision(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> GetDecisionResponseBody:
    where_clause = decision_where_clause(decision_identifier)
    async with request.app.state.db() as session:
        decision = await session.scalar(select(models.Decision).where(where_clause))
    if decision is None:
        raise decision_not_found(decision_identifier)
    return GetDecisionResponseBody(data=Decision.from_orm_decision(decision))


@router.post(
    "/decisions",
    dependencies=[Depends(is_not_locked)],
    operation_id="postDecisionVersion",
    summary="Create a decision or add a version",
    description="Create a decision with its initial version. If a decision with "
    "`decision.name` already exists, add the version to it instead; that decision's "
    "description and metadata change only when given. Optional `tags` are set on the new "
    "version, moving any tag of that name from another version of the decision.",
    response_description="The newly created decision version",
    status_code=201,
    responses=_errors([404, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def create_decision(
    request: Request,
    response: Response,
    request_body: CreateDecisionRequestBody,
) -> CreateDecisionResponseBody:
    decision_data = request_body.decision
    user_id = user_id_of(request)
    version = _version_to_orm(request_body.version, user_id=user_id)
    async with request.app.state.db() as session:
        await _validate_custom_provider(session, version)
        decision = await session.scalar(
            select(models.Decision).where(models.Decision.name == decision_data.name)
        )
        created = False
        if decision is None:
            try:
                async with session.begin_nested():
                    decision = models.Decision(
                        name=decision_data.name,
                        description=None
                        if decision_data.description is UNDEFINED
                        else _clean_description(decision_data.description),
                        metadata_={}
                        if decision_data.metadata is UNDEFINED
                        else decision_data.metadata,
                        user_id=user_id,
                    )
                    session.add(decision)
                created = True
            except _IntegrityError:
                # A concurrent request created it first: add the version to that one.
                decision = await session.scalar(
                    select(models.Decision).where(models.Decision.name == decision_data.name)
                )
                if decision is None:
                    raise
        await _insert_version(
            session,
            version,
            decision_id=decision.id,
            decision_identifier=decision_data.name.root,
            update=None if created else (decision, decision_data),
        )
        await _upsert_tags(session, version, request_body.tags, user_id=user_id)
        await session.refresh(version)
        data = await _rest_version(session, version)
    response.headers["Location"] = location_of(request, f"/v1/decision_versions/{data.id}")
    return CreateDecisionResponseBody(data=data)


@router.patch(
    "/decisions/{decision_identifier}",
    dependencies=[Depends(is_not_locked)],
    operation_id="patchDecision",
    summary="Update a decision",
    description="Update a decision's description and/or metadata by GlobalID or name. An "
    "omitted field is left unchanged; a null description clears it, and metadata is "
    "replaced as a whole. At least one field is required.",
    response_description="The updated decision",
    responses=_errors([404, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def patch_decision(
    request: Request,
    request_body: PatchDecisionRequestBody,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> PatchDecisionResponseBody:
    where_clause = decision_where_clause(decision_identifier)
    async with request.app.state.db() as session:
        decision = await session.scalar(select(models.Decision).where(where_clause))
        if decision is None:
            raise decision_not_found(decision_identifier)
        if (description := request_body.description) is not UNDEFINED:
            decision.description = _clean_description(description)
        if (metadata := request_body.metadata) is not UNDEFINED:
            decision.metadata_ = metadata
        await session.flush()
        await session.refresh(decision)
        data = Decision.from_orm_decision(decision)
    return PatchDecisionResponseBody(data=data)


@router.delete(
    "/decisions/{decision_identifier}",
    operation_id="deleteDecision",
    summary="Delete a decision",
    description="Delete a decision with all its versions, tags, and labels, by GlobalID or "
    "name. A decision run by an evaluator is refused with 409; delete the evaluator first. "
    "Experiments that ran a deleted version keep their results.",
    status_code=204,
    responses=_errors([404, 409, 422]),
)
async def delete_decision(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> None:
    where_clause = decision_where_clause(decision_identifier)
    async with request.app.state.db() as session:
        decision_id = await session.scalar(select(models.Decision.id).where(where_clause))
        if decision_id is None:
            raise decision_not_found(decision_identifier)
        evaluator_names = (
            await session.scalars(
                select(models.DecisionEvaluator.name)
                .where(models.DecisionEvaluator.decision_id == decision_id)
                .order_by(models.DecisionEvaluator.name)
            )
        ).all()
        if evaluator_names:
            raise _referenced_by_evaluators([name.root for name in evaluator_names])
        try:
            async with session.begin_nested():
                await session.execute(
                    delete(models.Decision).where(models.Decision.id == decision_id)
                )
        except _IntegrityError as error:
            # An evaluator started referencing the decision after the check above.
            raise _referenced_by_evaluators([]) from error


@router.post(
    "/decisions/{decision_identifier}/clones",
    dependencies=[Depends(is_not_locked)],
    operation_id="cloneDecision",
    summary="Clone a decision",
    description="Create a new decision that copies a decision's version history, by GlobalID "
    "or name. Each copied version keeps its author; tags are not copied. The copy's "
    "`source_decision_id` names the source. A name that is taken is refused with 409.",
    response_description="The new decision",
    status_code=201,
    responses=_errors([404, 409, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def create_decision_clone(
    request: Request,
    response: Response,
    request_body: CloneDecisionRequestBody,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> CloneDecisionResponseBody:
    where_clause = decision_where_clause(decision_identifier)
    async with request.app.state.db() as session:
        source = await session.scalar(select(models.Decision).where(where_clause))
        if source is None:
            raise decision_not_found(decision_identifier)
        try:
            decision = await clone_decision(
                session,
                source,
                name=request_body.name,
                description=source.description
                if request_body.description is UNDEFINED
                else _clean_description(request_body.description),
                metadata=source.metadata_
                if request_body.metadata is UNDEFINED
                else request_body.metadata,
                user_id=user_id_of(request),
            )
        except Conflict as error:
            existing_id = await session.scalar(
                select(models.Decision.id).where(models.Decision.name == request_body.name)
            )
            raise ProblemException(
                409,
                "already_exists",
                str(error),
                existing_id=encode_decision_id(existing_id) if existing_id is not None else None,
            ) from error
        await session.refresh(decision)
        data = Decision.from_orm_decision(decision)
    response.headers["Location"] = location_of(request, f"/v1/decisions/{data.id}")
    return CloneDecisionResponseBody(data=data)


# --------------------------------------------------------------------------------------------
# Decision versions
# --------------------------------------------------------------------------------------------


@router.get(
    "/decisions/{decision_identifier}/versions",
    operation_id="listDecisionVersions",
    summary="List decision versions",
    description="Retrieve a paginated list of a decision's versions, newest first.",
    response_description="A list of decision versions with pagination information",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def list_decision_versions(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
    cursor: Optional[str] = Query(
        default=None, description="Cursor for pagination (a DecisionVersion GlobalID)"
    ),
    limit: int = Query(
        default=100, description="The max number of decision versions to return at a time.", gt=0
    ),
) -> GetDecisionVersionsResponseBody:
    where_clause = decision_where_clause(decision_identifier)
    async with request.app.state.db() as session:
        decision_id = await session.scalar(select(models.Decision.id).where(where_clause))
        if decision_id is None:
            raise decision_not_found(decision_identifier)
        stmt = (
            select(models.DecisionVersion)
            .where(models.DecisionVersion.decision_id == decision_id)
            .order_by(models.DecisionVersion.id.desc())
        )
        if cursor:
            stmt = stmt.where(models.DecisionVersion.id <= parse_cursor(cursor, "DecisionVersion"))
        versions = list((await session.scalars(stmt.limit(limit + 1))).all())
        next_cursor = None
        if len(versions) > limit:
            next_cursor = encode_decision_version_id(versions[limit].id)
            versions = versions[:limit]
        data = await _rest_versions(session, versions)
    return GetDecisionVersionsResponseBody(data=data, next_cursor=next_cursor)


@router.post(
    "/decisions/{decision_identifier}/versions",
    dependencies=[Depends(is_not_locked)],
    operation_id="createDecisionVersion",
    summary="Create a decision version",
    description="Add a version to an existing decision, by GlobalID or name. Optional `tags` "
    "are set on the new version, moving any tag of that name from another version.",
    response_description="The created decision version",
    status_code=201,
    responses=_errors([404, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def create_decision_version(
    request: Request,
    response: Response,
    request_body: CreateDecisionVersionRequestBody,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> CreateDecisionVersionResponseBody:
    where_clause = decision_where_clause(decision_identifier)
    user_id = user_id_of(request)
    version = _version_to_orm(request_body.version, user_id=user_id)
    async with request.app.state.db() as session:
        decision_id = await session.scalar(select(models.Decision.id).where(where_clause))
        if decision_id is None:
            raise decision_not_found(decision_identifier)
        await _validate_custom_provider(session, version)
        await _insert_version(
            session, version, decision_id=decision_id, decision_identifier=decision_identifier
        )
        await _upsert_tags(session, version, request_body.tags, user_id=user_id)
        await session.refresh(version)
        data = await _rest_version(session, version)
    response.headers["Location"] = location_of(request, f"/v1/decision_versions/{data.id}")
    return CreateDecisionVersionResponseBody(data=data)


@router.get(
    "/decisions/{decision_identifier}/latest",
    operation_id="getDecisionVersionLatest",
    summary="Get the latest decision version",
    description="Retrieve the most recent version of a decision, by GlobalID or name.",
    response_description="The latest version of the decision",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def get_decision_version_latest(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> GetDecisionVersionResponseBody:
    stmt = (
        select(models.DecisionVersion)
        .join(models.Decision)
        .where(decision_where_clause(decision_identifier))
        .order_by(models.DecisionVersion.id.desc())
        .limit(1)
    )
    async with request.app.state.db() as session:
        version = await session.scalar(stmt)
        if version is None:
            raise decision_not_found(decision_identifier)
        data = await _rest_version(session, version)
    return GetDecisionVersionResponseBody(data=data)


@router.get(
    "/decisions/{decision_identifier}/tags/{tag_name}",
    operation_id="getDecisionVersionByTagName",
    summary="Get a decision version by tag",
    description="Retrieve the version of a decision that a tag, such as `production`, points to.",
    response_description="The decision version the tag points to",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def get_decision_version_by_tag_name(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
    tag_name: str = Path(description="The name of the tag."),
) -> GetDecisionVersionResponseBody:
    name = _parse_tag_name(tag_name)
    stmt = (
        select(models.DecisionVersion)
        .join(
            models.DecisionVersionTag,
            models.DecisionVersionTag.decision_version_id == models.DecisionVersion.id,
        )
        .join(models.Decision, models.Decision.id == models.DecisionVersion.decision_id)
        .where(models.DecisionVersionTag.name == name)
        .where(decision_where_clause(decision_identifier))
    )
    async with request.app.state.db() as session:
        version = await session.scalar(stmt)
        if version is None:
            raise HTTPException(
                404, f"No version of decision '{decision_identifier}' is tagged '{tag_name}'"
            )
        data = await _rest_version(session, version)
    return GetDecisionVersionResponseBody(data=data)


@router.get(
    "/decision_versions/{decision_version_id}",
    operation_id="getDecisionVersionByDecisionVersionId",
    summary="Get a decision version by ID",
    description="Retrieve a specific decision version by its GlobalID.",
    response_description="The requested decision version",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def get_decision_version_by_decision_version_id(
    request: Request,
    decision_version_id: str = _DECISION_VERSION_ID,
) -> GetDecisionVersionResponseBody:
    id_ = _parse_decision_version_id(decision_version_id)
    async with request.app.state.db() as session:
        version = await session.get(models.DecisionVersion, id_)
        if version is None:
            raise _decision_version_not_found(decision_version_id)
        data = await _rest_version(session, version)
    return GetDecisionVersionResponseBody(data=data)


# --------------------------------------------------------------------------------------------
# Decision version tags
# --------------------------------------------------------------------------------------------


@router.get(
    "/decision_versions/{decision_version_id}/tags",
    operation_id="getDecisionVersionTags",
    summary="List decision version tags",
    description="Retrieve a paginated list of the tags that point to a decision version.",
    response_description="A list of the version's tags with pagination information",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def list_decision_version_tags(
    request: Request,
    decision_version_id: str = _DECISION_VERSION_ID,
    cursor: Optional[str] = Query(
        default=None, description="Cursor for pagination (a DecisionVersionTag GlobalID)"
    ),
    limit: int = Query(
        default=100, description="The max number of tags to return at a time.", gt=0
    ),
) -> GetDecisionVersionTagsResponseBody:
    id_ = _parse_decision_version_id(decision_version_id)
    stmt = (
        select(models.DecisionVersionTag)
        .where(models.DecisionVersionTag.decision_version_id == id_)
        .order_by(models.DecisionVersionTag.id.desc())
    )
    if cursor:
        stmt = stmt.where(
            models.DecisionVersionTag.id <= parse_cursor(cursor, "DecisionVersionTag")
        )
    async with request.app.state.db() as session:
        exists = await session.scalar(
            select(models.DecisionVersion.id).where(models.DecisionVersion.id == id_)
        )
        if exists is None:
            raise _decision_version_not_found(decision_version_id)
        tags = list((await session.scalars(stmt.limit(limit + 1))).all())
    next_cursor = None
    if len(tags) > limit:
        next_cursor = encode_decision_version_tag_id(tags[limit].id)
        tags = tags[:limit]
    return GetDecisionVersionTagsResponseBody(
        data=[DecisionVersionTag.from_orm_decision_version_tag(tag) for tag in tags],
        next_cursor=next_cursor,
    )


class CreateDecisionVersionTagResponseBody(ResponseBody[DecisionVersionTag]):
    pass


@router.post(
    "/decision_versions/{decision_version_id}/tags",
    dependencies=[Depends(is_not_locked)],
    operation_id="createDecisionVersionTag",
    summary="Tag a decision version",
    description="Point a tag at a decision version. Tag names are unique within a decision: "
    "if the version's decision already has a tag of this name, it moves to this version "
    "and keeps its description unless a new one is given. Returns 201 with the tag when "
    "it was created, or 200 when an existing tag moved.",
    response_description="The tag was created",
    status_code=201,
    responses={
        200: {
            "description": "An existing tag moved to this version",
            "model": CreateDecisionVersionTagResponseBody,
        },
        **_errors([404, 422, 507]),
    },
    **_RESPONSE_OPTIONS,
)
async def create_decision_version_tag(
    request: Request,
    response: Response,
    request_body: DecisionVersionTagData,
    decision_version_id: str = _DECISION_VERSION_ID,
) -> CreateDecisionVersionTagResponseBody:
    id_ = _parse_decision_version_id(decision_version_id)
    async with request.app.state.db() as session:
        decision_id = await session.scalar(
            select(models.DecisionVersion.decision_id).where(models.DecisionVersion.id == id_)
        )
        if decision_id is None:
            raise _decision_version_not_found(decision_version_id)
        tag, created = await set_decision_version_tag(
            session,
            decision_id=decision_id,
            decision_version_id=id_,
            name=request_body.name,
            description=request_body.description,
            user_id=user_id_of(request),
        )
        data = DecisionVersionTag.from_orm_decision_version_tag(tag)
    if created:
        response.headers["Location"] = location_of(
            request, f"/v1/decisions/{encode_decision_id(decision_id)}/tags/{tag.name.root}"
        )
    else:
        response.status_code = 200
    return CreateDecisionVersionTagResponseBody(data=data)


@router.delete(
    "/decision_versions/{decision_version_id}/tags/{tag_name}",
    operation_id="deleteDecisionVersionTag",
    summary="Delete a decision version tag",
    description="Delete a tag by name. The tag is resolved within the decision of the given "
    "version.",
    status_code=204,
    responses=_errors([404, 422]),
)
async def delete_decision_version_tag(
    request: Request,
    decision_version_id: str = _DECISION_VERSION_ID,
    tag_name: str = Path(description="The name of the tag to delete."),
) -> None:
    id_ = _parse_decision_version_id(decision_version_id)
    name = _parse_tag_name(tag_name)
    async with request.app.state.db() as session:
        decision_id = await session.scalar(
            select(models.DecisionVersion.decision_id).where(models.DecisionVersion.id == id_)
        )
        if decision_id is None:
            raise _decision_version_not_found(decision_version_id)
        deleted_id = await session.scalar(
            delete(models.DecisionVersionTag)
            .where(models.DecisionVersionTag.decision_id == decision_id)
            .where(models.DecisionVersionTag.name == name)
            .returning(models.DecisionVersionTag.id)
        )
    if deleted_id is None:
        raise HTTPException(404, f"Decision version tag not found: {tag_name}")


# --------------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------------


class _DecisionId(int): ...


_DecisionIdentifier: TypeAlias = Union[_DecisionId, Identifier]


def parse_decision_identifier(decision_identifier: str) -> _DecisionIdentifier:
    try:
        return _DecisionId(
            from_global_id_with_expected_type(GlobalID.from_id(decision_identifier), "Decision")
        )
    except ValueError:
        pass
    try:
        return Identifier.model_validate(decision_identifier)
    except ValidationError:
        raise HTTPException(422, f"Invalid decision identifier: {decision_identifier}")


def decision_where_clause(decision_identifier: str) -> Any:
    identifier = parse_decision_identifier(decision_identifier)
    if isinstance(identifier, _DecisionId):
        return models.Decision.id == int(identifier)
    if isinstance(identifier, Identifier):
        return models.Decision.name == identifier
    assert_never(identifier)


def _parse_decision_version_id(decision_version_id: str) -> int:
    try:
        return from_global_id_with_expected_type(
            GlobalID.from_id(decision_version_id), "DecisionVersion"
        )
    except ValueError:
        raise HTTPException(422, f"Invalid decision version ID: {decision_version_id}")


def _parse_tag_name(tag_name: str) -> Identifier:
    try:
        return Identifier.model_validate(tag_name)
    except ValidationError:
        raise HTTPException(422, f"Invalid tag name: {tag_name}")


def parse_cursor(cursor: str, type_name: str) -> int:
    try:
        return from_global_id_with_expected_type(GlobalID.from_id(cursor), type_name)
    except ValueError:
        raise HTTPException(422, f"Invalid cursor format: {cursor}")


def decision_not_found(decision_identifier: str) -> HTTPException:
    return HTTPException(404, f"Decision not found: {decision_identifier}")


def _decision_version_not_found(decision_version_id: str) -> HTTPException:
    return HTTPException(404, f"Decision version not found: {decision_version_id}")


def _referenced_by_evaluators(evaluator_names: list[str]) -> ProblemException:
    if not evaluator_names:
        detail = "This decision is referenced by an evaluator; delete it first"
    else:
        noun, pronoun = (
            ("an evaluator", "it") if len(evaluator_names) == 1 else ("evaluators", "them")
        )
        detail = (
            f"This decision is referenced by {noun} ({', '.join(evaluator_names)}); "
            f"delete {pronoun} first"
        )
    return ProblemException(409, "conflict", detail, reason="referenced_by_evaluator")


def user_id_of(request: Request) -> Optional[int]:
    if request.app.state.authentication_enabled:
        assert isinstance(user := request.user, PhoenixUser)
        return int(user.identity)
    return None


def _version_to_orm(
    version: DecisionVersionData, *, user_id: Optional[int]
) -> models.DecisionVersion:
    try:
        return version.to_orm(user_id=user_id)
    except InvalidDecisionVersion as error:
        raise invalid_field(str(error), ("body", "version", *error.path), error.code) from error
    except BadRequest as error:
        raise HTTPException(422, str(error)) from error


def _apply_decision_fields(decision: models.Decision, data: DecisionData) -> None:
    if data.description is not UNDEFINED:
        decision.description = _clean_description(data.description)
    if data.metadata is not UNDEFINED:
        decision.metadata_ = data.metadata


async def _upsert_tags(
    session: AsyncSession,
    version: models.DecisionVersion,
    tags: Optional[list[DecisionVersionTagData]],
    *,
    user_id: Optional[int],
) -> None:
    for tag in tags or ():
        await upsert_decision_version_tag(
            session,
            decision_id=version.decision_id,
            decision_version_id=version.id,
            name=tag.name,
            description=tag.description,
            user_id=user_id,
        )


async def _validate_custom_provider(session: AsyncSession, version: models.DecisionVersion) -> None:
    """Map the shared provider check to REST codes: 404 missing, 422 incompatible."""
    try:
        await validate_decision_custom_provider(session, version)
    except NotFound as error:
        raise HTTPException(404, str(error)) from error
    except BadRequest as error:
        raise invalid_field(str(error), ("body", "version", "custom_provider_id")) from error


def _clean_description(description: Optional[str]) -> Optional[str]:
    """Descriptions are stored trimmed, whichever route writes them."""
    return description.strip() if description is not None else None


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def parse_decision_label_id(decision_label_id: str) -> int:
    try:
        return from_global_id_with_expected_type(
            GlobalID.from_id(decision_label_id), "DecisionLabel"
        )
    except ValueError:
        raise HTTPException(422, f"Invalid decision label ID: {decision_label_id}")


async def _insert_version(
    session: AsyncSession,
    version: models.DecisionVersion,
    *,
    decision_id: int,
    decision_identifier: str,
    update: Optional[tuple[models.Decision, DecisionData]] = None,
) -> None:
    """Insert the version, and apply `update` to its existing decision, in one savepoint.

    The decision, or the version's custom provider, can be deleted between the checks
    above and this write. Either fails the write; the 404 says which one is gone. The
    changes are made inside the savepoint because opening one flushes pending changes.
    """
    try:
        async with session.begin_nested():
            if update is not None:
                _apply_decision_fields(*update)
            version.decision_id = decision_id
            session.add(version)
    except (*_IntegrityError, StaleDataError) as error:
        if (
            await session.scalar(
                select(models.Decision.id).where(models.Decision.id == decision_id)
            )
        ) is None:
            raise decision_not_found(decision_identifier) from error
        if (provider_id := version.custom_provider_id) is not None and (
            await session.scalar(
                select(models.GenerativeModelCustomProvider.id).where(
                    models.GenerativeModelCustomProvider.id == provider_id
                )
            )
        ) is None:
            raise HTTPException(
                404, f"Custom provider not found: {encode_custom_provider_id(provider_id)}"
            ) from error
        raise


async def _rest_version(session: AsyncSession, version: models.DecisionVersion) -> DecisionVersion:
    return (await _rest_versions(session, [version]))[0]


async def _rest_versions(
    session: AsyncSession, versions: Sequence[models.DecisionVersion]
) -> list[DecisionVersion]:
    """REST versions with what a caller needs to name them: the decision's name, the
    version's 1-based number within its decision, and the tags pointing at it."""
    if not versions:
        return []
    ids = [version.id for version in versions]
    other = aliased(models.DecisionVersion)
    numbers: dict[int, int] = {
        version_id: count
        for version_id, count in await session.execute(
            select(models.DecisionVersion.id, func.count(other.id))
            .join(
                other,
                and_(
                    other.decision_id == models.DecisionVersion.decision_id,
                    other.id <= models.DecisionVersion.id,
                ),
            )
            .where(models.DecisionVersion.id.in_(ids))
            .group_by(models.DecisionVersion.id)
        )
    }
    names: dict[int, Identifier] = {
        decision_id: name
        for decision_id, name in await session.execute(
            select(models.Decision.id, models.Decision.name).where(
                models.Decision.id.in_({version.decision_id for version in versions})
            )
        )
    }
    tag_names: dict[int, list[str]] = {version_id: [] for version_id in ids}
    for version_id, tag_name in await session.execute(
        select(models.DecisionVersionTag.decision_version_id, models.DecisionVersionTag.name)
        .where(models.DecisionVersionTag.decision_version_id.in_(ids))
        .order_by(models.DecisionVersionTag.name)
    ):
        tag_names[version_id].append(tag_name.root)
    return [
        DecisionVersion.from_orm_decision_version(
            version,
            decision_name=names[version.decision_id],
            version_number=numbers[version.id],
            tag_names=tag_names[version.id],
        )
        for version in versions
    ]
