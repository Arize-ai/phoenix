from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import ExperimentRunOutput
from phoenix.server.api.types.node import from_global_id_with_expected_type

from .pydantic_compat import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=False)


class ExperimentRun(V1RoutesBaseModel):
    dataset_example_id: str = Field(
        description="The ID of the dataset example used in the experiment run"
    )
    output: Any = Field(description="The output of the experiment task")
    repetition_number: int = Field(description="The repetition number of the experiment run")
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


class CreateExperimentResponseBody(ResponseBody[CreateExperimentRunResponseBodyData]):
    pass


@router.post(
    "/experiments/{experiment_id}/runs",
    operation_id="createExperimentRun",
    summary="Create run for an experiment",
    response_description="Experiment run created successfully",
    responses=add_errors_to_responses(
        [
            {
                "status_code": HTTP_404_NOT_FOUND,
                "description": "Experiment or dataset example not found",
            }
        ]
    ),
)
async def create_experiment_run(
    request: Request, experiment_id: str, request_body: CreateExperimentRunRequestBody
) -> CreateExperimentResponseBody:
    experiment_gid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    example_gid = GlobalID.from_id(request_body.dataset_example_id)
    try:
        dataset_example_id = from_global_id_with_expected_type(example_gid, "DatasetExample")
    except ValueError:
        raise HTTPException(
            detail=f"DatasetExample with ID {example_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
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
        session.add(exp_run)
        await session.flush()
    run_gid = GlobalID("ExperimentRun", str(exp_run.id))
    return CreateExperimentResponseBody(data=CreateExperimentRunResponseBodyData(id=str(run_gid)))


class ListExperimentRunsResponseBody(ResponseBody[List[ExperimentRun]]):
    pass


@router.get(
    "/experiments/{experiment_id}/runs",
    operation_id="listExperimentRuns",
    summary="List runs for an experiment",
    response_description="Experiment runs retrieved successfully",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Experiment not found"}]
    ),
)
async def list_experiment_runs(
    request: Request, experiment_id: str
) -> ListExperimentRunsResponseBody:
    experiment_gid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    async with request.app.state.db() as session:
        experiment_runs = await session.execute(
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_rowid)
            # order by dataset_example_id to be consistent with `list_dataset_examples`
            .order_by(models.ExperimentRun.dataset_example_id.asc())
        )
        experiment_runs = experiment_runs.scalars().all()
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
    return ListExperimentRunsResponseBody(data=runs)
