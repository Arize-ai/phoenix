"""Read and update shared evaluator definitions and immutable code versions."""

from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import code_evaluator_with_latest_version
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.routers.v1.annotation_config_models import CategoricalAnnotationConfigData
from phoenix.server.api.routers.v1.evaluator_common import (
    EvaluatorOutputConfig,
    EvaluatorRequest,
    Language,
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
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.authorization import is_not_locked


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


EvaluatorDefinition = Annotated[
    Union[CodeEvaluatorDefinition, LLMEvaluatorDefinition], Field(discriminator="type")
]


class EvaluatorDefinitionResponseBody(ResponseBody[EvaluatorDefinition]):
    pass


router = APIRouter(tags=["evaluators"])


async def _evaluator_definition(request: Request, evaluator_id: str) -> EvaluatorDefinition:
    global_id = GlobalID.from_id(evaluator_id)
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
    """Read the shared definition, including its current code or pinned prompt version."""
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
