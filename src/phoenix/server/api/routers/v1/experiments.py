from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from phoenix.db import models


async def create_experiment(request: Request) -> Response:
    dataset_id = int(request.path_params.get("dataset_id"))
    payload = await request.json()
    dataset_version_id = payload.get("version-id")
    metadata = payload.get("metadata", {})
    async with request.app.state.db() as session:
        if dataset_version_id is None:
            dataset_version = await session.execute(
                select(models.DatasetVersion)
                .where(models.DatasetVersion.dataset_id == dataset_id)
                .order_by(models.DatasetVersion.id.desc())
            )
            dataset_version = dataset_version.scalar()
            dataset_version_id = dataset_version.id
        experiment = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=int(dataset_version_id),
            metadata_=metadata,
            status="IN PROGRESS",
        )
        session.add(experiment)
        await session.flush()
        experiment_payload = {
            "id": experiment.id,
            "dataset_id": experiment.dataset_id,
            "dataset_version_id": experiment.dataset_version_id,
            "metadata": experiment.metadata_,
            "status": experiment.status,
        }
        return JSONResponse(content=experiment_payload, status_code=200)


async def complete_experiment(request: Request) -> Response:
    experiment_id = request.path_params.get("experiment-id")
    async with request.app.state.db() as session:
        experiment = await session.get(models.Experiment, experiment_id)
        if experiment is None:
            return Response(status_code=404)
        experiment.status = "COMPLETE"
        await session.flush()
        experiment_payload = {
            "id": experiment.id,
            "dataset_id": experiment.dataset_id,
            "dataset_version_id": experiment.dataset_version_id,
            "metadata": experiment.metadata_,
            "status": experiment.status,
        }
        return JSONResponse(content=experiment_payload, status_code=200)
