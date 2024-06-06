from starlette.requests import Request
from starlette.responses import Response

from phoenix.db import models


async def create_experiment(request: Request) -> Response:
    dataset_id = request.path_params.get("dataset-id")
    payload = await request.json()
    dataset_version_id = payload.get("version_id")
    metadata = payload.get("metadata", {})
    async with request.app.state.db() as session:
        experiment = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=dataset_version_id,
            metadata_=metadata,
            status="IN PROGRESS",
        )
        session.add(experiment)
        await session.commit()
        return Response(status_code=200)


async def complete_experiment(request: Request) -> Response:
    experiment_id = request.path_params.get("experiment-id")
    async with request.app.state.db() as session:
        experiment = await session.get(models.Experiment, experiment_id)
        if experiment is None:
            return Response(status_code=404)
        experiment.status = "COMPLETE"
        await session.commit()
        return Response(status_code=200)
