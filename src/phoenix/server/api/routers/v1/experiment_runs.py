import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import get_runs_with_incomplete_evaluations_query
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.models import ExperimentRunOutput
from phoenix.server.api.routers.v1.datasets import DatasetExample
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.dml_event import ExperimentRunInsertEvent

from .models import V1RoutesBaseModel
from .utils import PaginatedResponseBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=True)


class ExperimentRunData(V1RoutesBaseModel):
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


class CreateExperimentRunRequestBody(ExperimentRunData):
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
                "description": (
                    "Experiment run already exists with a successful result and cannot be updated"
                ),
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
        # Check if a record already exists
        existing_run = await session.scalar(
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_rowid)
            .where(models.ExperimentRun.dataset_example_id == dataset_example_id)
            .where(models.ExperimentRun.repetition_number == repetition_number)
        )

        if existing_run is not None and existing_run.error is None:
            # Record exists and has no error - reject the update
            run_gid = GlobalID("ExperimentRun", str(existing_run.id))
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Experiment run {run_gid} already exists with a successful result "
                    "and cannot be updated"
                ),
            )
        # Either no record exists, or existing record has an error - proceed with upsert
        stmt = insert_on_conflict(
            {
                "experiment_id": experiment_rowid,
                "dataset_example_id": dataset_example_id,
                "trace_id": trace_id,
                "output": ExperimentRunOutput(task_output=task_output),
                "repetition_number": repetition_number,
                "start_time": start_time,
                "end_time": end_time,
                "error": error,
            },
            table=models.ExperimentRun,
            dialect=request.app.state.db.dialect,
            unique_by=["experiment_id", "dataset_example_id", "repetition_number"],
            on_conflict=OnConflict.DO_UPDATE,
        ).returning(models.ExperimentRun.id)
        id_ = await session.scalar(stmt)

    request.state.event_queue.put(ExperimentRunInsertEvent((id_,)))
    run_gid = GlobalID("ExperimentRun", str(id_))
    return CreateExperimentRunResponseBody(
        data=CreateExperimentRunResponseBodyData(id=str(run_gid))
    )


class ExperimentRun(ExperimentRunData):
    id: str = Field(description="The ID of the experiment run")
    experiment_id: str = Field(description="The ID of the experiment")


class ListExperimentRunsResponseBody(PaginatedResponseBody[ExperimentRun]):
    pass


class IncompleteExperimentEvaluation(V1RoutesBaseModel):
    """
    Information about an experiment run with incomplete evaluations
    """

    experiment_run: ExperimentRun = Field(description="The experiment run")
    dataset_example: DatasetExample = Field(description="The dataset example")
    evaluation_names: list[str] = Field(
        description="List of evaluation names that are incomplete (either missing or failed)"
    )


class GetIncompleteEvaluationsResponseBody(PaginatedResponseBody[IncompleteExperimentEvaluation]):
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
            ExperimentRun(
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


@router.get(
    "/experiments/{experiment_id}/incomplete-evaluations",
    operation_id="getIncompleteExperimentEvaluations",
    summary="Get incomplete evaluations for an experiment",
    responses=add_errors_to_responses(
        [
            {"status_code": 400, "description": "No evaluator names provided"},
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid cursor format"},
        ]
    ),
    response_description="Incomplete evaluations retrieved successfully",
)
async def get_incomplete_evaluations(
    request: Request,
    experiment_id: str,
    evaluation_name: list[str] = Query(default=[], description="Evaluation names to check"),
    cursor: Optional[str] = Query(default=None, description="Cursor for pagination"),
    limit: int = Query(
        default=50, description="Maximum number of runs with incomplete evaluations to return", gt=0
    ),
) -> GetIncompleteEvaluationsResponseBody:
    """
    Get experiment runs that have incomplete evaluations.

    Returns runs with:
    - Missing evaluations (evaluator has not been run)
    - Failed evaluations (evaluator ran but has errors)

    Args:
        experiment_id: The ID of the experiment
        evaluation_name: List of evaluation names to check (required, at least one)
        cursor: Cursor for pagination
        limit: Maximum number of results to return

    Returns:
        Paginated list of runs with incomplete evaluations
    """
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    # Parse cursor if provided
    cursor_run_rowid: Optional[int] = None
    if cursor:
        try:
            cursor_gid = GlobalID.from_id(cursor)
            cursor_run_rowid = from_global_id_with_expected_type(cursor_gid, "ExperimentRun")
        except (ValueError, AttributeError):
            raise HTTPException(
                detail=f"Invalid cursor format: {cursor}",
                status_code=422,
            )

    # Deduplicate evaluation names
    evaluation_name = list(set(name.strip() for name in evaluation_name if name.strip()))

    # Require at least one evaluation name
    if not evaluation_name:
        raise HTTPException(
            detail="At least one evaluation_name must be provided",
            status_code=400,
        )

    # Validate evaluation names - reject null bytes which are invalid in PostgreSQL
    for name in evaluation_name:
        if "\x00" in name:
            raise HTTPException(
                detail="Invalid evaluation name: null bytes are not allowed",
                status_code=400,
            )

    async with request.app.state.db() as session:
        # Verify experiment exists
        experiment_result = await session.execute(
            select(models.Experiment).filter_by(id=experiment_rowid)
        )
        experiment = experiment_result.scalar()
        if not experiment:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=404,
            )

        # Query for runs with incomplete evaluations in a single query
        # This fetches runs, revisions, and annotations together to minimize round-trips
        # A run has incomplete evaluations if:
        # 1. It's missing an annotation for any of the requested evaluators
        # 2. It has a failed annotation (error IS NOT NULL) for any evaluator

        # Get dialect for SQL generation
        dialect = request.app.state.db.dialect

        # Single query: Get runs with incomplete evaluations + their revisions + annotations
        combined_query = get_runs_with_incomplete_evaluations_query(
            experiment_rowid,
            evaluation_name,
            dialect,
            cursor_run_rowid=cursor_run_rowid,
            limit=limit,
            include_annotations_and_revisions=True,
        )

        combined_result = await session.execute(combined_query)
        all_rows = combined_result.all()

        if not all_rows:
            return GetIncompleteEvaluationsResponseBody(data=[], next_cursor=None)

        # Parse rows - now each row is a single run with successful annotations as JSON array
        # Each row: (ExperimentRun, revision_id, DatasetExampleRevision, annotations_json)
        runs_data: list[tuple[models.ExperimentRun, models.DatasetExampleRevision, set[str]]] = []

        for row in all_rows:
            run = row[0]  # ExperimentRun
            revision = row[2]  # DatasetExampleRevision
            annotations_json = row[3]  # JSON string or None

            # Parse successful annotation names (just a list of strings now)
            successful_eval_names: set[str] = set()
            if annotations_json:
                successful_eval_names = set(json.loads(annotations_json))

            runs_data.append((run, revision, successful_eval_names))

        # Apply pagination limit
        has_more = len(runs_data) > limit
        if has_more:
            runs_to_process = runs_data[:limit]
        else:
            runs_to_process = runs_data

        # Build response
        incomplete_evaluations_list: list[IncompleteExperimentEvaluation] = []
        for run, revision, successful_eval_names in runs_to_process:
            # Determine incomplete evaluation names for this run
            # Any evaluation not in the successful set is incomplete (either missing or failed)
            incomplete_evaluation_names = sorted(
                name for name in evaluation_name if name not in successful_eval_names
            )

            run_globalid = GlobalID("ExperimentRun", str(run.id))
            example_globalid = GlobalID("DatasetExample", str(run.dataset_example_id))

            incomplete_evaluations_list.append(
                IncompleteExperimentEvaluation(
                    experiment_run=ExperimentRun(
                        id=str(run_globalid),
                        experiment_id=str(experiment_globalid),
                        dataset_example_id=str(example_globalid),
                        output=run.output.get("task_output"),
                        repetition_number=run.repetition_number,
                        start_time=run.start_time,
                        end_time=run.end_time,
                        trace_id=run.trace_id,
                        error=run.error,
                    ),
                    dataset_example=DatasetExample(
                        id=str(example_globalid),
                        input=revision.input,
                        output=revision.output,
                        metadata=revision.metadata_,
                        updated_at=revision.created_at,
                    ),
                    evaluation_names=incomplete_evaluation_names,
                )
            )

        # Set next cursor if we have more results
        next_cursor = None
        if has_more:
            # Cursor is the ID of the next item to fetch
            # (the extra item we fetched but didn't process)
            next_run, _, _ = runs_data[limit]  # First item after our limit
            next_cursor = str(GlobalID("ExperimentRun", str(next_run.id)))

        return GetIncompleteEvaluationsResponseBody(
            data=incomplete_evaluations_list, next_cursor=next_cursor
        )
