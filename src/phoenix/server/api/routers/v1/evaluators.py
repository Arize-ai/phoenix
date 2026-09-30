"""Read and update shared evaluator definitions and immutable code versions."""

from collections.abc import Mapping
from typing import Annotated, Any, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, Response
from pydantic import ConfigDict, Field, model_validator
from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.helpers import (
    code_evaluator_with_latest_version,
    latest_code_evaluator_versions_by_evaluator_id,
)
from phoenix.db.models import MINIMUM_EVALUATION_DELAY_SECONDS
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.evaluators import get_builtin_evaluator_by_key
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.helpers.evaluator_prompt_source import (
    FromPromptVersion,
    resolve_evaluator_prompt_version,
)
from phoenix.server.api.routers.v1.annotation_config_models import CategoricalAnnotationConfigData
from phoenix.server.api.routers.v1.evaluator_common import (
    EvaluatorOutputConfig,
    EvaluatorRequest,
    LatestPromptVersionSelector,
    LLMEvaluatorPrompt,
    LLMEvaluatorPromptInput,
    PromptVersionSelector,
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_error_responses,
    evaluator_service_context,
    output_configs_from_db,
    output_configs_to_db,
    parse_global_id,
)
from phoenix.server.api.routers.v1.models import IsoDatetime, V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemDetailsRoute
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    get_project_by_identifier,
)
from phoenix.server.authorization import is_not_locked

EvaluatorType = Literal["llm", "code", "builtin"]

_EVALUATOR_KIND_BY_TYPE: Mapping[EvaluatorType, models.EvaluatorKind] = {
    "llm": "LLM",
    "code": "CODE",
    "builtin": "BUILTIN",
}
_TYPENAME_BY_KIND: Mapping[models.EvaluatorKind, str] = {
    "LLM": "LLMEvaluator",
    "CODE": "CodeEvaluator",
    "BUILTIN": "BuiltInEvaluator",
}


def _decode_evaluator_cursor(cursor: str) -> int:
    """Accept any evaluator id as a list cursor.

    List items carry kind-specific ids (CodeEvaluator, LLMEvaluator, BuiltInEvaluator) and
    all kinds share the evaluators table's id space, so the last item's own id works as the
    cursor and next_cursor is typed like the row it points at.
    """
    global_id = parse_global_id(cursor)
    if global_id.type_name not in _TYPENAME_BY_KIND.values():
        raise BadRequest(f"Invalid evaluator cursor: {cursor}")
    return int(global_id.node_id)


class CreateLLMEvaluatorRequest(EvaluatorRequest):
    type: Literal["llm"]
    name: Identifier = Field(description="Unique among evaluators.")
    description: Optional[str] = Field(
        default=None,
        description=(
            "Must equal the description of the prompt's tool function, since an LLM evaluator's "
            "description is the instruction its output tool carries."
        ),
    )
    prompt: LLMEvaluatorPromptInput = Field(
        description=(
            "The prompt version to run. Create the prompt and its version through the prompts "
            "API first."
        )
    )
    output_configs: list[CategoricalAnnotationConfigData] = Field(min_length=1)


class CreateCodeEvaluatorRequest(EvaluatorRequest):
    type: Literal["code"]
    name: Identifier = Field(description="Unique among evaluators.")
    description: Optional[str] = None
    source_code: str
    language: models.LanguageName
    sandbox_config_id: str
    input_mapping: InputMapping = Field(
        description="Default mapping from record fields to the function's arguments."
    )
    output_configs: list[EvaluatorOutputConfig] = Field(
        min_length=1, description="Outputs the code produces."
    )


class PatchLLMEvaluatorRequest(EvaluatorRequest):
    model_config = ConfigDict(json_schema_extra={"minProperties": 2})

    type: Literal["llm"]
    name: Identifier = Field(default=UNDEFINED)
    description: Optional[str] = Field(
        default=UNDEFINED,
        description=(
            "Must equal the description of the prompt's tool function, since an LLM evaluator's "
            "description is the instruction its output tool carries."
        ),
    )
    prompt: LLMEvaluatorPromptInput = Field(
        default=UNDEFINED,
        description="Move the evaluator to another prompt version. Omit to keep it.",
    )
    output_configs: list[CategoricalAnnotationConfigData] = Field(default=UNDEFINED, min_length=1)


class PatchCodeEvaluatorRequest(EvaluatorRequest):
    model_config = ConfigDict(json_schema_extra={"minProperties": 2})

    type: Literal["code"]
    name: Identifier = Field(default=UNDEFINED)
    description: Optional[str] = Field(default=UNDEFINED)
    sandbox_config_id: Optional[str] = Field(default=UNDEFINED)
    input_mapping: InputMapping = Field(default=UNDEFINED)
    output_configs: list[EvaluatorOutputConfig] = Field(default=UNDEFINED, min_length=1)


class CodeEvaluatorVersionRequest(EvaluatorRequest):
    source_code: str
    expected_current_version_id: Optional[str] = Field(
        default=None,
        description=(
            "GlobalID of the version the caller believes is current. When another version has "
            "been appended since, the request is refused with 409 instead of deploying over it."
        ),
    )
    description: Optional[str] = Field(
        default=UNDEFINED,
        description="Configuration applied together with the new code. Omit to keep.",
    )
    sandbox_config_id: Optional[str] = Field(
        default=UNDEFINED,
        description="Sandbox to run the new code in. Omit to keep; null clears it.",
    )
    input_mapping: InputMapping = Field(
        default=UNDEFINED,
        description="Default input mapping for the new code's arguments. Omit to keep.",
    )
    output_configs: list[EvaluatorOutputConfig] = Field(
        default=UNDEFINED,
        min_length=1,
        description="Outputs the new code produces. Omit to keep.",
    )


class CodeEvaluatorVersion(V1RoutesBaseModel):
    id: str
    evaluator_id: str
    source_code: str
    created_at: IsoDatetime


class CreatedCodeEvaluatorVersion(CodeEvaluatorVersion):
    was_created: bool = Field(
        description="False when the source matched the current version, which is returned instead."
    )


class CodeEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["code"]
    id: str
    name: Identifier
    description: Optional[str]
    language: models.LanguageName
    sandbox_config_id: Optional[str]
    input_mapping: Optional[InputMapping]
    output_configs: list[EvaluatorOutputConfig]
    current_version_id: Optional[str]
    source_code: Optional[str]


class LLMEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["llm"]
    id: str
    name: Identifier
    description: Optional[str] = Field(
        description="Equals the description of the prompt's tool function."
    )
    prompt: LLMEvaluatorPrompt
    output_configs: list[CategoricalAnnotationConfigData]


class BuiltInEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["builtin"]
    id: str
    name: Identifier
    description: Optional[str]
    key: str
    input_schema: dict[str, Any]
    output_configs: list[EvaluatorOutputConfig]


EvaluatorDefinition = Annotated[
    Union[CodeEvaluatorDefinition, LLMEvaluatorDefinition, BuiltInEvaluatorDefinition],
    Field(discriminator="type"),
]


class EvaluatorDefinitionResponseBody(ResponseBody[EvaluatorDefinition]):
    pass


class EvaluatorDefinitionsResponseBody(PaginatedResponseBody[EvaluatorDefinition]):
    pass


class CodeEvaluatorVersionsResponseBody(PaginatedResponseBody[CodeEvaluatorVersion]):
    pass


class CreatedCodeEvaluatorVersionResponseBody(ResponseBody[CreatedCodeEvaluatorVersion]):
    pass


router = APIRouter(tags=["evaluators"], route_class=ProblemDetailsRoute)


def _code_evaluator_definition(
    evaluator_id: str,
    row: models.CodeEvaluator,
    version: Optional[models.CodeEvaluatorVersion],
) -> CodeEvaluatorDefinition:
    """Build a code definition from its row and latest version, shared by the single-item
    read and the batched list so the two can't drift."""
    return CodeEvaluatorDefinition(
        type="code",
        id=evaluator_id,
        name=row.name,
        description=row.description,
        language=row.language,
        sandbox_config_id=encode_global_id("SandboxConfig", row.sandbox_config_id)
        if row.sandbox_config_id
        else None,
        input_mapping=row.input_mapping,
        output_configs=output_configs_from_db(row.output_configs),
        current_version_id=encode_global_id("CodeEvaluatorVersion", version.id)
        if version
        else None,
        source_code=version.source_code if version else None,
    )


def _builtin_evaluator_definition(
    evaluator_id: str, builtin: models.BuiltinEvaluator
) -> BuiltInEvaluatorDefinition:
    """Build a built-in definition from its row; the rest comes from the in-memory
    registry entry its key names, not the database, so there is nothing to batch beyond
    the row itself."""
    evaluator_class = get_builtin_evaluator_by_key(builtin.key)
    if evaluator_class is None:
        raise NotFound(f"Built-in evaluator class not found for key: {builtin.key}")
    instance = evaluator_class()
    return BuiltInEvaluatorDefinition(
        type="builtin",
        id=evaluator_id,
        name=Identifier(evaluator_class.name),
        description=evaluator_class.description,
        key=builtin.key,
        input_schema=instance.input_schema,
        output_configs=output_configs_from_db(list(instance.output_configs)),
    )


def _llm_evaluator_definition(
    evaluator_id: str,
    llm: models.LLMEvaluator,
    prompt_version_id: Optional[int],
) -> LLMEvaluatorDefinition:
    """Build an LLM definition from its row and the id of the version it runs (the one its
    tag pins, or, without a tag, its prompt's newest), shared by the single-item read and the
    batched list so the two can't drift."""
    version_id = (
        encode_global_id("PromptVersion", prompt_version_id)
        if (prompt_version_id is not None)
        else None
    )
    return LLMEvaluatorDefinition(
        type="llm",
        id=evaluator_id,
        name=llm.name,
        description=llm.description,
        prompt=LLMEvaluatorPrompt(
            prompt_id=encode_global_id("Prompt", llm.prompt_id),
            selector=PromptVersionSelector(type="version", prompt_version_id=version_id)
            if llm.prompt_version_tag_id is not None and version_id is not None
            else LatestPromptVersionSelector(type="latest"),
            resolved_prompt_version_id=version_id,
        ),
        output_configs=[
            CategoricalAnnotationConfigData.model_validate(config.model_dump())
            for config in llm.output_configs
        ],
    )


async def _evaluator_definition(session: AsyncSession, evaluator_id: str) -> EvaluatorDefinition:
    """Build a definition from the given session.

    Reads that follow a write must pass a writer session: the read pool may lag behind and
    would otherwise report a fresh write as missing or stale.
    """
    global_id = parse_global_id(evaluator_id)
    if global_id.type_name == "BuiltInEvaluator":
        row_id = decode_global_id(evaluator_id, "BuiltInEvaluator")
        builtin = await session.get(models.BuiltinEvaluator, row_id)
        if builtin is None:
            raise NotFound(f"Evaluator not found: {evaluator_id}")
        return _builtin_evaluator_definition(evaluator_id, builtin)
    if global_id.type_name == "CodeEvaluator":
        row_id = decode_global_id(evaluator_id, "CodeEvaluator")
        pair = await code_evaluator_with_latest_version(session, row_id)
        if pair is None:
            raise NotFound(f"Evaluator not found: {evaluator_id}")
        row, version = pair
        return _code_evaluator_definition(evaluator_id, row, version)
    row_id = decode_global_id(evaluator_id, "LLMEvaluator")
    llm = await session.get(models.LLMEvaluator, row_id)
    if llm is None:
        raise NotFound(f"Evaluator not found: {evaluator_id}")
    prompt_version = await resolve_evaluator_prompt_version(session, llm)
    return _llm_evaluator_definition(
        evaluator_id, llm, prompt_version.id if prompt_version else None
    )


async def _evaluator_definitions_page(
    session: AsyncSession, rows: list[tuple[int, models.EvaluatorKind]]
) -> list[EvaluatorDefinition]:
    """Build a page of definitions in a fixed number of queries, independent of page size:
    the LLM rows and their prompt versions (tagged and, separately, untagged) each batched
    in one statement, the code rows and their latest versions likewise, and the built-in
    rows in one statement of their own (the rest of a built-in definition comes from the
    in-memory registry, not the database). `rows` is (id, kind) as listed by
    `get_evaluators`, in the page's own order, which the result preserves."""
    llm_ids = [row_id for row_id, kind in rows if kind == "LLM"]
    code_ids = [row_id for row_id, kind in rows if kind == "CODE"]
    builtin_ids = [row_id for row_id, kind in rows if kind == "BUILTIN"]

    llm_by_id: dict[int, models.LLMEvaluator] = {}
    if llm_ids:
        llm_by_id = {
            llm.id: llm
            for llm in (
                await session.scalars(
                    select(models.LLMEvaluator).where(models.LLMEvaluator.id.in_(llm_ids))
                )
            ).all()
        }

    tag_ids = {
        llm.prompt_version_tag_id
        for llm in llm_by_id.values()
        if llm.prompt_version_tag_id is not None
    }
    tagged_prompt_version_ids: dict[int, int] = {}
    if tag_ids:
        tagged_prompt_version_ids = dict(
            (
                await session.execute(
                    select(models.PromptVersionTag.id, models.PromptVersion.id)
                    .join(
                        models.PromptVersion,
                        models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
                    )
                    .where(models.PromptVersionTag.id.in_(tag_ids))
                )
            )
            .tuples()
            .all()
        )

    untagged_prompt_ids = {
        llm.prompt_id for llm in llm_by_id.values() if llm.prompt_version_tag_id is None
    }
    latest_prompt_version_ids: dict[int, int] = {}
    if untagged_prompt_ids:
        latest_prompt_version_ids = dict(
            (
                await session.execute(
                    select(models.PromptVersion.prompt_id, func.max(models.PromptVersion.id))
                    .where(models.PromptVersion.prompt_id.in_(untagged_prompt_ids))
                    .group_by(models.PromptVersion.prompt_id)
                )
            )
            .tuples()
            .all()
        )

    code_by_id: dict[int, models.CodeEvaluator] = {}
    if code_ids:
        code_by_id = {
            row.id: row
            for row in (
                await session.scalars(
                    select(models.CodeEvaluator).where(models.CodeEvaluator.id.in_(code_ids))
                )
            ).all()
        }
    latest_code_versions = await latest_code_evaluator_versions_by_evaluator_id(code_ids, session)

    builtin_by_id: dict[int, models.BuiltinEvaluator] = {}
    if builtin_ids:
        builtin_by_id = {
            row.id: row
            for row in (
                await session.scalars(
                    select(models.BuiltinEvaluator).where(
                        models.BuiltinEvaluator.id.in_(builtin_ids)
                    )
                )
            ).all()
        }

    definitions: list[EvaluatorDefinition] = []
    for row_id, kind in rows:
        evaluator_id = encode_global_id(_TYPENAME_BY_KIND[kind], row_id)
        if kind == "CODE":
            code_row = code_by_id.get(row_id)
            if code_row is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            definitions.append(
                _code_evaluator_definition(evaluator_id, code_row, latest_code_versions.get(row_id))
            )
        elif kind == "BUILTIN":
            builtin_row = builtin_by_id.get(row_id)
            if builtin_row is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            definitions.append(_builtin_evaluator_definition(evaluator_id, builtin_row))
        else:
            llm = llm_by_id.get(row_id)
            if llm is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            prompt_version_id = (
                tagged_prompt_version_ids.get(llm.prompt_version_tag_id)
                if llm.prompt_version_tag_id is not None
                else latest_prompt_version_ids.get(llm.prompt_id)
            )
            definitions.append(_llm_evaluator_definition(evaluator_id, llm, prompt_version_id))
    return definitions


async def _written_definition(request: Request, evaluator_id: str) -> EvaluatorDefinition:
    """Read back a definition this request just wrote, through the writer."""
    async with request.app.state.db() as session:
        return await _evaluator_definition(session, evaluator_id)


@router.get(
    "/evaluators",
    operation_id="getEvaluators",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([422]),
)
async def get_evaluators(
    request: Request,
    type: Optional[EvaluatorType] = Query(default=None, description="Return one kind only."),
    name: Optional[str] = Query(default=None, description="Return the evaluator with this name."),
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> EvaluatorDefinitionsResponseBody:
    """List evaluator definitions, newest first, whether or not anything binds them.

    Items are identified by their own typed ids, and the cursor is a separate value:
    pass `next_cursor` back as is.
    """
    with evaluator_api_errors():
        kinds = [_EVALUATOR_KIND_BY_TYPE[type]] if type else list(_EVALUATOR_KIND_BY_TYPE.values())
        async with request.app.state.db.read() as session:
            stmt = (
                select(models.Evaluator.id, models.Evaluator.kind)
                .where(models.Evaluator.kind.in_(kinds))
                .order_by(models.Evaluator.id.desc())
            )
            if name is not None:
                # name is an Identifier-typed column; compare it as text so a name that
                # cannot exist (e.g. one with an uppercase letter) just matches nothing.
                stmt = stmt.where(cast(models.Evaluator.name, String) == name)
            if cursor is not None:
                stmt = stmt.where(models.Evaluator.id <= _decode_evaluator_cursor(cursor))
            rows = (await session.execute(stmt.limit(limit + 1))).all()
            next_cursor = (
                encode_global_id(_TYPENAME_BY_KIND[rows[-1][1]], rows[-1][0])
                if len(rows) > limit
                else None
            )
            data = await _evaluator_definitions_page(session, rows[:limit])
        return EvaluatorDefinitionsResponseBody(data=data, next_cursor=next_cursor)


@router.post(
    "/evaluators",
    operation_id="createEvaluator",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def create_evaluator(
    request: Request,
    body: Annotated[
        Union[CreateLLMEvaluatorRequest, CreateCodeEvaluatorRequest], Field(discriminator="type")
    ],
) -> EvaluatorDefinitionResponseBody:
    """Create an evaluator definition that nothing binds yet.

    An LLM evaluator runs an existing prompt version; a code evaluator is created with its
    first version. The name must be unique among evaluators: a clash is refused with 409
    `already_exists`, whose `existing_id` names the evaluator holding it.
    """
    with evaluator_api_errors():
        if isinstance(body, CreateLLMEvaluatorRequest):
            llm = await service.create_llm_evaluator(
                evaluator_service_context(request),
                service.CreateLLMEvaluatorInput(
                    name=body.name,
                    description=body.description,
                    prompt_version_id=parse_global_id(body.prompt.selector.prompt_version_id),
                    output_configs=output_configs_to_db(body.output_configs),
                ),
            )
            return EvaluatorDefinitionResponseBody(
                data=await _written_definition(request, encode_global_id("LLMEvaluator", llm.id))
            )
        row = await service.create_code_evaluator(
            evaluator_service_context(request),
            service.CreateCodeEvaluatorInput(
                name=body.name,
                description=body.description,
                source_code=body.source_code,
                language=body.language,
                sandbox_config_id=parse_global_id(body.sandbox_config_id),
                input_mapping=body.input_mapping,
                output_configs=output_configs_to_db(body.output_configs),
            ),
        )
        evaluator_id = encode_global_id("CodeEvaluator", row.id)
        return EvaluatorDefinitionResponseBody(
            data=await _written_definition(request, evaluator_id)
        )


@router.get(
    "/evaluators/{evaluator_id}",
    operation_id="getEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def get_evaluator(request: Request, evaluator_id: str) -> EvaluatorDefinitionResponseBody:
    """Read a definition, including its current code or the prompt version it runs.

    Built-in definitions are read-only.
    """
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            return EvaluatorDefinitionResponseBody(
                data=await _evaluator_definition(session, evaluator_id)
            )


@router.patch(
    "/evaluators/{evaluator_id}",
    operation_id="patchEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def patch_evaluator(
    request: Request,
    evaluator_id: str,
    body: Annotated[
        Union[PatchLLMEvaluatorRequest, PatchCodeEvaluatorRequest], Field(discriminator="type")
    ],
) -> EvaluatorDefinitionResponseBody:
    """Edit a definition; the change applies to every binding that references it.

    Omitted fields keep their values. Code is appended through the versions endpoint and
    prompt content through the prompts API; this route only moves pointers to them. An LLM
    change that would invalidate a dataset binding's overrides is refused with 409.
    """
    with evaluator_api_errors():
        fields = body.model_fields_set - {"type"}
        if not fields:
            raise BadRequest("At least one field must be provided")
        values = {name: getattr(body, name) for name in fields}
        if "output_configs" in fields:
            values["output_configs"] = output_configs_to_db(body.output_configs)
        if isinstance(body, PatchCodeEvaluatorRequest):
            if "sandbox_config_id" in fields and body.sandbox_config_id is not None:
                values["sandbox_config_id"] = parse_global_id(body.sandbox_config_id)
            await service.patch_code_evaluator(
                evaluator_service_context(request),
                service.PatchCodeEvaluatorInput(id=parse_global_id(evaluator_id), **values),
            )
        else:
            if "prompt" in fields:
                del values["prompt"]
                values["prompt_source"] = FromPromptVersion(
                    prompt_version_id=parse_global_id(body.prompt.selector.prompt_version_id)
                )
            await service.patch_llm_evaluator(
                evaluator_service_context(request),
                parse_global_id(evaluator_id),
                service.LLMEvaluatorPatch(**values),
            )
        return EvaluatorDefinitionResponseBody(
            data=await _written_definition(request, evaluator_id)
        )


@router.delete(
    "/evaluators/{evaluator_id}",
    operation_id="deleteEvaluator",
    status_code=204,
    responses=evaluator_error_responses([409, 422]),
)
async def delete_evaluator(request: Request, evaluator_id: str) -> Response:
    """Delete a definition that nothing binds; a missing evaluator is ignored.

    A definition still bound by a project or dataset is refused with 409; delete those
    bindings first. Deleting an LLM evaluator removes the tag that pins its version and keeps
    the prompt. Built-in evaluators cannot be deleted.
    """
    with evaluator_api_errors():
        global_id = parse_global_id(evaluator_id)
        context = evaluator_service_context(request)
        if global_id.type_name == "CodeEvaluator":
            await service.delete_code_evaluator(context, global_id)
        elif global_id.type_name == "LLMEvaluator":
            await service.delete_llm_evaluator(context, global_id)
        else:
            raise BadRequest("Built-in evaluators cannot be deleted")
    return Response(status_code=204)


def _version_response(
    evaluator_id: str, version: models.CodeEvaluatorVersion
) -> CodeEvaluatorVersion:
    return CodeEvaluatorVersion(
        id=encode_global_id("CodeEvaluatorVersion", version.id),
        evaluator_id=evaluator_id,
        source_code=version.source_code,
        created_at=version.created_at,
    )


@router.get(
    "/evaluators/{evaluator_id}/versions",
    operation_id="listCodeEvaluatorVersions",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def list_code_evaluator_versions(
    request: Request,
    evaluator_id: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> CodeEvaluatorVersionsResponseBody:
    """List a code evaluator's versions, newest first. Only code evaluators have versions."""
    with evaluator_api_errors():
        row_id = decode_global_id(evaluator_id, "CodeEvaluator")
        async with request.app.state.db.read() as session:
            if await session.get(models.CodeEvaluator, row_id) is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            stmt = (
                select(models.CodeEvaluatorVersion)
                .where(models.CodeEvaluatorVersion.code_evaluator_id == row_id)
                .order_by(models.CodeEvaluatorVersion.id.desc())
            )
            if cursor is not None:
                stmt = stmt.where(
                    models.CodeEvaluatorVersion.id
                    <= decode_global_id(cursor, "CodeEvaluatorVersion")
                )
            versions = (await session.scalars(stmt.limit(limit + 1))).all()
            next_cursor = (
                encode_global_id("CodeEvaluatorVersion", versions[-1].id)
                if len(versions) > limit
                else None
            )
            return CodeEvaluatorVersionsResponseBody(
                data=[_version_response(evaluator_id, version) for version in versions[:limit]],
                next_cursor=next_cursor,
            )


@router.post(
    "/evaluators/{evaluator_id}/versions",
    operation_id="createCodeEvaluatorVersion",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses={
        **evaluator_error_responses([404, 409, 422, 507]),
        200: {
            "model": CreatedCodeEvaluatorVersionResponseBody,
            "description": "Source matches the current version",
        },
    },
)
async def create_code_evaluator_version(
    request: Request, response: Response, evaluator_id: str, body: CodeEvaluatorVersionRequest
) -> CreatedCodeEvaluatorVersionResponseBody:
    """Append immutable code, returning 200 when it matches the current version.

    Configuration sent alongside (sandbox, input mapping, outputs, description) is applied in
    the same transaction, so bindings never see new code with the old configuration. Pass
    `expected_current_version_id` to be refused with 409 if another deployment landed first.
    Deduplication compares against the current version only, so restoring older source
    creates another version.
    """
    with evaluator_api_errors():
        fields = body.model_fields_set
        configuration: dict[str, object] = {}
        if "description" in fields:
            configuration["description"] = body.description
        if "sandbox_config_id" in fields:
            configuration["sandbox_config_id"] = (
                parse_global_id(body.sandbox_config_id) if body.sandbox_config_id else None
            )
        if "input_mapping" in fields:
            configuration["input_mapping"] = body.input_mapping
        if "output_configs" in fields:
            configuration["output_configs"] = output_configs_to_db(body.output_configs)
        _, version, was_created = await service.create_code_evaluator_version(
            evaluator_service_context(request),
            service.CreateCodeEvaluatorVersionInput(
                code_evaluator_id=parse_global_id(evaluator_id),
                source_code=body.source_code,
                expected_current_version_id=parse_global_id(body.expected_current_version_id)
                if body.expected_current_version_id
                else None,
                **configuration,  # type: ignore[arg-type]
            ),
        )
        if not was_created:
            response.status_code = 200
        return CreatedCodeEvaluatorVersionResponseBody(
            data=CreatedCodeEvaluatorVersion(
                **_version_response(evaluator_id, version).model_dump(),
                was_created=was_created,
            )
        )


class CreateProjectEvaluatorRequest(EvaluatorRequest):
    name: Identifier = Field(description="Unique among this project's evaluators.")
    evaluator_id: str = Field(
        description=(
            "GlobalID of the LLM or code evaluator definition to run. Create a definition "
            "through POST /v1/evaluators first."
        )
    )
    evaluation_target: models.EvaluationTarget
    sampling_rate: float = Field(ge=0, le=1, allow_inf_nan=False)
    filter_condition: str = ""
    enabled: bool = True
    input_mapping: Optional[InputMapping] = Field(
        default=None,
        description=(
            "Null uses the evaluator's mapping. LLM evaluators have none, so template "
            "variables bind to context keys of the same name."
        ),
    )
    evaluation_delay_seconds: Optional[int] = Field(
        default=None,
        ge=MINIMUM_EVALUATION_DELAY_SECONDS,
        le=2**31 - 1,
        description=(
            "Quiet period in seconds before a TRACE or SESSION evaluator runs. Null stores the "
            "server default. SPAN evaluators reject a non-null delay and store 0."
        ),
    )


class PatchProjectEvaluatorRequest(EvaluatorRequest):
    model_config = ConfigDict(json_schema_extra={"minProperties": 1})

    name: Identifier = Field(default=UNDEFINED)
    sampling_rate: float = Field(default=UNDEFINED, ge=0, le=1, allow_inf_nan=False)
    filter_condition: str = Field(default=UNDEFINED)
    enabled: bool = Field(default=UNDEFINED)
    input_mapping: Optional[InputMapping] = Field(
        default=UNDEFINED,
        description=(
            "Omit to preserve. Null clears the binding's mapping, so the evaluator's applies."
        ),
    )
    evaluation_delay_seconds: Optional[int] = Field(
        default=UNDEFINED,
        ge=MINIMUM_EVALUATION_DELAY_SECONDS,
        le=2**31 - 1,
        description=(
            "Omit to preserve. Null resets a TRACE or SESSION delay to the server default. "
            "SPAN evaluators reject a non-null delay."
        ),
    )

    @model_validator(mode="after")
    def require_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class ProjectEvaluator(V1RoutesBaseModel):
    id: str
    project_id: str
    evaluator_id: str
    evaluator_type: Literal["llm", "code", "builtin"]
    trace_project_id: str
    name: Identifier
    evaluation_target: models.EvaluationTarget
    sampling_rate: float
    filter_condition: str = Field(
        description="Written in the filter language of the target: span, trace, or session."
    )
    enabled: bool
    input_mapping: Optional[InputMapping] = Field(
        description=(
            "The binding's own input mapping; null means the evaluator's mapping applies "
            "(LLM evaluators have none)."
        )
    )
    evaluation_delay_seconds: int = Field(
        description=(
            "Quiet period for TRACE and SESSION evaluators; 0 for SPAN, which evaluates spans "
            "as they arrive."
        )
    )


class ProjectEvaluatorResponseBody(ResponseBody[ProjectEvaluator]):
    pass


class ProjectEvaluatorsResponseBody(PaginatedResponseBody[ProjectEvaluator]):
    pass


async def _project_evaluator(session: AsyncSession, project_evaluator_id: str) -> ProjectEvaluator:
    """Build a binding from the given session; reads after a write must use the writer."""
    row_id = decode_global_id(project_evaluator_id, "ProjectEvaluator")
    pair = (
        await session.execute(
            select(models.ProjectEvaluator, models.Evaluator.kind)
            .join(models.Evaluator, models.ProjectEvaluator.evaluator_id == models.Evaluator.id)
            .where(models.ProjectEvaluator.id == row_id)
        )
    ).one_or_none()
    if pair is None:
        raise NotFound(f"Project evaluator not found: {project_evaluator_id}")
    return _binding_response(*pair)


async def _written_project_evaluator(
    request: Request, project_evaluator_id: str
) -> ProjectEvaluator:
    """Read back a binding this request just wrote, through the writer."""
    async with request.app.state.db() as session:
        return await _project_evaluator(session, project_evaluator_id)


def _binding_response(row: models.ProjectEvaluator, kind: models.EvaluatorKind) -> ProjectEvaluator:
    return ProjectEvaluator(
        id=encode_global_id("ProjectEvaluator", row.id),
        project_id=encode_global_id("Project", row.project_id),
        evaluator_id=encode_global_id(
            {"LLM": "LLMEvaluator", "CODE": "CodeEvaluator", "BUILTIN": "BuiltInEvaluator"}[kind],
            row.evaluator_id,
        ),
        evaluator_type={"LLM": "llm", "CODE": "code", "BUILTIN": "builtin"}[kind],
        trace_project_id=encode_global_id("Project", row.trace_project_id),
        name=row.name,
        evaluation_target=row.evaluation_target,
        sampling_rate=row.sampling_rate,
        filter_condition=row.filter_condition,
        enabled=row.enabled,
        input_mapping=row.input_mapping,
        evaluation_delay_seconds=row.evaluation_delay_seconds,
    )


@router.post(
    "/projects/{project_identifier}/evaluators",
    operation_id="createProjectEvaluator",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def create_project_evaluator(
    request: Request, project_identifier: str, body: CreateProjectEvaluatorRequest
) -> ProjectEvaluatorResponseBody:
    """Bind an existing LLM or code evaluator definition to a project.

    The project identifier is decoded as a GlobalID first and otherwise treated as a name.
    SPAN evaluators run on matching sampled spans. TRACE and SESSION evaluators run once per
    trace or session, after the first quiet period following the evaluation delay. A name the
    project already uses is refused with 409 `already_exists` and that binding's
    `existing_id`.
    """
    with evaluator_api_errors():
        # The writer sees a project created just before this request; a replica may not.
        async with request.app.state.db() as session:
            project = await get_project_by_identifier(session, project_identifier)
            project_id = GlobalID("Project", str(project.id))
        row = await service.add_project_evaluator(
            evaluator_service_context(request),
            service.AddProjectCodeEvaluatorInput(
                project_id=project_id,
                name=body.name,
                evaluation_target=body.evaluation_target,
                sampling_rate=body.sampling_rate,
                filter_condition=body.filter_condition,
                enabled=body.enabled,
                input_mapping=body.input_mapping,
                evaluation_delay_seconds=body.evaluation_delay_seconds,
                evaluator_id=parse_global_id(body.evaluator_id),
            ),
        )
        return ProjectEvaluatorResponseBody(
            data=await _written_project_evaluator(
                request, encode_global_id("ProjectEvaluator", row.id)
            )
        )


@router.get(
    "/projects/{project_identifier}/evaluators",
    operation_id="getProjectEvaluators",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def get_project_evaluators(
    request: Request,
    project_identifier: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> ProjectEvaluatorsResponseBody:
    """List evaluator bindings in a project. The identifier is decoded as a GlobalID first and
    otherwise treated as a name."""
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            project = await get_project_by_identifier(session, project_identifier)
            stmt = (
                select(models.ProjectEvaluator, models.Evaluator.kind)
                .join(models.Evaluator, models.ProjectEvaluator.evaluator_id == models.Evaluator.id)
                .where(models.ProjectEvaluator.project_id == project.id)
                .order_by(models.ProjectEvaluator.id.desc())
            )
            if cursor is not None:
                stmt = stmt.where(
                    models.ProjectEvaluator.id <= decode_global_id(cursor, "ProjectEvaluator")
                )
            rows = (await session.execute(stmt.limit(limit + 1))).all()
            next_cursor = (
                encode_global_id("ProjectEvaluator", rows[-1][0].id) if len(rows) > limit else None
            )
            return ProjectEvaluatorsResponseBody(
                data=[_binding_response(*row) for row in rows[:limit]], next_cursor=next_cursor
            )


@router.get(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="getProjectEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def get_project_evaluator(
    request: Request, project_evaluator_id: str
) -> ProjectEvaluatorResponseBody:
    """Fetch binding settings. Use evaluator_id to retrieve the shared definition."""
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            return ProjectEvaluatorResponseBody(
                data=await _project_evaluator(session, project_evaluator_id)
            )


@router.patch(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="patchProjectEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def patch_project_evaluator(
    request: Request, project_evaluator_id: str, body: PatchProjectEvaluatorRequest
) -> ProjectEvaluatorResponseBody:
    """Update only binding settings. Evaluation target and evaluator kind are immutable."""
    with evaluator_api_errors():
        await service.patch_project_evaluator(
            evaluator_service_context(request),
            parse_global_id(project_evaluator_id),
            service.ProjectEvaluatorPatch(
                **{name: getattr(body, name) for name in body.model_fields_set}
            ),
        )
        return ProjectEvaluatorResponseBody(
            data=await _written_project_evaluator(request, project_evaluator_id)
        )


@router.delete(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="deleteProjectEvaluator",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([422]),
)
async def delete_project_evaluator(request: Request, project_evaluator_id: str) -> Response:
    """Delete a binding; a missing binding is ignored.

    The evaluator definition, its prompt, and the binding's trace project are kept: delete a
    definition that nothing binds through DELETE /v1/evaluators/{evaluator_id}.
    """
    with evaluator_api_errors():
        await service.detach_project_evaluators(
            evaluator_service_context(request), [parse_global_id(project_evaluator_id)]
        )
        return Response(status_code=204)


@router.delete(
    "/projects/{project_identifier}/evaluators",
    operation_id="deleteProjectEvaluators",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def delete_project_evaluators(
    request: Request,
    project_identifier: str,
    project_evaluator_id: list[str] = Query(
        min_length=1,
        max_length=1000,
        description="GlobalIDs of this project's bindings to delete; repeat for each.",
    ),
) -> Response:
    """Delete up to 1000 of a project's bindings in one transaction.

    Missing bindings are ignored; a binding of another project is refused with 422 before
    any change. Definitions, prompts, and trace projects are kept.
    """
    with evaluator_api_errors():
        async with request.app.state.db() as session:
            project = await get_project_by_identifier(session, project_identifier)
        await service.detach_project_evaluators(
            evaluator_service_context(request),
            [parse_global_id(value) for value in project_evaluator_id],
            project_id=GlobalID("Project", str(project.id)),
        )
        return Response(status_code=204)
