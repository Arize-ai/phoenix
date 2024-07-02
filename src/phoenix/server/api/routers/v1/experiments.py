from random import getrandbits

from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type


def _short_uuid() -> str:
    return str(getrandbits(32).to_bytes(4, "big").hex())


def _generate_experiment_name(dataset_name: str) -> str:
    """
    Generate a semi-unique name for the experiment.
    """
    short_ds_name = dataset_name[:8].replace(" ", "-")
    return f"{short_ds_name}-{_short_uuid()}"


async def create_experiment(request: Request) -> Response:
    """
    summary: Create an experiment using a dataset
    operationId: createExperiment
    tags:
      - private
    parameters:
      - in: path
        name: dataset_id
        required: true
        description: The ID of the dataset to create an experiment for
        schema:
          type: string
    requestBody:
      description: Details of the experiment to be created
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              repetitions:
                type: integer
                description: Number of times the experiment should be repeated for each example
                default: 1
              metadata:
                type: object
                description: Metadata for the experiment
                additionalProperties:
                  type: string
              version_id:
                type: string
                description: ID of the dataset version to use
    responses:
      200:
        description: Experiment retrieved successfully
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
                      description: The ID of the experiment
                    dataset_id:
                      type: string
                      description: The ID of the dataset associated with the experiment
                    dataset_version_id:
                      type: string
                      description: The ID of the dataset version associated with the experiment
                    repetitions:
                      type: integer
                      description: Number of times the experiment is repeated
                    metadata:
                      type: object
                      description: Metadata of the experiment
                      additionalProperties:
                        type: string
                    project_name:
                      type: string
                      description: The name of the project associated with the experiment
                    created_at:
                      type: string
                      format: date-time
                      description: The creation timestamp of the experiment
                    updated_at:
                      type: string
                      format: date-time
                      description: The last update timestamp of the experiment
      404:
        description: Dataset or DatasetVersion not found
    """
    dataset_globalid = GlobalID.from_id(request.path_params["dataset_id"])
    try:
        dataset_id = from_global_id_with_expected_type(dataset_globalid, "Dataset")
    except ValueError:
        return Response(
            content="Dataset with ID {dataset_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    payload = await request.json()
    repetitions = payload.get("repetitions", 1)
    metadata = payload.get("metadata") or {}
    dataset_version_globalid_str = payload.get("version_id")
    if dataset_version_globalid_str is not None:
        try:
            dataset_version_globalid = GlobalID.from_id(dataset_version_globalid_str)
            dataset_version_id = from_global_id_with_expected_type(
                dataset_version_globalid, "DatasetVersion"
            )
        except ValueError:
            return Response(
                content="DatasetVersion with ID {dataset_version_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        result = (
            await session.execute(select(models.Dataset).where(models.Dataset.id == dataset_id))
        ).scalar()
        if result is None:
            return Response(
                content=f"Dataset with ID {dataset_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )
        dataset_name = result.name
        if dataset_version_globalid_str is None:
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
        else:
            dataset_version = await session.execute(
                select(models.DatasetVersion).where(models.DatasetVersion.id == dataset_version_id)
            )
            dataset_version = dataset_version.scalar()
            if not dataset_version:
                return Response(
                    content=f"DatasetVersion with ID {dataset_version_globalid} does not exist",
                    status_code=HTTP_404_NOT_FOUND,
                )

        # generate a semi-unique name for the experiment
        experiment_name = payload.get("name") or _generate_experiment_name(dataset_name)
        project_name = f"Experiment-{getrandbits(96).to_bytes(12, 'big').hex()}"
        project_description = (
            f"dataset_id: {dataset_globalid}\ndataset_version_id: {dataset_version_globalid}"
        )
        experiment = models.Experiment(
            dataset_id=int(dataset_id),
            dataset_version_id=int(dataset_version_id),
            name=experiment_name,
            description=payload.get("description"),
            repetitions=repetitions,
            metadata_=metadata,
            project_name=project_name,
        )
        session.add(experiment)
        await session.flush()

        dialect = SupportedSQLDialect(session.bind.dialect.name)
        project_rowid = await session.scalar(
            insert_on_conflict(
                dialect=dialect,
                table=models.Project,
                constraint="uq_projects_name",
                column_names=("name",),
                values=dict(
                    name=project_name,
                    description=project_description,
                    created_at=experiment.created_at,
                    updated_at=experiment.updated_at,
                ),
            ).returning(models.Project.id)
        )
        assert project_rowid is not None

        experiment_globalid = GlobalID("Experiment", str(experiment.id))
        if dataset_version_globalid_str is None:
            dataset_version_globalid = GlobalID(
                "DatasetVersion", str(experiment.dataset_version_id)
            )
        experiment_payload = {
            "id": str(experiment_globalid),
            "dataset_id": str(dataset_globalid),
            "dataset_version_id": str(dataset_version_globalid),
            "repetitions": experiment.repetitions,
            "metadata": experiment.metadata_,
            "project_name": experiment.project_name,
            "created_at": experiment.created_at.isoformat(),
            "updated_at": experiment.updated_at.isoformat(),
        }
    return JSONResponse(content={"data": experiment_payload})


async def read_experiment(request: Request) -> Response:
    """
    summary: Get details of a specific experiment
    operationId: getExperiment
    tags:
      - private
    parameters:
      - in: path
        name: experiment_id
        required: true
        description: The ID of the experiment to retrieve
        schema:
          type: string
    responses:
      200:
        description: Experiment retrieved successfully
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
                      description: The ID of the experiment
                    dataset_id:
                      type: string
                      description: The ID of the dataset associated with the experiment
                    dataset_version_id:
                      type: string
                      description: The ID of the dataset version associated with the experiment
                    repetitions:
                      type: integer
                      description: Number of times the experiment is repeated
                    metadata:
                      type: object
                      description: Metadata of the experiment
                      additionalProperties:
                        type: string
                    project_name:
                      type: string
                      description: The name of the project associated with the experiment
                    created_at:
                      type: string
                      format: date-time
                      description: The creation timestamp of the experiment
                    updated_at:
                      type: string
                      format: date-time
                      description: The last update timestamp of the experiment
      404:
        description: Experiment not found
    """
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
            "repetitions": experiment.repetitions,
            "metadata": experiment.metadata_,
            "project_name": experiment.project_name,
            "created_at": experiment.created_at.isoformat(),
            "updated_at": experiment.updated_at.isoformat(),
        }
    return JSONResponse(content={"data": experiment_payload})
