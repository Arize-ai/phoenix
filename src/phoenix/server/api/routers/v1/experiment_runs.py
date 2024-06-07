from datetime import datetime

from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type


async def create_experiment_run(request: Request) -> Response:
    experiment_globalid = GlobalID.from_id(request.path_params["experiment_id"])
    try:
        experiment_id = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        return Response(
            content=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    payload = await request.json()

    dataset_example_globalid = GlobalID.from_id(payload.get("dataset_example_id"))
    try:
        dataset_example_id = from_global_id_with_expected_type(
            dataset_example_globalid, "DatasetExample"
        )
    except ValueError:
        return Response(
            content=f"DatasetExample with ID {dataset_example_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    trace_id = payload.get("trace_id", None)
    output = payload.get("output")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    error = payload.get("error")

    async with request.app.state.db() as session:
        experiment_run = models.ExperimentRun(
            experiment_id=int(experiment_id),
            dataset_example_id=int(dataset_example_id),
            trace_id=trace_id,
            output=output,
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
            error=error,
        )
        session.add(experiment_run)
        await session.flush()

        run_globalid = GlobalID("ExperimentRun", str(experiment_run.id))
        run_payload = {
            "id": str(run_globalid),
            "experiment_id": str(experiment_globalid),
            "dataset_example_id": str(dataset_example_globalid),
            "output": experiment_run.output,
            "trace_id": experiment_run.trace_id,
            "start_time": experiment_run.start_time.isoformat(),
            "end_time": experiment_run.end_time.isoformat(),
            "error": experiment_run.error,
        }
        return JSONResponse(content=run_payload, status_code=200)


async def list_experiment_runs(request: Request) -> Response:
    experiment_globalid = GlobalID.from_id(request.path_params["experiment_id"])
    try:
        experiment_id = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        return Response(
            content=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    async with request.app.state.db() as session:
        experiment_runs = await session.execute(
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_id)
            # order by dataset_exaple_id to be consistent with `list_dataset_examples`
            .order_by(models.ExperimentRun.dataset_example_id.asc())
        )
        experiment_runs = experiment_runs.scalars().all()
        runs = []
        for run in experiment_runs:
            run_gid = GlobalID("ExperimentRun", str(run.id))
            experiment_gid = GlobalID("Experiment", str(run.experiment_id))
            example_gid = GlobalID("DatasetExample", str(run.dataset_example_id))
            runs.append(
                {
                    "id": str(run_gid),
                    "experiment_id": str(experiment_gid),
                    "dataset_example_id": str(example_gid),
                    "output": run.output,
                    "trace_id": run.trace_id,
                    "start_time": run.start_time.isoformat(),
                    "end_time": run.end_time.isoformat(),
                    "error": run.error,
                }
            )
        return JSONResponse(content=runs, status_code=200)
