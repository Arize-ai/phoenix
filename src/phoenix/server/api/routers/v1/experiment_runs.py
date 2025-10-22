from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import ExperimentRunOutput
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.dml_event import ExperimentRunInsertEvent

from .models import V1RoutesBaseModel
from .utils import PaginatedResponseBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=True)


class ExperimentRun(V1RoutesBaseModel):
    dataset_example_id: str = Field(
        description="The ID of the dataset example used in the experiment run"
    )
    output: Any = Field(description="The output of the experiment task")
    repetition_number: int = Field(description="The repetition number of the experiment run", gt=0)
    start_time: datetime = Field(description="The start time of the experiment run")
    end_time: datetime = Field(description="The end time of the experiment run")
    trace_id: Optional[str] = Field(
        default=None, description="The ID of the corresponding trace (if one exists)"
    )
    error: Optional[str] = Field(
        default=None,
        description="Optional error message if the experiment run encountered an error",
    )


class CreateExperimentRunRequestBody(ExperimentRun):
    pass


class CreateExperimentRunResponseBodyData(V1RoutesBaseModel):
    id: str = Field(description="The ID of the newly created experiment run")


class CreateExperimentRunResponseBody(ResponseBody[CreateExperimentRunResponseBodyData]):
    pass


@router.post(
    "/experiments/{experiment_id}/runs",
    dependencies=[Depends(is_not_locked)],
    operation_id="createExperimentRun",
    summary="Create run for an experiment",
    response_description="Experiment run created successfully",
    responses=add_errors_to_responses(
        [
            {
                "status_code": 404,
                "description": "Experiment or dataset example not found",
            },
            {
                "status_code": 409,
                "description": "This experiment run has already been submitted",
            },
        ]
    ),
)
async def create_experiment_run(
    request: Request, experiment_id: str, request_body: CreateExperimentRunRequestBody
) -> CreateExperimentRunResponseBody:
    experiment_gid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_gid} does not exist",
            status_code=404,
        )

    example_gid = GlobalID.from_id(request_body.dataset_example_id)
    try:
        dataset_example_id = from_global_id_with_expected_type(example_gid, "DatasetExample")
    except ValueError:
        raise HTTPException(
            detail=f"DatasetExample with ID {example_gid} does not exist",
            status_code=404,
        )

    trace_id = request_body.trace_id
    task_output = request_body.output
    repetition_number = request_body.repetition_number
    start_time = request_body.start_time
    end_time = request_body.end_time
    error = request_body.error

    async with request.app.state.db() as session:
        exp_run = models.ExperimentRun(
            experiment_id=experiment_rowid,
            dataset_example_id=dataset_example_id,
            trace_id=trace_id,
            output=ExperimentRunOutput(task_output=task_output),
            repetition_number=repetition_number,
            start_time=start_time,
            end_time=end_time,
            error=error,
        )
        try:
            session.add(exp_run)
            await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                detail="This experiment run has already been submitted",
                status_code=409,
            )
    request.state.event_queue.put(ExperimentRunInsertEvent((exp_run.id,)))
    run_gid = GlobalID("ExperimentRun", str(exp_run.id))
    return CreateExperimentRunResponseBody(
        data=CreateExperimentRunResponseBodyData(id=str(run_gid))
    )


class ExperimentRunResponse(ExperimentRun):
    id: str = Field(description="The ID of the experiment run")
    experiment_id: str = Field(description="The ID of the experiment")


class ListExperimentRunsResponseBody(PaginatedResponseBody[ExperimentRunResponse]):
    pass


@router.get(
    "/experiments/{experiment_id}/runs",
    operation_id="listExperimentRuns",
    summary="List runs for an experiment",
    description="Retrieve a paginated list of runs for an experiment",
    response_description="Experiment runs retrieved successfully",
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid cursor format"},
        ]
    ),
)
async def list_experiment_runs(
    request: Request,
    experiment_id: str,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded experiment run ID)",
    ),
    limit: Optional[int] = Query(
        default=None,
        description="The max number of experiment runs to return at a time. "
        "If not specified, returns all results.",
        gt=0,
    ),
) -> ListExperimentRunsResponseBody:
    try:
        experiment_gid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_gid} does not exist",
            status_code=404,
        )

    stmt = (
        select(models.ExperimentRun)
        .filter_by(experiment_id=experiment_rowid)
        .order_by(models.ExperimentRun.id.desc())
    )

    if cursor:
        try:
            cursor_id = GlobalID.from_id(cursor).node_id
            stmt = stmt.where(models.ExperimentRun.id <= int(cursor_id))
        except ValueError:
            raise HTTPException(
                detail=f"Invalid cursor format: {cursor}",
                status_code=422,
            )

    # Apply limit only if specified for pagination
    if limit is not None:
        stmt = stmt.limit(limit + 1)

    async with request.app.state.db() as session:
        experiment_runs = (await session.scalars(stmt)).all()

    if not experiment_runs:
        return ListExperimentRunsResponseBody(next_cursor=None, data=[])

    next_cursor = None
    # Only check for next cursor if limit was specified
    if limit is not None and len(experiment_runs) == limit + 1:
        last_run = experiment_runs[-1]
        next_cursor = str(GlobalID("ExperimentRun", str(last_run.id)))
        experiment_runs = experiment_runs[:-1]

    runs = []
    for exp_run in experiment_runs:
        run_gid = GlobalID("ExperimentRun", str(exp_run.id))
        experiment_gid = GlobalID("Experiment", str(exp_run.experiment_id))
        example_gid = GlobalID("DatasetExample", str(exp_run.dataset_example_id))
        runs.append(
            ExperimentRunResponse(
                start_time=exp_run.start_time,
                end_time=exp_run.end_time,
                experiment_id=str(experiment_gid),
                dataset_example_id=str(example_gid),
                repetition_number=exp_run.repetition_number,
                output=exp_run.output.get("task_output"),
                error=exp_run.error,
                id=str(run_gid),
                trace_id=exp_run.trace_id,
            )
        )
    return ListExperimentRunsResponseBody(data=runs, next_cursor=next_cursor)
