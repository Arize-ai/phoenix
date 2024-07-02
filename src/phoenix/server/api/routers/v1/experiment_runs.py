from datetime import datetime

from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.experiments.types import ExperimentRun, ExperimentRunOutput
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.utilities.json import jsonify


async def create_experiment_run(request: Request) -> Response:
    """
    summary: Create a new experiment run for a specific experiment
    operationId: createExperimentRun
    tags:
      - private
    parameters:
      - in: path
        name: experiment_id
        required: true
        description: The ID of the experiment for which the run is being created
        schema:
          type: string
    requestBody:
      description: Details of the experiment run to be created
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              dataset_example_id:
                type: string
                description: The ID of the dataset example used in the experiment run
              trace_id:
                type: string
                description: Optional trace ID for tracking
              experiment_run_output:
                type: object
                description: The output of the experiment run
              repetition_number:
                type: integer
                description: The repetition number of the experiment run
              start_time:
                type: string
                format: date-time
                description: The start time of the experiment run in ISO format
              end_time:
                type: string
                format: date-time
                description: The end time of the experiment run in ISO format
              error:
                type: string
                description: Optional error message if the experiment run encountered an error
                nullable: true
            required:
              - dataset_example_id
              - output
              - repetition_number
              - start_time
              - end_time
    responses:
      200:
        description: Experiment run created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    id:
                      type: string
                      description: The ID of the created experiment run
      404:
        description: Experiment or DatasetExample not found
    """
    experiment_gid = GlobalID.from_id(request.path_params["experiment_id"])
    try:
        experiment_id = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        return Response(
            content=f"Experiment with ID {experiment_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    payload = await request.json()

    example_gid = GlobalID.from_id(payload["dataset_example_id"])
    try:
        dataset_example_id = from_global_id_with_expected_type(example_gid, "DatasetExample")
    except ValueError:
        return Response(
            content=f"DatasetExample with ID {example_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    trace_id = payload.get("trace_id", None)
    output = payload["experiment_run_output"]
    repetition_number = payload["repetition_number"]
    start_time = payload["start_time"]
    end_time = payload["end_time"]
    error = payload.get("error")

    async with request.app.state.db() as session:
        exp_run = models.ExperimentRun(
            experiment_id=experiment_id,
            dataset_example_id=dataset_example_id,
            trace_id=trace_id,
            output=output,
            repetition_number=repetition_number,
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
            error=error,
        )
        session.add(exp_run)
        await session.flush()
    run_gid = GlobalID("ExperimentRun", str(exp_run.id))
    return JSONResponse(content={"data": {"id": str(run_gid)}})


async def list_experiment_runs(request: Request) -> Response:
    """
    summary: List all runs for a specific experiment
    operationId: listExperimentRuns
    tags:
      - private
    parameters:
      - in: path
        name: experiment_id
        required: true
        description: The ID of the experiment to list runs for
        schema:
          type: string
    responses:
      200:
        description: Experiment runs retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                        description: The ID of the experiment run
                      experiment_id:
                        type: string
                        description: The ID of the experiment
                      dataset_example_id:
                        type: string
                        description: The ID of the dataset example
                      repetition_number:
                        type: integer
                        description: The repetition number of the experiment run
                      start_time:
                        type: string
                        format: date-time
                        description: The start time of the experiment run in ISO format
                      end_time:
                        type: string
                        format: date-time
                        description: The end time of the experiment run in ISO format
                      experiment_run_output:
                        type: object
                        description: The output of the experiment run
                      error:
                        type: string
                        description: Error message if the experiment run encountered an error
                      trace_id:
                        type: string
                        description: Optional trace ID for tracking
      404:
        description: Experiment not found
    """
    experiment_gid = GlobalID.from_id(request.path_params["experiment_id"])
    try:
        experiment_id = from_global_id_with_expected_type(experiment_gid, "Experiment")
    except ValueError:
        return Response(
            content=f"Experiment with ID {experiment_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    async with request.app.state.db() as session:
        experiment_runs = await session.execute(
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_id)
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
                    experiment_run_output=ExperimentRunOutput.from_dict(exp_run.output),
                    error=exp_run.error,
                    id=str(run_gid),
                    trace_id=exp_run.trace_id,
                )
            )
    return JSONResponse(content={"data": jsonify(runs)}, status_code=200)
