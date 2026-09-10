"""Manage project evaluator bindings and shared evaluator definitions."""

from typing import Annotated, Any, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field, model_validator
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import Self

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
    Language,
    NewCodeEvaluator,
    NewLLMEvaluator,
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_service_context,
    output_configs_from_db,
    output_configs_to_db,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.prompt_models import (
    PromptVersionData,
    prompt_version_data_from_orm,
)
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    get_project_by_identifier,
)
from phoenix.server.api.types.Evaluator import EvaluationTarget
from phoenix.server.authorization import is_not_locked
from phoenix.server.online_eval.session_policy import MINIMUM_EVALUATION_DELAY_SECONDS


class ExistingCodeEvaluator(EvaluatorRequest):
    type: Literal["reference"]
    evaluator_id: str


class CreateProjectEvaluatorRequest(EvaluatorRequest):
    name: Identifier
    evaluation_target: EvaluationTarget
    sampling_rate: float = Field(ge=0, le=1, allow_inf_nan=False)
    filter_condition: str = ""
    enabled: bool = True
    input_mapping: Optional[InputMapping] = None
    evaluation_delay_seconds: Optional[int] = Field(
        default=None,
        ge=MINIMUM_EVALUATION_DELAY_SECONDS,
        le=2**31 - 1,
        description=(
            "Session quiet-period delay in seconds. Null uses the server default. "
            "SPAN rejects a non-null delay. TRACE evaluators are stored but not scheduled."
        ),
    )
    evaluator: Annotated[
        Union[NewLLMEvaluator, NewCodeEvaluator, ExistingCodeEvaluator], Field(discriminator="type")
    ]

    @model_validator(mode="after")
    def require_llm_mapping(self) -> Self:
        if isinstance(self.evaluator, NewLLMEvaluator) and self.input_mapping is None:
            raise ValueError("input_mapping is required for LLM evaluators")
        return self


class PatchProjectEvaluatorRequest(EvaluatorRequest):
    name: Identifier = Field(default=UNDEFINED)
    sampling_rate: float = Field(default=UNDEFINED, ge=0, le=1, allow_inf_nan=False)
    filter_condition: str = Field(default=UNDEFINED)
    enabled: bool = Field(default=UNDEFINED)
    input_mapping: Optional[InputMapping] = Field(
        default=UNDEFINED,
        description="Omit to preserve. Null restores inheritance for code bindings.",
    )
    evaluation_delay_seconds: Optional[int] = Field(
        default=UNDEFINED,
        ge=MINIMUM_EVALUATION_DELAY_SECONDS,
        le=2**31 - 1,
        description="Omit to preserve. Null resets to the server's session delay default.",
    )

    @model_validator(mode="after")
    def require_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class ProjectEvaluator(V1RoutesBaseModel):
    project_evaluator_id: str
    project_id: str
    evaluator_id: str
    evaluator_kind: Literal["LLM", "CODE", "BUILTIN"]
    trace_project_id: str
    name: Identifier
    evaluation_target: EvaluationTarget
    sampling_rate: float
    filter_condition: str
    enabled: bool
    input_mapping: Optional[InputMapping]
    evaluation_delay_seconds: int


class PatchLLMEvaluatorRequest(EvaluatorRequest):
    type: Literal["llm"]
    name: Identifier = Field(default=UNDEFINED)
    description: Optional[str] = Field(default=UNDEFINED)
    prompt_version: PromptVersionData = Field(default=UNDEFINED)
    prompt_version_id: str = Field(default=UNDEFINED)
    output_configs: list[CategoricalAnnotationConfigData] = Field(default=UNDEFINED, min_length=1)


class PatchCodeEvaluatorRequest(EvaluatorRequest):
    type: Literal["code"]
    name: Identifier = Field(default=UNDEFINED)
    description: Optional[str] = Field(default=UNDEFINED)
    sandbox_config_id: Optional[str] = Field(default=UNDEFINED)
    input_mapping: InputMapping = Field(default=UNDEFINED)
    output_configs: list[EvaluatorOutputConfig] = Field(default=UNDEFINED)


class CodeEvaluatorVersionRequest(EvaluatorRequest):
    source_code: str


class CodeEvaluatorVersion(V1RoutesBaseModel):
    evaluator_id: str
    evaluator_version_id: str
    source_code: str
    was_created: bool


class CodeEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["code"]
    evaluator_id: str
    name: Identifier
    description: Optional[str]
    language: Language
    sandbox_config_id: Optional[str]
    input_mapping: Optional[InputMapping]
    output_configs: list[EvaluatorOutputConfig]
    evaluator_version_id: Optional[str]
    source_code: Optional[str]


class LLMEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["llm"]
    evaluator_id: str
    name: Identifier
    description: Optional[str]
    prompt_version_id: Optional[str]
    prompt_version: Optional[PromptVersionData]
    output_configs: list[CategoricalAnnotationConfigData]


class BuiltInEvaluatorDefinition(V1RoutesBaseModel):
    type: Literal["builtin"]
    evaluator_id: str
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


router = APIRouter(tags=["evaluators"])


async def _project_evaluator(request: Request, project_evaluator_id: str) -> ProjectEvaluator:
    row_id = decode_global_id(project_evaluator_id, "ProjectEvaluator")
    async with request.app.state.db.read() as session:
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


def _binding_response(row: models.ProjectEvaluator, kind: models.EvaluatorKind) -> ProjectEvaluator:
    return ProjectEvaluator(
        project_evaluator_id=encode_global_id("ProjectEvaluator", row.id),
        project_id=encode_global_id("Project", row.project_id),
        evaluator_id=encode_global_id(
            {"LLM": "LLMEvaluator", "CODE": "CodeEvaluator", "BUILTIN": "BuiltInEvaluator"}[kind],
            row.evaluator_id,
        ),
        evaluator_kind=kind,
        trace_project_id=encode_global_id("Project", row.trace_project_id),
        name=row.name,
        evaluation_target=EvaluationTarget(row.evaluation_target),
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
    responses=add_errors_to_responses([404, 409, 422, 507]),
)
async def create_project_evaluator(
    request: Request, project_identifier: str, body: CreateProjectEvaluatorRequest
) -> ResponseBody[ProjectEvaluator]:
    """Create an evaluator and binding atomically, or bind an existing code evaluator.

    SPAN runs on matching sampled spans. SESSION evaluates once after its first quiet
    period. TRACE configurations are stored but are not scheduled.
    """
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            project = await get_project_by_identifier(session, project_identifier)
            project_id = GlobalID("Project", str(project.id))
        definition = body.evaluator
        context = evaluator_service_context(request)
        if isinstance(definition, ExistingCodeEvaluator):
            row = await service.add_project_code_evaluator(
                context,
                service.AddProjectCodeEvaluatorInput(
                    project_id=project_id,
                    name=body.name,
                    evaluation_target=body.evaluation_target,
                    sampling_rate=body.sampling_rate,
                    filter_condition=body.filter_condition,
                    enabled=body.enabled,
                    input_mapping=body.input_mapping,
                    evaluation_delay_seconds=body.evaluation_delay_seconds,
                    evaluator_id=GlobalID.from_id(definition.evaluator_id),
                ),
            )
        elif isinstance(definition, NewCodeEvaluator):
            row = await service.create_project_code_evaluator(
                context,
                service.CreateProjectCodeEvaluatorInput(
                    project_id=project_id,
                    name=body.name,
                    evaluation_target=body.evaluation_target,
                    sampling_rate=body.sampling_rate,
                    filter_condition=body.filter_condition,
                    enabled=body.enabled,
                    input_mapping=body.input_mapping,
                    evaluation_delay_seconds=body.evaluation_delay_seconds,
                    source_code=definition.source_code,
                    language=definition.language,
                    sandbox_config_id=GlobalID.from_id(definition.sandbox_config_id),
                    evaluator_input_mapping=definition.input_mapping,
                    description=definition.description,
                    output_configs=output_configs_to_db(definition.output_configs),
                ),
            )
        else:
            assert body.input_mapping is not None
            row = await service.create_project_llm_evaluator(
                context,
                service.CreateProjectLLMEvaluatorInput(
                    project_id=project_id,
                    name=body.name,
                    evaluation_target=body.evaluation_target,
                    sampling_rate=body.sampling_rate,
                    filter_condition=body.filter_condition,
                    enabled=body.enabled,
                    input_mapping=body.input_mapping,
                    evaluation_delay_seconds=body.evaluation_delay_seconds,
                    prompt_version=definition.prompt_version.to_orm(),
                    prompt_version_id=GlobalID.from_id(definition.prompt_version_id)
                    if definition.prompt_version_id
                    else None,
                    description=definition.description,
                    output_configs=output_configs_to_db(definition.output_configs),
                ),
            )
        return ResponseBody(
            data=await _project_evaluator(request, encode_global_id("ProjectEvaluator", row.id))
        )


@router.get(
    "/projects/{project_identifier}/evaluators",
    operation_id="getProjectEvaluators",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 422]),
)
async def get_project_evaluators(
    request: Request,
    project_identifier: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> PaginatedResponseBody[ProjectEvaluator]:
    """List evaluator bindings in a project, accepting its name or GlobalID."""
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
            return PaginatedResponseBody(
                data=[_binding_response(*row) for row in rows[:limit]], next_cursor=next_cursor
            )


@router.get(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="getProjectEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 422]),
)
async def get_project_evaluator(
    request: Request, project_evaluator_id: str
) -> ResponseBody[ProjectEvaluator]:
    """Fetch binding settings. Use evaluator_id to retrieve the shared definition."""
    with evaluator_api_errors():
        return ResponseBody(data=await _project_evaluator(request, project_evaluator_id))


@router.patch(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="patchProjectEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 409, 422, 507]),
)
async def patch_project_evaluator(
    request: Request, project_evaluator_id: str, body: PatchProjectEvaluatorRequest
) -> ResponseBody[ProjectEvaluator]:
    """Update only binding settings. Evaluation target and evaluator kind are immutable."""
    with evaluator_api_errors():
        await service.patch_project_evaluator(
            evaluator_service_context(request),
            GlobalID.from_id(project_evaluator_id),
            service.ProjectEvaluatorPatch(
                **{name: getattr(body, name) for name in body.model_fields_set}
            ),
        )
        return ResponseBody(data=await _project_evaluator(request, project_evaluator_id))


@router.delete(
    "/project_evaluators/{project_evaluator_id}",
    operation_id="deleteProjectEvaluator",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([422]),
)
async def delete_project_evaluator(
    request: Request,
    project_evaluator_id: str,
    delete_associated_prompt: bool = Query(default=True),
) -> Response:
    """Delete a binding and its evaluator traces, collecting unreferenced definitions."""
    with evaluator_api_errors():
        await service.delete_project_evaluators(
            evaluator_service_context(request),
            service.DeleteProjectEvaluatorsInput(
                project_evaluator_ids=[GlobalID.from_id(project_evaluator_id)],
                delete_associated_prompt=delete_associated_prompt,
            ),
        )
        return Response(status_code=204)


@router.delete(
    "/project_evaluators",
    operation_id="deleteProjectEvaluators",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([422]),
)
async def delete_project_evaluators(
    request: Request,
    project_evaluator_ids: list[str] = Query(min_length=1, max_length=1000),
    delete_associated_prompt: bool = Query(default=True),
) -> Response:
    """Delete explicit bindings atomically. Repeat the project_evaluator_ids query parameter.

    Associated trace projects are deleted. Shared definitions remain while referenced
    by any project or dataset. Missing bindings are ignored for idempotency.
    """
    with evaluator_api_errors():
        await service.delete_project_evaluators(
            evaluator_service_context(request),
            service.DeleteProjectEvaluatorsInput(
                project_evaluator_ids=[GlobalID.from_id(value) for value in project_evaluator_ids],
                delete_associated_prompt=delete_associated_prompt,
            ),
        )
        return Response(status_code=204)


async def _evaluator_definition(request: Request, evaluator_id: str) -> EvaluatorDefinition:
    global_id = GlobalID.from_id(evaluator_id)
    if global_id.type_name == "BuiltInEvaluator":
        row_id = decode_global_id(evaluator_id, "BuiltInEvaluator")
        async with request.app.state.db.read() as session:
            builtin = await session.get(models.BuiltinEvaluator, row_id)
            if builtin is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            evaluator_class = get_builtin_evaluator_by_key(builtin.key)
            if evaluator_class is None:
                raise NotFound(f"Built-in evaluator class not found for key: {builtin.key}")
            instance = evaluator_class()
            return BuiltInEvaluatorDefinition(
                type="builtin",
                evaluator_id=evaluator_id,
                name=Identifier(evaluator_class.name),
                description=evaluator_class.description,
                key=builtin.key,
                input_schema=instance.input_schema,
                output_configs=output_configs_from_db(list(instance.output_configs)),
            )
    if global_id.type_name == "CodeEvaluator":
        row_id = decode_global_id(evaluator_id, "CodeEvaluator")
        async with request.app.state.db.read() as session:
            pair = await code_evaluator_with_latest_version(session, row_id)
            if pair is None:
                raise NotFound(f"Evaluator not found: {evaluator_id}")
            row, version = pair
            return CodeEvaluatorDefinition(
                type="code",
                evaluator_id=evaluator_id,
                name=row.name,
                description=row.description,
                language=Language(row.language),
                sandbox_config_id=encode_global_id("SandboxConfig", row.sandbox_config_id)
                if row.sandbox_config_id
                else None,
                input_mapping=row.input_mapping,
                output_configs=output_configs_from_db(row.output_configs),
                evaluator_version_id=encode_global_id("CodeEvaluatorVersion", version.id)
                if version
                else None,
                source_code=version.source_code if version else None,
            )
    row_id = decode_global_id(evaluator_id, "LLMEvaluator")
    async with request.app.state.db.read() as session:
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
            evaluator_id=evaluator_id,
            name=llm.name,
            description=llm.description,
            output_configs=[
                CategoricalAnnotationConfigData.model_validate(config.model_dump())
                for config in llm.output_configs
            ],
            prompt_version_id=encode_global_id("PromptVersion", prompt.id) if prompt else None,
            prompt_version=prompt_version_data_from_orm(prompt) if prompt else None,
        )


@router.get(
    "/evaluators/{evaluator_id}",
    operation_id="getEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 422]),
)
async def get_evaluator(request: Request, evaluator_id: str) -> EvaluatorDefinitionResponseBody:
    """Read a shared LLM, code, or read-only built-in evaluator definition."""
    with evaluator_api_errors():
        return EvaluatorDefinitionResponseBody(
            data=await _evaluator_definition(request, evaluator_id)
        )


@router.patch(
    "/evaluators/{evaluator_id}",
    operation_id="patchEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 409, 422, 507]),
)
async def patch_evaluator(
    request: Request,
    evaluator_id: str,
    body: Annotated[
        Union[PatchLLMEvaluatorRequest, PatchCodeEvaluatorRequest], Field(discriminator="type")
    ],
) -> EvaluatorDefinitionResponseBody:
    """Edit a shared definition; changes apply to every project and dataset binding.

    Use the versions endpoint to append code. Omitted fields retain their values.
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
            if "prompt_version" in fields:
                values["prompt_version"] = body.prompt_version.to_orm()
            await service.patch_llm_evaluator(
                evaluator_service_context(request),
                GlobalID.from_id(evaluator_id),
                service.LLMEvaluatorPatch(**values),
            )
        return EvaluatorDefinitionResponseBody(
            data=await _evaluator_definition(request, evaluator_id)
        )


@router.post(
    "/evaluators/{evaluator_id}/versions",
    operation_id="createEvaluatorVersion",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses={
        **add_errors_to_responses([404, 409, 422, 507]),
        200: {
            "model": ResponseBody[CodeEvaluatorVersion],
            "description": "Source matches the current version",
        },
    },
)
async def create_evaluator_version(
    request: Request, response: Response, evaluator_id: str, body: CodeEvaluatorVersionRequest
) -> ResponseBody[CodeEvaluatorVersion]:
    """Append immutable code, returning 200 when it matches the current version."""
    with evaluator_api_errors():
        _, version, was_created = await service.create_code_evaluator_version(
            evaluator_service_context(request),
            service.CreateCodeEvaluatorVersionInput(
                code_evaluator_id=GlobalID.from_id(evaluator_id),
                source_code=body.source_code,
            ),
        )
        if not was_created:
            response.status_code = 200
        return ResponseBody(
            data=CodeEvaluatorVersion(
                evaluator_id=evaluator_id,
                evaluator_version_id=encode_global_id("CodeEvaluatorVersion", version.id),
                source_code=version.source_code,
                was_created=was_created,
            )
        )
