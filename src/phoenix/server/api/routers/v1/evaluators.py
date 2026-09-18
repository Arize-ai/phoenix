"""Read and update shared evaluator definitions and immutable code versions."""

from collections.abc import Mapping
from typing import Annotated, Any, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, Response
from pydantic import ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import code_evaluator_with_latest_version
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.evaluators import get_builtin_evaluator_by_key
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.routers.v1.annotation_config_models import CategoricalAnnotationConfigData
from phoenix.server.api.routers.v1.evaluator_common import (
    EvaluatorOutputConfig,
    EvaluatorRequest,
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_error_responses,
    evaluator_service_context,
    output_configs_from_db,
    output_configs_to_db,
)
from phoenix.server.api.routers.v1.models import IsoDatetime, V1RoutesBaseModel
from phoenix.server.api.routers.v1.prompt_models import PromptVersion
from phoenix.server.api.routers.v1.utils import PaginatedResponseBody, ResponseBody
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
    global_id = GlobalID.from_id(cursor)
    if global_id.type_name not in _TYPENAME_BY_KIND.values():
        raise BadRequest(f"Invalid evaluator cursor: {cursor}")
    return int(global_id.node_id)


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
    prompt_version_id: str = Field(
        default=UNDEFINED,
        description=(
            "GlobalID of the prompt version to run. New prompt content is created through the "
            "prompts API; a version from another prompt moves the evaluator to that prompt."
        ),
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
    prompt_id: str = Field(description="GlobalID of the prompt whose versions this evaluator runs.")
    prompt_version: Optional[PromptVersion] = Field(
        description="The version the evaluator currently runs; its id is what patch accepts."
    )
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


router = APIRouter(tags=["evaluators"])


async def _evaluator_definition(session: AsyncSession, evaluator_id: str) -> EvaluatorDefinition:
    """Build a definition from the given session.

    Reads that follow a write must pass a writer session: the read pool may lag behind and
    would otherwise report a fresh write as missing or stale.
    """
    global_id = GlobalID.from_id(evaluator_id)
    if global_id.type_name == "BuiltInEvaluator":
        row_id = decode_global_id(evaluator_id, "BuiltInEvaluator")
        builtin = await session.get(models.BuiltinEvaluator, row_id)
        if builtin is None:
            raise NotFound(f"Evaluator not found: {evaluator_id}")
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
    if global_id.type_name == "CodeEvaluator":
        row_id = decode_global_id(evaluator_id, "CodeEvaluator")
        pair = await code_evaluator_with_latest_version(session, row_id)
        if pair is None:
            raise NotFound(f"Evaluator not found: {evaluator_id}")
        row, version = pair
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
    row_id = decode_global_id(evaluator_id, "LLMEvaluator")
    llm = await session.get(models.LLMEvaluator, row_id)
    if llm is None:
        raise NotFound(f"Evaluator not found: {evaluator_id}")
    prompt = await session.scalar(
        select(models.PromptVersion)
        .join(
            models.PromptVersionTag,
            models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
        )
        .where(models.PromptVersionTag.id == llm.prompt_version_tag_id)
    )
    return LLMEvaluatorDefinition(
        type="llm",
        id=evaluator_id,
        name=llm.name,
        description=llm.description,
        prompt_id=encode_global_id("Prompt", llm.prompt_id),
        output_configs=[
            CategoricalAnnotationConfigData.model_validate(config.model_dump())
            for config in llm.output_configs
        ],
        prompt_version=PromptVersion.from_orm_prompt_version(prompt) if prompt else None,
    )


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
                stmt = stmt.where(models.Evaluator.name == Identifier.model_validate(name))
            if cursor is not None:
                stmt = stmt.where(models.Evaluator.id <= _decode_evaluator_cursor(cursor))
            rows = (await session.execute(stmt.limit(limit + 1))).all()
            next_cursor = (
                encode_global_id(_TYPENAME_BY_KIND[rows[-1][1]], rows[-1][0])
                if len(rows) > limit
                else None
            )
            data = [
                await _evaluator_definition(
                    session, encode_global_id(_TYPENAME_BY_KIND[kind], row_id)
                )
                for row_id, kind in rows[:limit]
            ]
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
    request: Request, body: CreateCodeEvaluatorRequest
) -> EvaluatorDefinitionResponseBody:
    """Create a code evaluator that nothing binds yet, with its first version.

    LLM evaluators are created through the binding routes because each one is tied to its
    own prompt. The name must be unique among evaluators; a clash is refused with 409.
    """
    with evaluator_api_errors():
        row = await service.create_code_evaluator(
            evaluator_service_context(request),
            service.CreateCodeEvaluatorInput(
                name=body.name,
                description=body.description,
                source_code=body.source_code,
                language=body.language,
                sandbox_config_id=GlobalID.from_id(body.sandbox_config_id),
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
                values["sandbox_config_id"] = GlobalID.from_id(body.sandbox_config_id)
            await service.patch_code_evaluator(
                evaluator_service_context(request),
                service.PatchCodeEvaluatorInput(id=GlobalID.from_id(evaluator_id), **values),
            )
        else:
            if "prompt_version_id" in fields:
                values["prompt_version_id"] = GlobalID.from_id(body.prompt_version_id)
            await service.patch_llm_evaluator(
                evaluator_service_context(request),
                GlobalID.from_id(evaluator_id),
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
    """Delete a code evaluator that nothing binds, with its version history.

    A definition still bound by a project or dataset is refused with 409; delete those
    bindings first, or delete the last binding, which removes the definition with it. LLM
    evaluators are owned by their bindings and are deleted with the last one; built-in
    evaluators are never deleted. A missing evaluator is ignored.
    """
    with evaluator_api_errors():
        global_id = GlobalID.from_id(evaluator_id)
        if global_id.type_name != "CodeEvaluator":
            raise BadRequest(
                "Only code evaluators can be deleted here; LLM evaluators are deleted with "
                "their last binding and built-in evaluators cannot be deleted"
            )
        await service.delete_code_evaluator(evaluator_service_context(request), global_id)
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
                GlobalID.from_id(body.sandbox_config_id) if body.sandbox_config_id else None
            )
        if "input_mapping" in fields:
            configuration["input_mapping"] = body.input_mapping
        if "output_configs" in fields:
            configuration["output_configs"] = output_configs_to_db(body.output_configs)
        _, version, was_created = await service.create_code_evaluator_version(
            evaluator_service_context(request),
            service.CreateCodeEvaluatorVersionInput(
                code_evaluator_id=GlobalID.from_id(evaluator_id),
                source_code=body.source_code,
                expected_current_version_id=GlobalID.from_id(body.expected_current_version_id)
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
