"""Manage dataset-specific bindings to shared LLM, code, and built-in evaluators."""

from typing import Annotated, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field, model_validator
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers import dataset_evaluator_service as service
from phoenix.server.api.routers.v1.evaluator_common import (
    EvaluatorOutputConfig,
    EvaluatorRequest,
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
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    get_dataset_by_identifier,
)
from phoenix.server.authorization import is_not_locked


class ExistingDatasetEvaluator(EvaluatorRequest):
    type: Literal["reference"]
    evaluator_id: str = Field(description="GlobalID of an existing code or built-in evaluator.")


class CreateDatasetEvaluatorRequest(EvaluatorRequest):
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str] = Field(
        default=None, description="Binding override. Null inherits the shared description."
    )
    output_configs: Optional[list[EvaluatorOutputConfig]] = Field(
        default=None,
        description="Null inherits shared output configs; [] overrides them with no configs.",
    )
    evaluator: Annotated[
        Union[NewLLMEvaluator, NewCodeEvaluator, ExistingDatasetEvaluator],
        Field(discriminator="type"),
    ]


class PatchDatasetEvaluatorRequest(EvaluatorRequest):
    name: Identifier = Field(default=UNDEFINED)
    input_mapping: InputMapping = Field(default=UNDEFINED)
    description: Optional[str] = Field(
        default=UNDEFINED, description="Omit to preserve; null restores inheritance."
    )
    output_configs: Optional[list[EvaluatorOutputConfig]] = Field(
        default=UNDEFINED,
        description="Omit to preserve; null restores inheritance; [] overrides with no configs.",
    )

    @model_validator(mode="after")
    def require_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class DatasetEvaluator(V1RoutesBaseModel):
    dataset_evaluator_id: str
    dataset_id: str
    evaluator_id: str
    evaluator_kind: Literal["LLM", "CODE", "BUILTIN"]
    trace_project_id: str
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str]
    output_configs: Optional[list[EvaluatorOutputConfig]]


router = APIRouter(tags=["evaluators"])


def _binding_response(
    row: models.DatasetEvaluators, kind: models.EvaluatorKind
) -> DatasetEvaluator:
    return DatasetEvaluator(
        dataset_evaluator_id=encode_global_id("DatasetEvaluator", row.id),
        dataset_id=encode_global_id("Dataset", row.dataset_id),
        evaluator_id=encode_global_id(
            {"LLM": "LLMEvaluator", "CODE": "CodeEvaluator", "BUILTIN": "BuiltInEvaluator"}[kind],
            row.evaluator_id,
        ),
        evaluator_kind=kind,
        trace_project_id=encode_global_id("Project", row.project_id),
        name=row.name,
        input_mapping=row.input_mapping,
        description=row.description,
        output_configs=output_configs_from_db(list(row.output_configs))
        if row.output_configs is not None
        else None,
    )


async def _dataset_evaluator(request: Request, dataset_evaluator_id: str) -> DatasetEvaluator:
    row_id = decode_global_id(dataset_evaluator_id, "DatasetEvaluator")
    async with request.app.state.db.read() as session:
        pair = (
            await session.execute(
                select(models.DatasetEvaluators, models.Evaluator.kind)
                .join(
                    models.Evaluator, models.Evaluator.id == models.DatasetEvaluators.evaluator_id
                )
                .where(models.DatasetEvaluators.id == row_id)
            )
        ).one_or_none()
        if pair is None:
            raise NotFound(f"Dataset evaluator not found: {dataset_evaluator_id}")
        return _binding_response(*pair)


@router.post(
    "/datasets/{dataset_identifier}/evaluators",
    operation_id="createDatasetEvaluator",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 409, 422, 507]),
)
async def create_dataset_evaluator(
    request: Request, dataset_identifier: str, body: CreateDatasetEvaluatorRequest
) -> ResponseBody[DatasetEvaluator]:
    """Create a definition and binding atomically, or bind existing code/built-in evaluators.

    Dataset identifiers accept names or GlobalIDs. Binding descriptions and output
    configurations override the shared definition; null inherits it. Input mappings
    are always dataset-specific. This registers an evaluator and does not run an experiment.
    """
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            dataset = await get_dataset_by_identifier(session, dataset_identifier)
            dataset_id = GlobalID("Dataset", str(dataset.id))
        context = evaluator_service_context(request)
        definition = body.evaluator
        configs = (
            output_configs_to_db(body.output_configs) if body.output_configs is not None else None
        )
        if isinstance(definition, NewLLMEvaluator):
            row = await service.create_dataset_llm_evaluator(
                context,
                service.CreateDatasetLLMEvaluatorInput(
                    dataset_id=dataset_id,
                    name=body.name,
                    input_mapping=body.input_mapping,
                    description=definition.description,
                    prompt_version=definition.prompt_version.to_orm(),
                    prompt_version_id=GlobalID.from_id(definition.prompt_version_id)
                    if definition.prompt_version_id
                    else None,
                    output_configs=output_configs_to_db(definition.output_configs),
                    binding_description=body.description,
                    binding_output_configs=configs,
                ),
            )
        elif isinstance(definition, NewCodeEvaluator):
            row = await service.create_dataset_inline_code_evaluator(
                context,
                service.CreateDatasetInlineCodeEvaluatorInput(
                    dataset_id=dataset_id,
                    name=body.name,
                    input_mapping=body.input_mapping,
                    description=body.description,
                    output_configs=configs,
                    evaluator_description=definition.description,
                    evaluator_output_configs=output_configs_to_db(definition.output_configs),
                    evaluator_input_mapping=definition.input_mapping,
                    source_code=definition.source_code,
                    language=definition.language.to_orm(),
                    sandbox_config_id=GlobalID.from_id(definition.sandbox_config_id),
                ),
            )
        else:
            evaluator_id = GlobalID.from_id(definition.evaluator_id)
            if evaluator_id.type_name == "CodeEvaluator":
                row = await service.create_dataset_code_evaluator(
                    context,
                    service.CreateDatasetCodeEvaluatorInput(
                        dataset_id=dataset_id,
                        name=body.name,
                        evaluator_id=evaluator_id,
                        input_mapping=body.input_mapping,
                        description=body.description,
                        output_configs=configs,
                    ),
                )
            elif evaluator_id.type_name == "BuiltInEvaluator":
                row = await service.create_dataset_builtin_evaluator(
                    context,
                    service.CreateDatasetBuiltinEvaluatorInput(
                        dataset_id=dataset_id,
                        name=body.name,
                        evaluator_id=evaluator_id,
                        input_mapping=body.input_mapping,
                        description=body.description,
                        output_configs=configs,
                    ),
                )
            else:
                raise BadRequest("References must identify a code or built-in evaluator")
        return ResponseBody(
            data=await _dataset_evaluator(request, encode_global_id("DatasetEvaluator", row.id))
        )


@router.get(
    "/datasets/{dataset_identifier}/evaluators",
    operation_id="getDatasetEvaluators",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 422]),
)
async def get_dataset_evaluators(
    request: Request,
    dataset_identifier: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> PaginatedResponseBody[DatasetEvaluator]:
    """List dataset bindings with their stored overrides and an opaque pagination cursor."""
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            dataset = await get_dataset_by_identifier(session, dataset_identifier)
            stmt = (
                select(models.DatasetEvaluators, models.Evaluator.kind)
                .join(
                    models.Evaluator, models.Evaluator.id == models.DatasetEvaluators.evaluator_id
                )
                .where(models.DatasetEvaluators.dataset_id == dataset.id)
                .order_by(models.DatasetEvaluators.id.desc())
            )
            if cursor is not None:
                stmt = stmt.where(
                    models.DatasetEvaluators.id <= decode_global_id(cursor, "DatasetEvaluator")
                )
            rows = (await session.execute(stmt.limit(limit + 1))).all()
            next_cursor = (
                encode_global_id("DatasetEvaluator", rows[-1][0].id) if len(rows) > limit else None
            )
            return PaginatedResponseBody(
                data=[_binding_response(*row) for row in rows[:limit]], next_cursor=next_cursor
            )


@router.get(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="getDatasetEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 422]),
)
async def get_dataset_evaluator(
    request: Request, dataset_evaluator_id: str
) -> ResponseBody[DatasetEvaluator]:
    """Fetch binding settings. Null description/output configs inherit the shared definition."""
    with evaluator_api_errors():
        return ResponseBody(data=await _dataset_evaluator(request, dataset_evaluator_id))


@router.patch(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="patchDatasetEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([404, 409, 422, 507]),
)
async def patch_dataset_evaluator(
    request: Request, dataset_evaluator_id: str, body: PatchDatasetEvaluatorRequest
) -> ResponseBody[DatasetEvaluator]:
    """Update only the binding. Dataset and evaluator references are immutable.

    LLM output overrides must remain consistent with the pinned prompt's tool schema.
    Use /evaluators/{evaluator_id} to modify a shared definition instead.
    """
    with evaluator_api_errors():
        values = {name: getattr(body, name) for name in body.model_fields_set}
        if "output_configs" in values and body.output_configs is not None:
            values["output_configs"] = output_configs_to_db(body.output_configs)
        await service.patch_dataset_evaluator(
            evaluator_service_context(request),
            GlobalID.from_id(dataset_evaluator_id),
            service.DatasetEvaluatorPatch(**values),
        )
        return ResponseBody(data=await _dataset_evaluator(request, dataset_evaluator_id))


@router.delete(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="deleteDatasetEvaluator",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([422]),
)
async def delete_dataset_evaluator(
    request: Request,
    dataset_evaluator_id: str,
    delete_associated_prompt: bool = Query(default=True),
) -> Response:
    """Delete a binding and its evaluator trace project. Missing bindings are ignored."""
    with evaluator_api_errors():
        await service.delete_dataset_evaluators(
            evaluator_service_context(request),
            service.DeleteDatasetEvaluatorsInput(
                dataset_evaluator_ids=[GlobalID.from_id(dataset_evaluator_id)],
                delete_associated_prompt=delete_associated_prompt,
            ),
        )
        return Response(status_code=204)


@router.delete(
    "/dataset_evaluators",
    operation_id="deleteDatasetEvaluators",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=add_errors_to_responses([422]),
)
async def delete_dataset_evaluators(
    request: Request,
    dataset_evaluator_ids: list[str] = Query(min_length=1, max_length=1000),
    delete_associated_prompt: bool = Query(default=True),
) -> Response:
    """Delete explicit bindings atomically; repeat the dataset_evaluator_ids query parameter.

    Shared definitions remain while any project or dataset references them. Built-in
    definitions are never collected. Unreferenced associated prompts are deleted by default.
    """
    with evaluator_api_errors():
        await service.delete_dataset_evaluators(
            evaluator_service_context(request),
            service.DeleteDatasetEvaluatorsInput(
                dataset_evaluator_ids=[GlobalID.from_id(value) for value in dataset_evaluator_ids],
                delete_associated_prompt=delete_associated_prompt,
            ),
        )
        return Response(status_code=204)
