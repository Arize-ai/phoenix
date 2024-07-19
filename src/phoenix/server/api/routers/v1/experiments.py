from datetime import datetime
from random import getrandbits
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type

from .pydantic_compat import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=False)


def _short_uuid() -> str:
    return str(getrandbits(32).to_bytes(4, "big").hex())


def _generate_experiment_name(dataset_name: str) -> str:
    """
    Generate a semi-unique name for the experiment.
    """
    short_ds_name = dataset_name[:8].replace(" ", "-")
    return f"{short_ds_name}-{_short_uuid()}"


class Experiment(V1RoutesBaseModel):
    id: str = Field(description="The ID of the experiment")
    dataset_id: str = Field(description="The ID of the dataset associated with the experiment")
    dataset_version_id: str = Field(
        description="The ID of the dataset version associated with the experiment"
    )
    repetitions: int = Field(description="Number of times the experiment is repeated")
    metadata: Dict[str, Any] = Field(description="Metadata of the experiment")
    project_name: Optional[str] = Field(
        description="The name of the project associated with the experiment"
    )
    created_at: datetime = Field(description="The creation timestamp of the experiment")
    updated_at: datetime = Field(description="The last update timestamp of the experiment")


class CreateExperimentRequestBody(V1RoutesBaseModel):
    """
    Details of the experiment to be created
    """

    name: Optional[str] = Field(
        default=None,
        description=("Name of the experiment (if omitted, a random name will be generated)"),
    )
    description: Optional[str] = Field(
        default=None, description="An optional description of the experiment"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Metadata for the experiment"
    )
    version_id: Optional[str] = Field(
        default=None,
        description=(
            "ID of the dataset version over which the experiment will be run "
            "(if omitted, the latest version will be used)"
        ),
    )
    repetitions: int = Field(
        default=1, description="Number of times the experiment should be repeated for each example"
    )


class CreateExperimentResponseBody(ResponseBody[Experiment]):
    pass


@router.post(
    "/datasets/{dataset_id}/experiments",
    operation_id="createExperiment",
    summary="Create experiment on a dataset",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Dataset or DatasetVersion not found"}]
    ),
    response_description="Experiment retrieved successfully",
)
async def create_experiment(
    request: Request,
    dataset_id: str,
    request_body: CreateExperimentRequestBody,
) -> CreateExperimentResponseBody:
    dataset_globalid = GlobalID.from_id(dataset_id)
    try:
        dataset_rowid = from_global_id_with_expected_type(dataset_globalid, "Dataset")
    except ValueError:
        raise HTTPException(
            detail="Dataset with ID {dataset_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    dataset_version_globalid_str = request_body.version_id
    if dataset_version_globalid_str is not None:
        try:
            dataset_version_globalid = GlobalID.from_id(dataset_version_globalid_str)
            dataset_version_id = from_global_id_with_expected_type(
                dataset_version_globalid, "DatasetVersion"
            )
        except ValueError:
            raise HTTPException(
                detail=f"DatasetVersion with ID {dataset_version_globalid_str} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        result = (
            await session.execute(select(models.Dataset).where(models.Dataset.id == dataset_rowid))
        ).scalar()
        if result is None:
            raise HTTPException(
                detail=f"Dataset with ID {dataset_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )
        dataset_name = result.name
        if dataset_version_globalid_str is None:
            dataset_version_result = await session.execute(
                select(models.DatasetVersion)
                .where(models.DatasetVersion.dataset_id == dataset_rowid)
                .order_by(models.DatasetVersion.id.desc())
            )
            dataset_version = dataset_version_result.scalar()
            if not dataset_version:
                raise HTTPException(
                    detail=f"Dataset {dataset_globalid} does not have any versions",
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
                raise HTTPException(
                    detail=f"DatasetVersion with ID {dataset_version_globalid} does not exist",
                    status_code=HTTP_404_NOT_FOUND,
                )

        # generate a semi-unique name for the experiment
        experiment_name = request_body.name or _generate_experiment_name(dataset_name)
        project_name = f"Experiment-{getrandbits(96).to_bytes(12, 'big').hex()}"
        project_description = (
            f"dataset_id: {dataset_globalid}\ndataset_version_id: {dataset_version_globalid}"
        )
        experiment = models.Experiment(
            dataset_id=int(dataset_rowid),
            dataset_version_id=int(dataset_version_id),
            name=experiment_name,
            description=request_body.description,
            repetitions=request_body.repetitions,
            metadata_=request_body.metadata or {},
            project_name=project_name,
        )
        session.add(experiment)
        await session.flush()

        dialect = SupportedSQLDialect(session.bind.dialect.name)
        project_rowid = await session.scalar(
            insert_on_conflict(
                dict(
                    name=project_name,
                    description=project_description,
                    created_at=experiment.created_at,
                    updated_at=experiment.updated_at,
                ),
                dialect=dialect,
                table=models.Project,
                unique_by=("name",),
            ).returning(models.Project.id)
        )
        assert project_rowid is not None

        experiment_globalid = GlobalID("Experiment", str(experiment.id))
        if dataset_version_globalid_str is None:
            dataset_version_globalid = GlobalID(
                "DatasetVersion", str(experiment.dataset_version_id)
            )
    return CreateExperimentResponseBody(
        data=Experiment(
            id=str(experiment_globalid),
            dataset_id=str(dataset_globalid),
            dataset_version_id=str(dataset_version_globalid),
            repetitions=experiment.repetitions,
            metadata=experiment.metadata_,
            project_name=experiment.project_name,
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
        )
    )


class GetExperimentResponseBody(ResponseBody[Experiment]):
    pass


@router.get(
    "/experiments/{experiment_id}",
    operation_id="getExperiment",
    summary="Get experiment by ID",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Experiment not found"}]
    ),
    response_description="Experiment retrieved successfully",
)
async def get_experiment(request: Request, experiment_id: str) -> GetExperimentResponseBody:
    experiment_globalid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail="Experiment with ID {experiment_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    async with request.app.state.db() as session:
        experiment = await session.execute(
            select(models.Experiment).where(models.Experiment.id == experiment_rowid)
        )
        experiment = experiment.scalar()
        if not experiment:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

        dataset_globalid = GlobalID("Dataset", str(experiment.dataset_id))
        dataset_version_globalid = GlobalID("DatasetVersion", str(experiment.dataset_version_id))
    return GetExperimentResponseBody(
        data=Experiment(
            id=str(experiment_globalid),
            dataset_id=str(dataset_globalid),
            dataset_version_id=str(dataset_version_globalid),
            repetitions=experiment.repetitions,
            metadata=experiment.metadata_,
            project_name=experiment.project_name,
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
        )
    )
