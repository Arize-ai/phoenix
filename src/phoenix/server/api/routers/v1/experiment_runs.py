from sqlalchemy import select
from starlette.requests import JSONResponse, Request
from starlette.responses import Response

from phoenix.db import models


async def create_experiment_run(request: Request) -> Response:
    experiment_id = request.path_params.get("experiment-id")
    payload = await request.json()
    dataset_example_id = payload.get("dataset_example_id")
    trace_rowid = payload.get("trace_rowid")
    output = payload.get("output")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    error = payload.get("error")
    async with request.app.state.db() as session:
        experiment = session.execute(
            select(models.Experiment).where(models.Experiment.id == experiment_id)
        ).scalar()
        if experiment.status == "DONE":
            return Response(status_code=400, content="Experiment is already done")

        experiment_run = models.ExperimentRun(
            experiment_id=experiment_id,
            dataset_example_id=dataset_example_id,
            trace_rowid=trace_rowid,
            output=output,
            start_time=start_time,
            end_time=end_time,
            error=error,
        )
        session.add(experiment_run)
        await session.commit()
        run_payload = {
            "id": experiment_run.id,
            "experiment_id": experiment_run.experiment_id,
            "output": experiment_run.output,
            "trace_rowid": experiment_run.trace_rowid,
            "start_time": experiment_run.start_time,
            "end_time": experiment_run.end_time,
            "error": experiment_run.error,
        }
        return JSONResponse(content=run_payload, status_code=200)


async def get_experiment_runs(request: Request) -> Response:
    experiment_id = request.path_params.get("experiment-id")
    async with request.app.state.db() as session:
        experiment_runs = await session.execute(
            session.query(models.ExperimentRun).filter(
                models.ExperimentRun.experiment_id == experiment_id
            )
        )
        experiment_runs = experiment_runs.scalars().all()
        runs = []
        for run in experiment_runs:
            runs.append(
                {
                    "id": run.id,
                    "experiment_id": run.experiment_id,
                    "output": run.output,
                    "trace_rowid": run.trace_rowid,
                    "start_time": run.start_time,
                    "end_time": run.end_time,
                    "error": run.error,
                }
            )
        return JSONResponse(content=experiment_runs, status_code=200)
