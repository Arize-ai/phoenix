from sqlalchemy import func, insert, select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND
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
        if dataset_version_globalid is None:
            dataset_version_id_stmt = select(func.max(models.DatasetVersion.id)).where(
                models.DatasetVersion.dataset_id == dataset_id
            )
        else:
            dataset_version_id_stmt = select(models.DatasetVersion.id).where(
                models.DatasetVersion.id == dataset_version_id
            )
        try:
            experiment = (
                await session.execute(
                    insert(models.Experiment)
                    .values(
                        dataset_id=dataset_id,
                        dataset_version_id=dataset_version_id_stmt.scalar_subquery(),
                        metadata_=metadata,
                    )
                    .returning(models.Experiment)
                )
            ).scalar()
        except Exception:
            dataset_id_stmt = select(models.Dataset.id).where(models.Dataset.id == dataset_id)
            resolved_dataset_id = (await session.execute(dataset_id_stmt)).first()
            if not resolved_dataset_id:
                return Response(
                    content=f"Dataset with ID {dataset_globalid} does not exist",
                    status_code=HTTP_404_NOT_FOUND,
                )

            resolved_dataset_version_id = (await session.execute(dataset_version_id_stmt)).first()
            if not resolved_dataset_version_id:
                return Response(
                    content=f"Dataset {dataset_globalid} does not have any versions",
                    status_code=HTTP_404_NOT_FOUND,
                )
            return Response(
                content="Cannot create experiment",
                status_code=HTTP_400_BAD_REQUEST,
            )

        experiment_globalid = GlobalID("Experiment", str(experiment.id))
        if dataset_version_globalid is None:
            dataset_version_globalid = GlobalID(
                "DatasetVersion", str(experiment.dataset_version_id)
            )
        experiment_payload = {
            "id": str(experiment_globalid),
            "dataset_id": str(dataset_globalid),
            "dataset_version_id": str(dataset_version_globalid),
            "metadata": experiment.metadata_,
            "created_at": experiment.created_at.isoformat(),
            "updated_at": experiment.updated_at.isoformat(),
        }
        return JSONResponse(content=experiment_payload, status_code=200)


async def read_experiment(request: Request) -> Response:
    experiment_globalid = GlobalID.from_id(request.path_params["experiment_id"])
    try:
        experiment_id = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        return Response(
            content="Experiment with ID {experiment_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    async with request.app.state.db() as session:
        experiment = await session.execute(
            select(models.Experiment).where(models.Experiment.id == experiment_id)
        )
        experiment = experiment.scalar()
        if not experiment:
            return Response(
                content=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

        dataset_globalid = GlobalID("Dataset", str(experiment.dataset_id))
        dataset_version_globalid = GlobalID("DatasetVersion", str(experiment.dataset_version_id))
        experiment_payload = {
            "id": str(experiment_globalid),
            "dataset_id": str(dataset_globalid),
            "dataset_version_id": str(dataset_version_globalid),
            "metadata": experiment.metadata_,
            "created_at": experiment.created_at.isoformat(),
            "updated_at": experiment.updated_at.isoformat(),
        }
        return JSONResponse(content=experiment_payload, status_code=200)
