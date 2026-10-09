"""Create, list, update, and delete project evaluator bindings."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.models import MINIMUM_EVALUATION_DELAY_SECONDS
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.helpers import project_evaluator_service as project_service
from phoenix.server.api.routers.v1.evaluator_common import (
    EvaluatorRequest,
    decode_global_id,
    encode_global_id,
    evaluator_api_errors,
    evaluator_error_responses,
    evaluator_service_context,
    parse_global_id,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemDetailsRoute
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    get_project_by_identifier,
)
from phoenix.server.authorization import is_not_locked

router = APIRouter(tags=["evaluators"], route_class=ProblemDetailsRoute)


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
            "Null uses the evaluator's mapping. LLM evaluators have none, so only "
            "variables rooted at input, output, or metadata bind (for example "
            "{{metadata.turns}}); anything else needs input_mapping."
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
        row = await project_service.add_project_evaluator(
            evaluator_service_context(request),
            project_service.AddProjectCodeEvaluatorInput(
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
        await project_service.patch_project_evaluator(
            evaluator_service_context(request),
            parse_global_id(project_evaluator_id),
            project_service.ProjectEvaluatorPatch(
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

    The binding's trace project and recorded traces are deleted. Its evaluator definition and
    prompt are kept. Delete a definition that nothing binds with
    DELETE /v1/evaluators/{evaluator_id}.
    """
    with evaluator_api_errors():
        await project_service.detach_project_evaluators(
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
    any change. Each deleted binding's trace project and recorded traces are removed; evaluator
    definitions and prompts are kept.
    """
    with evaluator_api_errors():
        async with request.app.state.db() as session:
            project = await get_project_by_identifier(session, project_identifier)
        await project_service.detach_project_evaluators(
            evaluator_service_context(request),
            [parse_global_id(value) for value in project_evaluator_id],
            project_id=GlobalID("Project", str(project.id)),
        )
        return Response(status_code=204)
