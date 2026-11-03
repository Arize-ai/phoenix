"""Manage decision labels, and the labels applied to each decision, over REST.

The routes mirror the dataset label routes. Errors are RFC 9457 problem details.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.routers.v1.decision_models import (
    DecisionLabel,
    DecisionLabelData,
    encode_decision_label_id,
)
from phoenix.server.api.routers.v1.decisions import (
    decision_not_found,
    decision_where_clause,
    parse_cursor,
    parse_decision_label_id,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import (
    ProblemDetailsRoute,
    ProblemException,
    problem_responses,
)
from phoenix.server.api.routers.v1.utils import (
    HexColor,
    PaginatedResponseBody,
    ResponseBody,
    Responses,
)
from phoenix.server.authorization import is_not_locked

_IntegrityError = (PostgreSQLIntegrityError, SQLiteIntegrityError)

router = APIRouter(tags=["decisions"], route_class=ProblemDetailsRoute)

_DECISION_IDENTIFIER = Path(description="The identifier of the decision: its GlobalID or name.")
_DECISION_LABEL_ID = Path(description="The GlobalID of the decision label.")

_RESPONSE_OPTIONS: dict[str, Any] = dict(
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)


def _errors(status_codes: list[int]) -> Responses:
    return problem_responses([*status_codes, 403])


class GetDecisionLabelsResponseBody(PaginatedResponseBody[DecisionLabel]):
    pass


class DecisionLabelResponseBody(ResponseBody[DecisionLabel]):
    pass


class DecisionLabelsResponseBody(ResponseBody[list[DecisionLabel]]):
    pass


class PatchDecisionLabelRequestBody(V1RoutesBaseModel):
    """Fields to update on a decision label. Omit a field to leave it unchanged."""

    name: str = Field(default=UNDEFINED, min_length=1, description="The label's new name.")
    color: HexColor = Field(default=UNDEFINED, description="The label's new color.")
    description: Optional[str] = Field(
        default=UNDEFINED, description="The label's new description (null clears it)."
    )

    @model_validator(mode="after")
    def _validate_patch(self) -> Self:
        if self.name is UNDEFINED and self.color is UNDEFINED and self.description is UNDEFINED:
            raise ValueError("at least one field must be provided")
        return self


class SetDecisionLabelsRequestBody(V1RoutesBaseModel):
    decision_label_ids: list[str] = Field(
        description=(
            "The complete set of decision label GlobalIDs to apply. Labels not in this list "
            "are removed from the decision; an empty list removes all labels."
        ),
    )


# --------------------------------------------------------------------------------------------
# Decision labels
# --------------------------------------------------------------------------------------------


@router.get(
    "/decision_labels",
    operation_id="listDecisionLabels",
    summary="List decision labels",
    description="Retrieve a paginated list of decision labels, newest first.",
    response_description="A list of decision labels with pagination information",
    responses=_errors([422]),
    **_RESPONSE_OPTIONS,
)
async def list_decision_labels(
    request: Request,
    cursor: Optional[str] = Query(
        default=None, description="Cursor for pagination (a DecisionLabel GlobalID)"
    ),
    limit: int = Query(
        default=100, description="The max number of labels to return at a time.", gt=0
    ),
) -> GetDecisionLabelsResponseBody:
    stmt = select(models.DecisionLabel).order_by(models.DecisionLabel.id.desc())
    if cursor:
        stmt = stmt.where(models.DecisionLabel.id <= parse_cursor(cursor, "DecisionLabel"))
    async with request.app.state.db() as session:
        labels = list((await session.scalars(stmt.limit(limit + 1))).all())
    next_cursor = None
    if len(labels) > limit:
        next_cursor = encode_decision_label_id(labels[limit].id)
        labels = labels[:limit]
    return GetDecisionLabelsResponseBody(
        data=[DecisionLabel.from_orm_decision_label(label) for label in labels],
        next_cursor=next_cursor,
    )


@router.post(
    "/decision_labels",
    dependencies=[Depends(is_not_locked)],
    operation_id="createDecisionLabel",
    summary="Create a decision label",
    description="Create a decision label. Label names are unique; a taken name is refused "
    "with 409.",
    response_description="The created decision label",
    status_code=201,
    responses=_errors([409, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def create_decision_label(
    request: Request,
    request_body: DecisionLabelData,
) -> DecisionLabelResponseBody:
    async with request.app.state.db() as session:
        label = models.DecisionLabel(
            name=request_body.name,
            description=request_body.description,
            color=request_body.color,
        )
        try:
            async with session.begin_nested():
                session.add(label)
        except _IntegrityError as error:
            raise await _name_taken(session, request_body.name) from error
        data = DecisionLabel.from_orm_decision_label(label)
    return DecisionLabelResponseBody(data=data)


@router.get(
    "/decision_labels/{decision_label_id}",
    operation_id="getDecisionLabel",
    summary="Get a decision label",
    description="Retrieve a decision label by its GlobalID.",
    response_description="The requested decision label",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def get_decision_label(
    request: Request,
    decision_label_id: str = _DECISION_LABEL_ID,
) -> DecisionLabelResponseBody:
    rowid = parse_decision_label_id(decision_label_id)
    async with request.app.state.db() as session:
        label = await session.get(models.DecisionLabel, rowid)
    if label is None:
        raise _label_not_found(decision_label_id)
    return DecisionLabelResponseBody(data=DecisionLabel.from_orm_decision_label(label))


@router.patch(
    "/decision_labels/{decision_label_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="patchDecisionLabel",
    summary="Update a decision label",
    description="Update a decision label's name, color, and/or description. An omitted field "
    "is left unchanged; at least one is required. A taken name is refused with 409.",
    response_description="The updated decision label",
    responses=_errors([404, 409, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def patch_decision_label(
    request: Request,
    request_body: PatchDecisionLabelRequestBody,
    decision_label_id: str = _DECISION_LABEL_ID,
) -> DecisionLabelResponseBody:
    rowid = parse_decision_label_id(decision_label_id)
    async with request.app.state.db() as session:
        label = await session.get(models.DecisionLabel, rowid)
        if label is None:
            raise _label_not_found(decision_label_id)
        try:
            # Opening a savepoint flushes pending changes, so make the edits inside it.
            async with session.begin_nested():
                if request_body.name is not UNDEFINED:
                    label.name = request_body.name
                if request_body.color is not UNDEFINED:
                    label.color = request_body.color
                if request_body.description is not UNDEFINED:
                    label.description = request_body.description
        except _IntegrityError as error:
            raise await _name_taken(session, request_body.name) from error
        data = DecisionLabel.from_orm_decision_label(label)
    return DecisionLabelResponseBody(data=data)


@router.delete(
    "/decision_labels/{decision_label_id}",
    operation_id="deleteDecisionLabel",
    summary="Delete a decision label",
    description="Delete a decision label. It is removed from every decision it is applied to.",
    status_code=204,
    responses=_errors([404, 422]),
)
async def delete_decision_label(
    request: Request,
    decision_label_id: str = _DECISION_LABEL_ID,
) -> None:
    rowid = parse_decision_label_id(decision_label_id)
    async with request.app.state.db() as session:
        deleted = await session.scalar(
            delete(models.DecisionLabel)
            .where(models.DecisionLabel.id == rowid)
            .returning(models.DecisionLabel.id)
        )
    if deleted is None:
        raise _label_not_found(decision_label_id)


# --------------------------------------------------------------------------------------------
# Labels applied to a decision
# --------------------------------------------------------------------------------------------


@router.get(
    "/decisions/{decision_identifier}/labels",
    operation_id="listDecisionLabelsForDecision",
    summary="List a decision's labels",
    description="Retrieve the labels applied to a decision, by GlobalID or name.",
    response_description="The labels applied to the decision",
    responses=_errors([404, 422]),
    **_RESPONSE_OPTIONS,
)
async def list_decision_labels_for_decision(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> DecisionLabelsResponseBody:
    async with request.app.state.db() as session:
        decision_id = await _decision_id(session, decision_identifier)
        labels = await _labels_of(session, decision_id)
    return DecisionLabelsResponseBody(
        data=[DecisionLabel.from_orm_decision_label(label) for label in labels]
    )


@router.put(
    "/decisions/{decision_identifier}/labels",
    dependencies=[Depends(is_not_locked)],
    operation_id="setDecisionLabels",
    summary="Replace a decision's labels",
    description="Replace the set of labels applied to a decision: listed labels not yet "
    "applied are added, and applied labels not listed are removed. An empty list removes "
    "all labels.",
    response_description="The labels now applied to the decision",
    responses=_errors([404, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def set_decision_labels(
    request: Request,
    request_body: SetDecisionLabelsRequestBody,
    decision_identifier: str = _DECISION_IDENTIFIER,
) -> DecisionLabelsResponseBody:
    label_rowids = list(
        dict.fromkeys(parse_decision_label_id(value) for value in request_body.decision_label_ids)
    )
    async with request.app.state.db() as session:
        decision_id = await _decision_id(session, decision_identifier)
        if label_rowids:
            found = set(
                await session.scalars(
                    select(models.DecisionLabel.id).where(models.DecisionLabel.id.in_(label_rowids))
                )
            )
            if missing := [rowid for rowid in label_rowids if rowid not in found]:
                raise _label_not_found(encode_decision_label_id(missing[0]))
        applied = set(
            await session.scalars(
                select(models.DecisionDecisionLabel.decision_label_id).where(
                    models.DecisionDecisionLabel.decision_id == decision_id
                )
            )
        )
        if to_remove := applied.difference(label_rowids):
            await session.execute(
                delete(models.DecisionDecisionLabel).where(
                    models.DecisionDecisionLabel.decision_id == decision_id,
                    models.DecisionDecisionLabel.decision_label_id.in_(to_remove),
                )
            )
        for rowid in label_rowids:
            if rowid not in applied:
                await _apply_label(session, decision_id, rowid)
        labels = await _labels_of(session, decision_id)
    return DecisionLabelsResponseBody(
        data=[DecisionLabel.from_orm_decision_label(label) for label in labels]
    )


@router.put(
    "/decisions/{decision_identifier}/labels/{decision_label_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="addDecisionLabelToDecision",
    summary="Apply a label to a decision",
    description="Apply a label to a decision. Applying a label that is already applied "
    "changes nothing.",
    response_description="The applied label",
    responses=_errors([404, 422, 507]),
    **_RESPONSE_OPTIONS,
)
async def add_decision_label_to_decision(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
    decision_label_id: str = _DECISION_LABEL_ID,
) -> DecisionLabelResponseBody:
    rowid = parse_decision_label_id(decision_label_id)
    async with request.app.state.db() as session:
        decision_id = await _decision_id(session, decision_identifier)
        label = await session.get(models.DecisionLabel, rowid)
        if label is None:
            raise _label_not_found(decision_label_id)
        await _apply_label(session, decision_id, rowid)
        data = DecisionLabel.from_orm_decision_label(label)
    return DecisionLabelResponseBody(data=data)


@router.delete(
    "/decisions/{decision_identifier}/labels/{decision_label_id}",
    operation_id="removeDecisionLabelFromDecision",
    summary="Remove a label from a decision",
    description="Remove a label from a decision without deleting the label. Removing a label "
    "that is not applied changes nothing.",
    status_code=204,
    responses=_errors([404, 422]),
)
async def remove_decision_label_from_decision(
    request: Request,
    decision_identifier: str = _DECISION_IDENTIFIER,
    decision_label_id: str = _DECISION_LABEL_ID,
) -> None:
    rowid = parse_decision_label_id(decision_label_id)
    async with request.app.state.db() as session:
        decision_id = await _decision_id(session, decision_identifier)
        await session.execute(
            delete(models.DecisionDecisionLabel).where(
                models.DecisionDecisionLabel.decision_id == decision_id,
                models.DecisionDecisionLabel.decision_label_id == rowid,
            )
        )


# --------------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------------


def _label_not_found(decision_label_id: str) -> HTTPException:
    return HTTPException(404, f"Decision label not found: {decision_label_id}")


async def _name_taken(session: AsyncSession, name: str) -> ProblemException:
    existing_id = await session.scalar(
        select(models.DecisionLabel.id).where(models.DecisionLabel.name == name)
    )
    return ProblemException(
        409,
        "already_exists",
        f"A decision label named '{name}' already exists",
        existing_id=encode_decision_label_id(existing_id) if existing_id is not None else None,
    )


async def _decision_id(session: AsyncSession, decision_identifier: str) -> int:
    decision_id = await session.scalar(
        select(models.Decision.id).where(decision_where_clause(decision_identifier))
    )
    if decision_id is None:
        raise decision_not_found(decision_identifier)
    return int(decision_id)


async def _labels_of(session: AsyncSession, decision_id: int) -> list[models.DecisionLabel]:
    return list(
        await session.scalars(
            select(models.DecisionLabel)
            .join(
                models.DecisionDecisionLabel,
                models.DecisionDecisionLabel.decision_label_id == models.DecisionLabel.id,
            )
            .where(models.DecisionDecisionLabel.decision_id == decision_id)
            .order_by(models.DecisionLabel.id.desc())
        )
    )


async def _apply_label(session: AsyncSession, decision_id: int, decision_label_id: int) -> None:
    """Apply the label unless it already is; a concurrent apply is not an error."""
    already_applied = await session.scalar(
        select(models.DecisionDecisionLabel.decision_id).where(
            models.DecisionDecisionLabel.decision_id == decision_id,
            models.DecisionDecisionLabel.decision_label_id == decision_label_id,
        )
    )
    if already_applied is not None:
        return
    try:
        async with session.begin_nested():
            session.add(
                models.DecisionDecisionLabel(
                    decision_id=decision_id, decision_label_id=decision_label_id
                )
            )
    except _IntegrityError:
        pass
