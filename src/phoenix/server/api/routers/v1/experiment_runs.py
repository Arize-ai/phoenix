from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type


async def create_experiment_run(request: Request) -> Response:
    experiment_globalid = GlobalID.from_id(request.path_params.get("experiment-id"))
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

    trace_rowid = payload.get("trace_rowid", None)
    output = payload.get("output")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    error = payload.get("error")

    async with request.app.state.db() as session:
        experiment_run = models.ExperimentRun(
            experiment_id=int(experiment_id),
            dataset_example_id=int(dataset_example_id),
            trace_rowid=trace_rowid,
            output=output,
            start_time=start_time,
            end_time=end_time,
            error=error,
        )
        session.add(experiment_run)
        await session.flush()

        run_payload = {
            "id": experiment_run.id,
            "experiment_id": str(experiment_globalid),
            "dataset_example_id": str(dataset_example_globalid),
            "output": experiment_run.output,
            "trace_rowid": experiment_run.trace_rowid,
            "start_time": experiment_run.start_time,
            "end_time": experiment_run.end_time,
            "error": experiment_run.error,
        }
        return JSONResponse(content=run_payload, status_code=200)


async def list_experiment_runs(request: Request) -> Response:
    experiment_id = request.path_params.get("experiment-id")
    async with request.app.state.db() as session:
        experiment_runs = await session.execute(
            session.query(models.ExperimentRun)
            .filter(models.ExperimentRun.experiment_id == experiment_id)
            # order by dataset_exaple_id to be consistent with `list_dataset_examples`
            .order_by(models.ExperimentRun.dataset_example_id.asc())
        )
        experiment_runs = experiment_runs.scalars().all()
        runs = []
        for run in experiment_runs:
            experiment_gid = GlobalID("Experiment", str(run.experiment_id))
            example_gid = GlobalID("DatasetExample", str(run.dataset_example_id))
            runs.append(
                {
                    "id": run.id,
                    "experiment_id": str(experiment_gid),
                    "dataset_example_id": str(example_gid),
                    "output": run.output,
                    "trace_rowid": run.trace_rowid,
                    "start_time": run.start_time,
                    "end_time": run.end_time,
                    "error": run.error,
                }
            )
        return JSONResponse(content=experiment_runs, status_code=200)
