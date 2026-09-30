"""Manage dataset-specific bindings to shared LLM, code, and built-in evaluators."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
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
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_error_responses,
    evaluator_service_context,
    output_configs_from_db,
    output_configs_to_db,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemDetailsRoute
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    get_dataset_by_identifier,
)
from phoenix.server.authorization import is_not_locked


class CreateDatasetEvaluatorRequest(EvaluatorRequest):
    name: Identifier = Field(description="Unique among this dataset's evaluators.")
    evaluator_id: str = Field(
        description=(
            "GlobalID of the LLM, code, or built-in evaluator definition to run. Create a "
            "definition through POST /v1/evaluators first."
        )
    )
    input_mapping: InputMapping
    description: Optional[str] = Field(
        default=None, description="Binding override. Null inherits the shared description."
    )
    output_configs: Optional[list[EvaluatorOutputConfig]] = Field(
        default=None,
        min_length=1,
        description=(
            "Null inherits the shared output configs. An override needs at least one config; "
            "an LLM binding's configs must be categorical and match the prompt's tool schema."
        ),
    )


class PatchDatasetEvaluatorRequest(EvaluatorRequest):
    model_config = ConfigDict(json_schema_extra={"minProperties": 1})

    name: Identifier = Field(default=UNDEFINED)
    input_mapping: InputMapping = Field(default=UNDEFINED)
    description: Optional[str] = Field(
        default=UNDEFINED, description="Omit to preserve; null restores inheritance."
    )
    output_configs: Optional[list[EvaluatorOutputConfig]] = Field(
        default=UNDEFINED,
        min_length=1,
        description=(
            "Omit to preserve; null restores inheritance. An override needs at least one "
            "config; an LLM binding's configs must be categorical and match the prompt's tool "
            "schema."
        ),
    )

    @model_validator(mode="after")
    def require_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class DatasetEvaluator(V1RoutesBaseModel):
    id: str
    dataset_id: str
    evaluator_id: str
    evaluator_type: Literal["llm", "code", "builtin"]
    trace_project_id: str
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str] = Field(
        description=(
            "This binding's description override; null means it inherits the evaluator's "
            "description."
        )
    )
    output_configs: Optional[list[EvaluatorOutputConfig]] = Field(
        min_length=1,
        description=(
            "This binding's output config override; null means it inherits the evaluator's "
            "output configs."
        ),
    )


class DatasetEvaluatorResponseBody(ResponseBody[DatasetEvaluator]):
    pass


class DatasetEvaluatorsResponseBody(PaginatedResponseBody[DatasetEvaluator]):
    pass


router = APIRouter(tags=["evaluators"], route_class=ProblemDetailsRoute)


def _binding_response(
    row: models.DatasetEvaluators, kind: models.EvaluatorKind
) -> DatasetEvaluator:
    return DatasetEvaluator(
        id=encode_global_id("DatasetEvaluator", row.id),
        dataset_id=encode_global_id("Dataset", row.dataset_id),
        evaluator_id=encode_global_id(
            {"LLM": "LLMEvaluator", "CODE": "CodeEvaluator", "BUILTIN": "BuiltInEvaluator"}[kind],
            row.evaluator_id,
        ),
        evaluator_type={"LLM": "llm", "CODE": "code", "BUILTIN": "builtin"}[kind],
        trace_project_id=encode_global_id("Project", row.project_id),
        name=row.name,
        input_mapping=row.input_mapping,
        description=row.description,
        output_configs=output_configs_from_db(list(row.output_configs))
        if row.output_configs is not None
        else None,
    )


async def _dataset_evaluator(session: AsyncSession, dataset_evaluator_id: str) -> DatasetEvaluator:
    """Build a binding from the given session; reads after a write must use the writer."""
    row_id = decode_global_id(dataset_evaluator_id, "DatasetEvaluator")
    pair = (
        await session.execute(
            select(models.DatasetEvaluators, models.Evaluator.kind)
            .join(models.Evaluator, models.Evaluator.id == models.DatasetEvaluators.evaluator_id)
            .where(models.DatasetEvaluators.id == row_id)
        )
    ).one_or_none()
    if pair is None:
        raise NotFound(f"Dataset evaluator not found: {dataset_evaluator_id}")
    return _binding_response(*pair)


async def _written_dataset_evaluator(
    request: Request, dataset_evaluator_id: str
) -> DatasetEvaluator:
    """Read back a binding this request just wrote, through the writer."""
    async with request.app.state.db() as session:
        return await _dataset_evaluator(session, dataset_evaluator_id)


@router.post(
    "/datasets/{dataset_identifier}/evaluators",
    operation_id="createDatasetEvaluator",
    status_code=201,
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def create_dataset_evaluator(
    request: Request, dataset_identifier: str, body: CreateDatasetEvaluatorRequest
) -> DatasetEvaluatorResponseBody:
    """Bind an existing evaluator definition to a dataset.

    The dataset identifier is decoded as a GlobalID first and otherwise treated as a name.
    Binding descriptions and output configurations override the shared definition; null
    inherits it. Input mappings are always dataset-specific. A name the dataset already uses
    is refused with 409 `already_exists` and that binding's `existing_id`. This registers an
    evaluator and does not run an experiment.
    """
    with evaluator_api_errors():
        # The writer sees a dataset created just before this request; a replica may not.
        async with request.app.state.db() as session:
            dataset = await get_dataset_by_identifier(session, dataset_identifier)
            dataset_id = GlobalID("Dataset", str(dataset.id))
        context = evaluator_service_context(request)
        configs = (
            output_configs_to_db(body.output_configs) if body.output_configs is not None else None
        )
        evaluator_id = GlobalID.from_id(body.evaluator_id)
        row: models.DatasetEvaluators
        if evaluator_id.type_name == "LLMEvaluator":
            row = await service.create_dataset_llm_binding(
                context,
                service.CreateDatasetLLMBindingInput(
                    dataset_id=dataset_id,
                    evaluator_id=evaluator_id,
                    name=body.name,
                    input_mapping=body.input_mapping,
                    description=body.description,
                    output_configs=configs,
                ),
            )
        elif evaluator_id.type_name == "CodeEvaluator":
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
            raise BadRequest(f"Not an evaluator id: {body.evaluator_id}")
        return DatasetEvaluatorResponseBody(
            data=await _written_dataset_evaluator(
                request, encode_global_id("DatasetEvaluator", row.id)
            )
        )


@router.get(
    "/datasets/{dataset_identifier}/evaluators",
    operation_id="getDatasetEvaluators",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def get_dataset_evaluators(
    request: Request,
    dataset_identifier: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> DatasetEvaluatorsResponseBody:
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
            return DatasetEvaluatorsResponseBody(
                data=[_binding_response(*row) for row in rows[:limit]], next_cursor=next_cursor
            )


@router.get(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="getDatasetEvaluator",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def get_dataset_evaluator(
    request: Request, dataset_evaluator_id: str
) -> DatasetEvaluatorResponseBody:
    """Fetch binding settings. Null description/output configs inherit the shared definition."""
    with evaluator_api_errors():
        async with request.app.state.db.read() as session:
            return DatasetEvaluatorResponseBody(
                data=await _dataset_evaluator(session, dataset_evaluator_id)
            )


@router.patch(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="patchDatasetEvaluator",
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 409, 422, 507]),
)
async def patch_dataset_evaluator(
    request: Request, dataset_evaluator_id: str, body: PatchDatasetEvaluatorRequest
) -> DatasetEvaluatorResponseBody:
    """Update only the binding. Dataset and evaluator references are immutable.

    LLM output overrides must remain consistent with the prompt the evaluator runs, and a
    later change to that prompt is refused while it would invalidate them. Use
    /evaluators/{evaluator_id} to modify a shared definition instead.
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
        return DatasetEvaluatorResponseBody(
            data=await _written_dataset_evaluator(request, dataset_evaluator_id)
        )


@router.delete(
    "/dataset_evaluators/{dataset_evaluator_id}",
    operation_id="deleteDatasetEvaluator",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([422]),
)
async def delete_dataset_evaluator(request: Request, dataset_evaluator_id: str) -> Response:
    """Delete a binding; a missing binding is ignored.

    The evaluator definition, its prompt, and the binding's trace project are kept: delete a
    definition that nothing binds through DELETE /v1/evaluators/{evaluator_id}.
    """
    with evaluator_api_errors():
        await service.detach_dataset_evaluators(
            evaluator_service_context(request), [GlobalID.from_id(dataset_evaluator_id)]
        )
        return Response(status_code=204)


@router.delete(
    "/datasets/{dataset_identifier}/evaluators",
    operation_id="deleteDatasetEvaluators",
    status_code=204,
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
    responses=evaluator_error_responses([404, 422]),
)
async def delete_dataset_evaluators(
    request: Request,
    dataset_identifier: str,
    dataset_evaluator_id: list[str] = Query(
        min_length=1,
        max_length=1000,
        description="GlobalIDs of this dataset's bindings to delete; repeat for each.",
    ),
) -> Response:
    """Delete up to 1000 of a dataset's bindings in one transaction.

    Missing bindings are ignored; a binding of another dataset is refused with 422 before
    any change. Definitions, prompts, and trace projects are kept.
    """
    with evaluator_api_errors():
        async with request.app.state.db() as session:
            dataset = await get_dataset_by_identifier(session, dataset_identifier)
        await service.detach_dataset_evaluators(
            evaluator_service_context(request),
            [GlobalID.from_id(value) for value in dataset_evaluator_id],
            dataset_id=GlobalID("Dataset", str(dataset.id)),
        )
        return Response(status_code=204)
