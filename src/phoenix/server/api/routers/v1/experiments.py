import json
from datetime import datetime
from random import getrandbits
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Path, Response
from pydantic import Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.status import HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import ExperimentInsertEvent

from .models import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses, add_text_csv_content_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=True)


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
    metadata: dict[str, Any] = Field(description="Metadata of the experiment")
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
    metadata: Optional[dict[str, Any]] = Field(
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
    request_body: CreateExperimentRequestBody,
    dataset_id: str = Path(..., title="Dataset ID"),
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
    request.state.event_queue.put(ExperimentInsertEvent((experiment.id,)))
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


class ListExperimentsResponseBody(ResponseBody[list[Experiment]]):
    pass


@router.get(
    "/datasets/{dataset_id}/experiments",
    operation_id="listExperiments",
    summary="List experiments by dataset",
    response_description="Experiments retrieved successfully",
)
async def list_experiments(
    request: Request,
    dataset_id: str = Path(..., title="Dataset ID"),
) -> ListExperimentsResponseBody:
    dataset_gid = GlobalID.from_id(dataset_id)
    try:
        dataset_rowid = from_global_id_with_expected_type(dataset_gid, "Dataset")
    except ValueError:
        raise HTTPException(
            detail=f"Dataset with ID {dataset_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )
    async with request.app.state.db() as session:
        query = (
            select(models.Experiment)
            .where(models.Experiment.dataset_id == dataset_rowid)
            .order_by(models.Experiment.id.desc())
        )

        result = await session.execute(query)
        experiments = result.scalars().all()

        if not experiments:
            return ListExperimentsResponseBody(data=[])

        data = [
            Experiment(
                id=str(GlobalID("Experiment", str(experiment.id))),
                dataset_id=str(GlobalID("Dataset", str(experiment.dataset_id))),
                dataset_version_id=str(
                    GlobalID("DatasetVersion", str(experiment.dataset_version_id))
                ),
                repetitions=experiment.repetitions,
                metadata=experiment.metadata_,
                project_name=None,
                created_at=experiment.created_at,
                updated_at=experiment.updated_at,
            )
            for experiment in experiments
        ]

        return ListExperimentsResponseBody(data=data)


async def _get_experiment_runs_and_revisions(
    session: AsyncSession, experiment_rowid: int
) -> tuple[models.Experiment, tuple[models.ExperimentRun], tuple[models.DatasetExampleRevision]]:
    experiment = await session.get(models.Experiment, experiment_rowid)
    if not experiment:
        raise HTTPException(detail="Experiment not found", status_code=HTTP_404_NOT_FOUND)
    revision_ids = (
        select(func.max(models.DatasetExampleRevision.id))
        .join(
            models.DatasetExample,
            models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id,
        )
        .where(
            and_(
                models.DatasetExampleRevision.dataset_version_id <= experiment.dataset_version_id,
                models.DatasetExample.dataset_id == experiment.dataset_id,
            )
        )
        .group_by(models.DatasetExampleRevision.dataset_example_id)
        .scalar_subquery()
    )
    runs_and_revisions = (
        (
            await session.execute(
                select(models.ExperimentRun, models.DatasetExampleRevision)
                .join(
                    models.DatasetExample,
                    models.DatasetExample.id == models.ExperimentRun.dataset_example_id,
                )
                .join(
                    models.DatasetExampleRevision,
                    and_(
                        models.DatasetExample.id
                        == models.DatasetExampleRevision.dataset_example_id,
                        models.DatasetExampleRevision.id.in_(revision_ids),
                        models.DatasetExampleRevision.revision_kind != "DELETE",
                    ),
                )
                .options(
                    joinedload(models.ExperimentRun.annotations),
                )
                .where(models.ExperimentRun.experiment_id == experiment_rowid)
                .order_by(
                    models.ExperimentRun.dataset_example_id,
                    models.ExperimentRun.repetition_number,
                )
            )
        )
        .unique()
        .all()
    )
    if not runs_and_revisions:
        raise HTTPException(
            detail="Experiment has no runs",
            status_code=HTTP_404_NOT_FOUND,
        )
    runs, revisions = zip(*runs_and_revisions)
    return experiment, runs, revisions


@router.get(
    "/experiments/{experiment_id}/json",
    operation_id="getExperimentJSON",
    summary="Download experiment runs as a JSON file",
    response_class=PlainTextResponse,
    responses=add_errors_to_responses(
        [
            {"status_code": HTTP_404_NOT_FOUND, "description": "Experiment not found"},
        ]
    ),
)
async def get_experiment_json(
    request: Request,
    experiment_id: str = Path(..., title="Experiment ID"),
) -> Response:
    experiment_globalid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Invalid experiment ID: {experiment_globalid}",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )

    async with request.app.state.db() as session:
        experiment, runs, revisions = await _get_experiment_runs_and_revisions(
            session, experiment_rowid
        )
        records = []
        for run, revision in zip(runs, revisions):
            annotations = []
            for annotation in run.annotations:
                annotations.append(
                    {
                        "name": annotation.name,
                        "annotator_kind": annotation.annotator_kind,
                        "label": annotation.label,
                        "score": annotation.score,
                        "explanation": annotation.explanation,
                        "trace_id": annotation.trace_id,
                        "error": annotation.error,
                        "metadata": annotation.metadata_,
                        "start_time": annotation.start_time.isoformat(),
                        "end_time": annotation.end_time.isoformat(),
                    }
                )
            record = {
                "example_id": str(
                    GlobalID(models.DatasetExample.__name__, str(run.dataset_example_id))
                ),
                "repetition_number": run.repetition_number,
                "input": revision.input,
                "reference_output": revision.output,
                "output": run.output["task_output"],
                "error": run.error,
                "latency_ms": run.latency_ms,
                "start_time": run.start_time.isoformat(),
                "end_time": run.end_time.isoformat(),
                "trace_id": run.trace_id,
                "prompt_token_count": run.prompt_token_count,
                "completion_token_count": run.completion_token_count,
                "annotations": annotations,
            }
            records.append(record)

        return Response(
            content=json.dumps(records, ensure_ascii=False, indent=2),
            headers={"content-disposition": f'attachment; filename="{experiment.name}.json"'},
            media_type="application/json",
        )


@router.get(
    "/experiments/{experiment_id}/csv",
    operation_id="getExperimentCSV",
    summary="Download experiment runs as a CSV file",
    responses={**add_text_csv_content_to_responses(HTTP_200_OK)},
)
async def get_experiment_csv(
    request: Request,
    experiment_id: str = Path(..., title="Experiment ID"),
) -> Response:
    experiment_globalid = GlobalID.from_id(experiment_id)
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Invalid experiment ID: {experiment_globalid}",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )

    async with request.app.state.db() as session:
        experiment, runs, revisions = await _get_experiment_runs_and_revisions(
            session, experiment_rowid
        )
        records = []
        for run, revision in zip(runs, revisions):
            serialized_run_output = (
                json.dumps(run.output["task_output"])
                if isinstance(run.output["task_output"], dict)
                else run.output["task_output"]
            )
            record = {
                "example_id": str(GlobalID("DatasetExample", str(run.dataset_example_id))),
                "repetition_number": run.repetition_number,
                "input": json.dumps(revision.input),
                "reference_output": json.dumps(revision.output),
                "output": serialized_run_output,
                "error": run.error,
                "latency_ms": run.latency_ms,
                "start_time": run.start_time.isoformat(),
                "end_time": run.end_time.isoformat(),
                "trace_id": run.trace_id,
                "prompt_token_count": run.prompt_token_count,
                "completion_token_count": run.completion_token_count,
            }
            for annotation in run.annotations:
                prefix = f"annotation_{annotation.name}"
                record.update(
                    {
                        f"{prefix}_label": annotation.label,
                        f"{prefix}_score": annotation.score,
                        f"{prefix}_explanation": annotation.explanation,
                        f"{prefix}_metadata": json.dumps(annotation.metadata_),
                        f"{prefix}_annotator_kind": annotation.annotator_kind,
                        f"{prefix}_trace_id": annotation.trace_id,
                        f"{prefix}_error": annotation.error,
                        f"{prefix}_start_time": annotation.start_time.isoformat(),
                        f"{prefix}_end_time": annotation.end_time.isoformat(),
                    }
                )
            records.append(record)

        df = pd.DataFrame.from_records(records)
        csv_content = df.to_csv(index=False).encode()

        return Response(
            content=csv_content,
            headers={
                "content-disposition": f'attachment; filename="{experiment.name}.csv"',
                "content-type": "text/csv",
            },
        )
