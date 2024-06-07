from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type


async def create_experiment(request: Request) -> Response:
    dataset_globalid = GlobalID.from_id(request.path_params["dataset_id"])
    try:
        dataset_id = from_global_id_with_expected_type(dataset_globalid, "Dataset")
    except ValueError:
        return Response(
            content="Dataset with ID {dataset_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    payload = await request.json()
    metadata = payload.get("metadata", {})
    dataset_version_globalid = payload.get("version-id")
    if dataset_version_globalid is not None:
        try:
            dataset_version_id = from_global_id_with_expected_type(
                dataset_version_globalid, "DatasetVersion"
            )
        except ValueError:
            return Response(
                content="DatasetVersion with ID {dataset_version_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        dataset = await session.execute(select(models.Dataset).where(models.Dataset.id == dataset_id))
        if not dataset.scalar():
            return Response(
                content=f"Dataset with ID {dataset_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

        if dataset_version_globalid is None:
            dataset_version_result = await session.execute(
                select(models.DatasetVersion)
                .where(models.DatasetVersion.dataset_id == dataset_id)
                .order_by(models.DatasetVersion.id.desc())
            )
            dataset_version = dataset_version_result.scalar()
            if not dataset_version:
                return Response(
                    content=f"Dataset {dataset_globalid} does not have any versions",
                    status_code=HTTP_404_NOT_FOUND,
                )
            dataset_version_id = dataset_version.id
            dataset_version_globalid = GlobalID("DatasetVersion", str(dataset_version_id))
        experiment = models.Experiment(
            dataset_id=dataset_id,
            dataset_version_id=int(dataset_version_id),
            metadata_=metadata,
        )
        session.add(experiment)
        await session.flush()

        experiment_globalid = GlobalID("Experiment", str(experiment.id))
        experiment_payload = {
            "id": str(experiment_globalid),
            "dataset_id": str(dataset_globalid),
            "dataset_version_id": str(dataset_version_globalid),
            "metadata": experiment.metadata_,
        }
        return JSONResponse(content=experiment_payload, status_code=200)
