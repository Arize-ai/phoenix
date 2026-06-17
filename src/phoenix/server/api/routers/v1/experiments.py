import json
from datetime import datetime
from random import getrandbits
from typing import Annotated, Any, Literal, Optional

import pandas as pd
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import Field, model_validator
from sqlalchemy import and_, case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    get_experiment_incomplete_runs_query,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.queries import _comparison_count_expression
from phoenix.server.api.routers.v1.datasets import DatasetExample
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import ExperimentInsertEvent
from phoenix.server.experiments.utils import generate_experiment_project_name

from .datasets import _resolve_split_identifiers
from .models import V1RoutesBaseModel
from .utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    add_text_csv_content_to_responses,
)

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
    name: str = Field(description="The name of the experiment")
    description: Optional[str] = Field(description="The description of the experiment")
    repetitions: int = Field(description="Number of times the experiment is repeated", gt=0)
    metadata: dict[str, Any] = Field(description="Metadata of the experiment")
    project_name: Optional[str] = Field(
        description="The name of the project associated with the experiment"
    )
    created_at: datetime = Field(description="The creation timestamp of the experiment")
    updated_at: datetime = Field(description="The last update timestamp of the experiment")
    example_count: int = Field(description="Number of examples in the experiment")
    successful_run_count: int = Field(description="Number of successful runs in the experiment")
    failed_run_count: int = Field(description="Number of failed runs in the experiment")
    missing_run_count: int = Field(
        description="Number of missing (not yet executed) runs in the experiment"
    )


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
    splits: Optional[list[str]] = Field(
        default=None,
        description="List of dataset split identifiers (GlobalIDs or names) to filter by",
    )
    repetitions: int = Field(
        default=1, description="Number of times the experiment should be repeated for each example"
    )


class CreateExperimentResponseBody(ResponseBody[Experiment]):
    pass


@router.post(
    "/datasets/{dataset_id}/experiments",
    dependencies=[Depends(is_not_locked)],
    operation_id="createExperiment",
    summary="Create experiment on a dataset",
    responses=add_errors_to_responses(
        [{"status_code": 404, "description": "Dataset or DatasetVersion not found"}]
    ),
    response_description="Experiment retrieved successfully",
)
async def create_experiment(
    request: Request,
    request_body: CreateExperimentRequestBody,
    dataset_id: str = Path(..., title="Dataset ID"),
) -> CreateExperimentResponseBody:
    try:
        dataset_globalid = GlobalID.from_id(dataset_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid dataset ID format: {dataset_id}",
            status_code=422,
        ) from e
    try:
        dataset_rowid = from_global_id_with_expected_type(dataset_globalid, "Dataset")
    except ValueError:
        raise HTTPException(
            detail="Dataset with ID {dataset_globalid} does not exist",
            status_code=404,
        )

    dataset_version_globalid_str = request_body.version_id
    if dataset_version_globalid_str is not None:
        try:
            dataset_version_globalid = GlobalID.from_id(dataset_version_globalid_str)
        except Exception as e:
            raise HTTPException(
                detail=f"Invalid dataset version ID format: {dataset_version_globalid_str}",
                status_code=422,
            ) from e
        try:
            dataset_version_id = from_global_id_with_expected_type(
                dataset_version_globalid, "DatasetVersion"
            )
        except ValueError:
            raise HTTPException(
                detail=f"DatasetVersion with ID {dataset_version_globalid_str} does not exist",
                status_code=404,
            )

    async with request.app.state.db() as session:
        result = (
            await session.execute(select(models.Dataset).where(models.Dataset.id == dataset_rowid))
        ).scalar()
        if result is None:
            raise HTTPException(
                detail=f"Dataset with ID {dataset_globalid} does not exist",
                status_code=404,
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
                    status_code=404,
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
                    status_code=404,
                )
        user_id: Optional[int] = None
        if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
            user_id = int(request.user.identity)

        # generate a semi-unique name for the experiment
        experiment_name = request_body.name or _generate_experiment_name(dataset_name)
        project_name = generate_experiment_project_name()
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
            user_id=user_id,
        )

        if request_body.splits is not None:
            # Resolve split identifiers (IDs or names) to IDs and names
            resolved_split_ids, _ = await _resolve_split_identifiers(session, request_body.splits)

            # Generate experiment dataset splits relation
            # prior to the crosswalk table insert
            # in insert_experiment_with_examples_snapshot
            experiment.experiment_dataset_splits = [
                models.ExperimentDatasetSplit(dataset_split_id=split_id)
                for split_id in resolved_split_ids
            ]

        # crosswalk table assumes the relation is already present
        await insert_experiment_with_examples_snapshot(session, experiment)

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

        # Optimization: We just created this experiment, so we know there are 0 runs.
        # No need to query ExperimentRun table - just count the examples.
        example_count = await session.scalar(
            select(func.count())
            .select_from(models.ExperimentDatasetExample)
            .where(models.ExperimentDatasetExample.experiment_id == experiment.id)
        )

        # No runs exist yet for a newly created experiment
        successful_run_count = 0
        failed_run_count = 0
        missing_run_count = (example_count or 0) * experiment.repetitions
    request.state.event_queue.put(ExperimentInsertEvent((experiment.id,)))
    return CreateExperimentResponseBody(
        data=Experiment(
            id=str(experiment_globalid),
            dataset_id=str(dataset_globalid),
            dataset_version_id=str(dataset_version_globalid),
            name=experiment.name,
            description=experiment.description,
            repetitions=experiment.repetitions,
            metadata=experiment.metadata_,
            project_name=experiment.project_name,
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
            example_count=example_count or 0,
            successful_run_count=successful_run_count or 0,
            failed_run_count=failed_run_count or 0,
            missing_run_count=missing_run_count,
        )
    )


class GetExperimentResponseBody(ResponseBody[Experiment]):
    pass


@router.get(
    "/experiments/{experiment_id}",
    operation_id="getExperiment",
    summary="Get experiment by ID",
    responses=add_errors_to_responses(
        [{"status_code": 404, "description": "Experiment not found"}]
    ),
    response_description="Experiment retrieved successfully",
)
async def get_experiment(request: Request, experiment_id: str) -> GetExperimentResponseBody:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail="Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    async with request.app.state.db() as session:
        experiment = await session.execute(
            select(models.Experiment).where(models.Experiment.id == experiment_rowid)
        )
        experiment = experiment.scalar()
        if not experiment:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=404,
            )

        dataset_globalid = GlobalID("Dataset", str(experiment.dataset_id))
        dataset_version_globalid = GlobalID("DatasetVersion", str(experiment.dataset_version_id))

        # Get counts efficiently: use CASE to count successful and failed in single table scan
        run_counts_subq = (
            select(
                func.sum(case((models.ExperimentRun.error.is_(None), 1), else_=0)).label(
                    "successful_run_count"
                ),
                func.sum(case((models.ExperimentRun.error.is_not(None), 1), else_=0)).label(
                    "failed_run_count"
                ),
            )
            .select_from(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_rowid)
            .subquery()
        )

        counts_result = await session.execute(
            select(
                select(func.count())
                .select_from(models.ExperimentDatasetExample)
                .where(models.ExperimentDatasetExample.experiment_id == experiment_rowid)
                .scalar_subquery()
                .label("example_count"),
                run_counts_subq.c.successful_run_count,
                run_counts_subq.c.failed_run_count,
            ).select_from(run_counts_subq)
        )
        counts = counts_result.one()
        example_count = counts.example_count
        successful_run_count = counts.successful_run_count
        failed_run_count = counts.failed_run_count

        # Calculate missing runs (no database query needed)
        total_expected_runs = (example_count or 0) * experiment.repetitions
        missing_run_count = (
            total_expected_runs - (successful_run_count or 0) - (failed_run_count or 0)
        )
    return GetExperimentResponseBody(
        data=Experiment(
            id=str(experiment_globalid),
            dataset_id=str(dataset_globalid),
            dataset_version_id=str(dataset_version_globalid),
            name=experiment.name,
            description=experiment.description,
            repetitions=experiment.repetitions,
            metadata=experiment.metadata_,
            project_name=experiment.project_name,
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
            example_count=example_count or 0,
            successful_run_count=successful_run_count or 0,
            failed_run_count=failed_run_count or 0,
            missing_run_count=missing_run_count,
        )
    )


# Reserved metadata key holding git provenance collected by a test runner. See the
# OpenAPI description on `get_experiment_summary` for the documented `repo_info` convention.
REPO_INFO_METADATA_KEY = "repo_info"
_MAX_ANCESTOR_COMMITS = 100


class ExperimentAnnotationSummary(V1RoutesBaseModel):
    annotation_name: str = Field(description="The name of the annotation")
    mean_score: Optional[float] = Field(
        description=(
            "Mean score for the annotation across dataset examples. For each example the "
            "scores from its repetitions are averaged first, then those per-example means are "
            "averaged. Null when no example has a numeric score."
        )
    )
    n: int = Field(
        description=(
            "Number of dataset examples contributing a numeric score after per-example "
            "aggregation across repetitions."
        )
    )
    optimization_direction: Literal["maximize", "minimize"] = Field(
        description=(
            "The effective optimization direction used for this annotation: `maximize` "
            "(higher is better, the default) unless overridden via `minimize_scores`."
        )
    )
    baseline_mean_score: Optional[float] = Field(
        description=(
            "Mean score for the same annotation in the resolved baseline experiment, computed "
            "the same way as `mean_score`. Null when there is no baseline or the baseline has "
            "no numeric score for this annotation."
        )
    )
    diff: Optional[float] = Field(
        description=(
            "`mean_score` minus `baseline_mean_score`. Null when either side is null. The sign "
            "is not direction-adjusted; use `optimization_direction` to interpret it."
        )
    )
    num_improved: Optional[int] = Field(
        description=(
            "Number of dataset examples where this experiment's per-example score is better "
            "than the baseline's, per `optimization_direction`. Only examples with a numeric "
            "score on both sides are counted. Null when there is no baseline."
        )
    )
    num_regressed: Optional[int] = Field(
        description=(
            "Number of dataset examples where this experiment's per-example score is worse "
            "than the baseline's. Only examples with a numeric score on both sides are "
            "counted. Null when there is no baseline."
        )
    )
    num_equal: Optional[int] = Field(
        description=(
            "Number of dataset examples where this experiment's per-example score equals the "
            "baseline's. Only examples with a numeric score on both sides are counted; missing "
            "scores are excluded rather than counted as equal. Null when there is no baseline."
        )
    )


class ExperimentSummary(V1RoutesBaseModel):
    experiment_id: str = Field(description="The ID of the experiment being summarized")
    dataset_version_id: str = Field(
        description="The ID of the dataset version pinned by the experiment"
    )
    baseline_experiment_id: Optional[str] = Field(
        description=(
            "The ID of the resolved baseline experiment, or null when no baseline was "
            "requested or no comparable baseline could be resolved."
        )
    )
    baseline_dataset_version_id: Optional[str] = Field(
        description=(
            "The dataset version ID of the resolved baseline experiment, or null when there "
            "is no baseline."
        )
    )
    annotation_summaries: list[ExperimentAnnotationSummary] = Field(
        description="Per-annotation score summaries, sorted by annotation name"
    )


class GetExperimentSummaryResponseBody(ResponseBody[ExperimentSummary]):
    pass


def _experiment_repetition_mean_scores_subquery(
    experiment_rowid: int,
) -> Any:
    """Per-(example, annotation) mean score across repetitions for one experiment.

    Mirrors the repetition-aware aggregation of ``ExperimentAnnotationSummaryDataLoader``:
    scores for an annotation are averaged across the repetitions of each dataset example,
    yielding one numeric value per ``(dataset_example_id, annotation_name)``.
    """
    return (
        select(
            models.ExperimentRun.dataset_example_id.label("dataset_example_id"),
            models.ExperimentRunAnnotation.name.label("annotation_name"),
            func.avg(models.ExperimentRunAnnotation.score).label("mean_repetition_score"),
        )
        .select_from(models.ExperimentRunAnnotation)
        .join(
            models.ExperimentRun,
            models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
        )
        .where(
            and_(
                models.ExperimentRun.experiment_id == experiment_rowid,
                models.ExperimentRunAnnotation.score.is_not(None),
            )
        )
        .group_by(
            models.ExperimentRun.dataset_example_id,
            models.ExperimentRunAnnotation.name,
        )
        .subquery()
    )


async def _resolve_baseline_experiment_id(
    session: AsyncSession,
    *,
    experiment: models.Experiment,
    baseline_experiment_rowid: Optional[int],
    ancestor_commits: Optional[list[str]],
) -> Optional[int]:
    """Resolve the baseline experiment row id for a summary request.

    The server performs no git work: when ``ancestor_commits`` is supplied it filters
    experiments by the same dataset, a matching ``dataset_version_id``, and a
    ``metadata.repo_info.commit`` that appears in the candidate list, then picks the
    experiment matching the earliest-listed candidate (ties broken by recency). The
    target experiment is always excluded.

    Raises an ``HTTPException`` with status 409 when an explicit baseline targets a
    different dataset version. Returns ``None`` when no eligible baseline exists.
    """
    if baseline_experiment_rowid is not None:
        baseline = await session.get(models.Experiment, baseline_experiment_rowid)
        if baseline is None:
            raise HTTPException(
                detail=(
                    f"Baseline experiment with ID "
                    f"{GlobalID('Experiment', str(baseline_experiment_rowid))} does not exist"
                ),
                status_code=404,
            )
        if baseline.dataset_version_id != experiment.dataset_version_id:
            raise HTTPException(
                detail=(
                    "Baseline experiment pins a different dataset version "
                    f"({GlobalID('DatasetVersion', str(baseline.dataset_version_id))}) than the "
                    f"target experiment "
                    f"({GlobalID('DatasetVersion', str(experiment.dataset_version_id))}); "
                    "comparison across fixture versions is not allowed."
                ),
                status_code=409,
            )
        return baseline.id

    if not ancestor_commits:
        return None

    # Map each candidate commit to its earliest position so the closest ancestor wins.
    earliest_position: dict[str, int] = {}
    for candidate_position, commit in enumerate(ancestor_commits):
        if commit not in earliest_position:
            earliest_position[commit] = candidate_position

    commit_column = models.Experiment.metadata_[(REPO_INFO_METADATA_KEY, "commit")].as_string()
    candidate_rows = (
        await session.execute(
            select(
                models.Experiment.id,
                commit_column.label("commit"),
            ).where(
                and_(
                    models.Experiment.dataset_id == experiment.dataset_id,
                    models.Experiment.dataset_version_id == experiment.dataset_version_id,
                    models.Experiment.id != experiment.id,
                    commit_column.in_(list(earliest_position)),
                )
            )
        )
    ).all()

    best_id: Optional[int] = None
    best_position: Optional[int] = None
    for row in candidate_rows:
        position = earliest_position.get(row.commit)
        if position is None:
            continue
        # Earliest-listed candidate wins; ties broken by recency (larger row id).
        is_better = (
            best_position is None
            or position < best_position
            or (position == best_position and best_id is not None and row.id > best_id)
        )
        if is_better:
            best_id = row.id
            best_position = position
    return best_id


@router.get(
    "/experiments/{experiment_id}/summary",
    operation_id="getExperimentSummary",
    summary="Get per-annotation score summary for an experiment, optionally vs. a baseline",
    description=(
        "Return per-annotation score summaries for an experiment. Each row carries the "
        "repetition-aware `mean_score` and the number of examples `n` that contributed a "
        "numeric score.\n\n"
        "When a baseline is supplied, each row also carries `baseline_mean_score`, `diff`, "
        "and pairwise `num_improved`/`num_regressed`/`num_equal` counts comparing this "
        "experiment to the baseline on dataset examples that have a numeric score on both "
        "sides. Scores default to higher-is-better (`maximize`); pass `minimize_scores` to "
        "flip specific annotations to lower-is-better. Each row's `optimization_direction` "
        "echoes the effective direction so consumers need not re-derive it.\n\n"
        "Baseline resolution: supply `baseline_experiment_id` to compare against a specific "
        "experiment (it must pin the same `dataset_version_id`, otherwise the request is "
        "refused with 409), or supply `ancestor_commits` — an ordered, closest-first list of "
        "commit SHAs — to let the server pick the most recent prior experiment on the same "
        "dataset version whose `repo_info.commit` appears in the list. The server performs no "
        "git work and never selects the target experiment itself; when no candidate matches, "
        "the response is 200 with a null `baseline_experiment_id` and null baseline fields.\n\n"
        "The `repo_info` convention: test runners record git provenance under the reserved "
        "`repo_info` key of an experiment's `metadata`, shaped as `{commit, branch, dirty, "
        "author_name, author_email, commit_message, commit_time, remote_url, tag?}`. This key "
        "is reserved for runner-collected git metadata: a runner overwrites any user-supplied "
        "`repo_info` and reports a warning on conflict. Only `repo_info.commit` is read here, "
        "for baseline resolution."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment or baseline experiment not found"},
            {
                "status_code": 409,
                "description": "Baseline experiment pins a different dataset version",
            },
            {"status_code": 422, "description": "Invalid experiment ID or query parameters"},
        ]
    ),
    response_description="Per-annotation score summary retrieved successfully",
)
async def get_experiment_summary(
    request: Request,
    experiment_id: str = Path(..., title="Experiment ID"),
    baseline_experiment_id: Annotated[
        Optional[str],
        Query(
            description=(
                "ID of the experiment to compare against. Must pin the same dataset version as "
                "the target experiment, otherwise the request is refused with 409. Takes "
                "precedence over `ancestor_commits`."
            ),
        ),
    ] = None,
    ancestor_commits: Annotated[
        Optional[list[Annotated[str, Field(min_length=1)]]],
        Query(
            description=(
                "Ordered list of candidate commit SHAs, closest-first, used to resolve a "
                "baseline experiment on the same dataset version. Each value must be "
                "non-empty. The earliest-listed commit with a matching experiment wins; the "
                f"list is capped at {_MAX_ANCESTOR_COMMITS} entries. Ignored when "
                "`baseline_experiment_id` is supplied."
            ),
        ),
    ] = None,
    minimize_scores: Annotated[
        Optional[list[Annotated[str, Field(min_length=1)]]],
        Query(
            description=(
                "Annotation names whose scores are lower-is-better. Names not listed default "
                "to higher-is-better (`maximize`). Each value must be non-empty."
            ),
        ),
    ] = None,
) -> GetExperimentSummaryResponseBody:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    baseline_experiment_rowid: Optional[int] = None
    if baseline_experiment_id is not None:
        try:
            baseline_globalid = GlobalID.from_id(baseline_experiment_id)
            baseline_experiment_rowid = from_global_id_with_expected_type(
                baseline_globalid, "Experiment"
            )
        except Exception as e:
            raise HTTPException(
                detail=f"Invalid baseline experiment ID format: {baseline_experiment_id}",
                status_code=422,
            ) from e

    if ancestor_commits and len(ancestor_commits) > _MAX_ANCESTOR_COMMITS:
        raise HTTPException(
            detail=f"ancestor_commits may not exceed {_MAX_ANCESTOR_COMMITS} entries",
            status_code=422,
        )

    minimize_names = set(minimize_scores or ())

    def _direction(annotation_name: str) -> Literal["maximize", "minimize"]:
        return "minimize" if annotation_name in minimize_names else "maximize"

    async with request.app.state.db() as session:
        experiment = await session.get(models.Experiment, experiment_rowid)
        if experiment is None:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=404,
            )

        resolved_baseline_rowid = await _resolve_baseline_experiment_id(
            session,
            experiment=experiment,
            baseline_experiment_rowid=baseline_experiment_rowid,
            ancestor_commits=ancestor_commits,
        )

        # Per-example, repetition-averaged scores for the target experiment.
        target_means = _experiment_repetition_mean_scores_subquery(experiment_rowid)
        means_by_name = (
            await session.execute(
                select(
                    target_means.c.annotation_name,
                    func.avg(target_means.c.mean_repetition_score).label("mean_score"),
                    func.count().label("n"),
                ).group_by(target_means.c.annotation_name)
            )
        ).all()
        summaries_by_name = {row.annotation_name: (row.mean_score, row.n) for row in means_by_name}

        baseline_means_by_name: dict[str, tuple[Optional[float], int]] = {}
        comparison_counts_by_name: dict[str, tuple[int, int, int]] = {}
        if resolved_baseline_rowid is not None:
            baseline_means = _experiment_repetition_mean_scores_subquery(resolved_baseline_rowid)
            baseline_rows = (
                await session.execute(
                    select(
                        baseline_means.c.annotation_name,
                        func.avg(baseline_means.c.mean_repetition_score).label("mean_score"),
                        func.count().label("n"),
                    ).group_by(baseline_means.c.annotation_name)
                )
            ).all()
            baseline_means_by_name = {
                row.annotation_name: (row.mean_score, row.n) for row in baseline_rows
            }

            # Pairwise counts join target and baseline per-example means on
            # (dataset_example_id, annotation_name); examples missing on either side are
            # dropped by the inner join, so they are never counted as equal.
            for annotation_name in sorted(set(summaries_by_name) & set(baseline_means_by_name)):
                direction = _direction(annotation_name)
                counts_row = (
                    await session.execute(
                        select(
                            _comparison_count_expression(
                                base_column=target_means.c.mean_repetition_score,
                                compare_column=baseline_means.c.mean_repetition_score,
                                optimization_direction=direction,
                                comparison_type="improvement",
                            ).label("num_improved"),
                            _comparison_count_expression(
                                base_column=target_means.c.mean_repetition_score,
                                compare_column=baseline_means.c.mean_repetition_score,
                                optimization_direction=direction,
                                comparison_type="regression",
                            ).label("num_regressed"),
                            _comparison_count_expression(
                                base_column=target_means.c.mean_repetition_score,
                                compare_column=baseline_means.c.mean_repetition_score,
                                optimization_direction=direction,
                                comparison_type="equality",
                            ).label("num_equal"),
                        )
                        .select_from(target_means)
                        .join(
                            baseline_means,
                            and_(
                                target_means.c.dataset_example_id
                                == baseline_means.c.dataset_example_id,
                                target_means.c.annotation_name == baseline_means.c.annotation_name,
                            ),
                        )
                        .where(target_means.c.annotation_name == annotation_name)
                    )
                ).one()
                comparison_counts_by_name[annotation_name] = (
                    counts_row.num_improved,
                    counts_row.num_regressed,
                    counts_row.num_equal,
                )

        resolved_baseline_experiment = None
        if resolved_baseline_rowid is not None:
            resolved_baseline_experiment = await session.get(
                models.Experiment, resolved_baseline_rowid
            )

    has_baseline = resolved_baseline_rowid is not None
    annotation_summaries: list[ExperimentAnnotationSummary] = []
    for annotation_name in sorted(summaries_by_name):
        mean_score, n = summaries_by_name[annotation_name]
        baseline_mean_score: Optional[float] = None
        diff: Optional[float] = None
        num_improved: Optional[int] = None
        num_regressed: Optional[int] = None
        num_equal: Optional[int] = None
        if has_baseline:
            baseline_mean_score = baseline_means_by_name.get(annotation_name, (None, 0))[0]
            if mean_score is not None and baseline_mean_score is not None:
                diff = mean_score - baseline_mean_score
            counts = comparison_counts_by_name.get(annotation_name)
            num_improved, num_regressed, num_equal = counts if counts else (0, 0, 0)
        annotation_summaries.append(
            ExperimentAnnotationSummary(
                annotation_name=annotation_name,
                mean_score=mean_score,
                n=n,
                optimization_direction=_direction(annotation_name),
                baseline_mean_score=baseline_mean_score,
                diff=diff,
                num_improved=num_improved,
                num_regressed=num_regressed,
                num_equal=num_equal,
            )
        )

    baseline_experiment_globalid = (
        str(GlobalID("Experiment", str(resolved_baseline_rowid))) if has_baseline else None
    )
    baseline_dataset_version_globalid = (
        str(GlobalID("DatasetVersion", str(resolved_baseline_experiment.dataset_version_id)))
        if resolved_baseline_experiment is not None
        else None
    )
    return GetExperimentSummaryResponseBody(
        data=ExperimentSummary(
            experiment_id=str(experiment_globalid),
            dataset_version_id=str(GlobalID("DatasetVersion", str(experiment.dataset_version_id))),
            baseline_experiment_id=baseline_experiment_globalid,
            baseline_dataset_version_id=baseline_dataset_version_globalid,
            annotation_summaries=annotation_summaries,
        )
    )


class UpdateExperimentRequestBody(V1RoutesBaseModel):
    """
    Fields to update on an experiment. Omit a field to leave it unchanged.
    """

    name: Optional[str] = Field(
        default=UNDEFINED,
        description="New name for the experiment (null is rejected; name is required)",
    )
    description: Optional[str] = Field(
        default=UNDEFINED,
        description="New description for the experiment (null clears the description)",
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=UNDEFINED,
        description=(
            "New metadata object for the experiment (replaces the existing metadata as a "
            "whole; null is rejected)"
        ),
    )

    @model_validator(mode="after")
    def _reject_explicit_null_name_and_metadata(self) -> "UpdateExperimentRequestBody":
        # `name` and `metadata` are non-nullable: an omitted field stays UNDEFINED, but an
        # explicit JSON `null` arrives as None and must be rejected (422) rather than silently
        # dropped — otherwise `{"name": null, "description": "x"}` would 200 and ignore the name.
        if self.name is None:
            raise ValueError("name cannot be null")
        if self.metadata is None:
            raise ValueError("metadata cannot be null")
        return self


class UpdateExperimentResponseBody(ResponseBody[Experiment]):
    pass


@router.patch(
    "/experiments/{experiment_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="updateExperiment",
    summary="Update an experiment by ID",
    description=(
        "Partially update an experiment's name, description, and/or metadata. Only the "
        "fields included in the request body are changed; omitted fields are left as-is. "
        "Patching an ephemeral experiment refreshes its last-update timestamp, which "
        "extends the window before it is swept away."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid experiment ID or request body"},
        ]
    ),
    response_description="Experiment updated successfully",
)
async def update_experiment(
    request: Request,
    request_body: UpdateExperimentRequestBody,
    experiment_id: str = Path(..., title="Experiment ID"),
) -> UpdateExperimentResponseBody:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    patch = {
        column.key: patch_value
        for column, patch_value, column_is_nullable in (
            (models.Experiment.name, request_body.name, False),
            (models.Experiment.description, request_body.description, True),
            (models.Experiment.metadata_, request_body.metadata, False),
        )
        if patch_value is not UNDEFINED and (patch_value is not None or column_is_nullable)
    }
    if not patch:
        raise HTTPException(
            detail="No fields to update",
            status_code=422,
        )

    async with request.app.state.db() as session:
        experiment = await session.scalar(
            update(models.Experiment)
            .where(models.Experiment.id == experiment_rowid)
            .values(**patch)
            .returning(models.Experiment)
        )
        if experiment is None:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=404,
            )

        dataset_globalid = GlobalID("Dataset", str(experiment.dataset_id))
        dataset_version_globalid = GlobalID("DatasetVersion", str(experiment.dataset_version_id))

        run_counts_subq = (
            select(
                func.sum(case((models.ExperimentRun.error.is_(None), 1), else_=0)).label(
                    "successful_run_count"
                ),
                func.sum(case((models.ExperimentRun.error.is_not(None), 1), else_=0)).label(
                    "failed_run_count"
                ),
            )
            .select_from(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_rowid)
            .subquery()
        )

        counts_result = await session.execute(
            select(
                select(func.count())
                .select_from(models.ExperimentDatasetExample)
                .where(models.ExperimentDatasetExample.experiment_id == experiment_rowid)
                .scalar_subquery()
                .label("example_count"),
                run_counts_subq.c.successful_run_count,
                run_counts_subq.c.failed_run_count,
            ).select_from(run_counts_subq)
        )
        counts = counts_result.one()
        example_count = counts.example_count
        successful_run_count = counts.successful_run_count
        failed_run_count = counts.failed_run_count

        total_expected_runs = (example_count or 0) * experiment.repetitions
        missing_run_count = (
            total_expected_runs - (successful_run_count or 0) - (failed_run_count or 0)
        )
    return UpdateExperimentResponseBody(
        data=Experiment(
            id=str(experiment_globalid),
            dataset_id=str(dataset_globalid),
            dataset_version_id=str(dataset_version_globalid),
            name=experiment.name,
            description=experiment.description,
            repetitions=experiment.repetitions,
            metadata=experiment.metadata_,
            project_name=experiment.project_name,
            created_at=experiment.created_at,
            updated_at=experiment.updated_at,
            example_count=example_count or 0,
            successful_run_count=successful_run_count or 0,
            failed_run_count=failed_run_count or 0,
            missing_run_count=missing_run_count,
        )
    )


@router.delete(
    "/experiments/{experiment_id}",
    operation_id="deleteExperiment",
    summary="Delete experiment by ID",
    responses=add_errors_to_responses(
        [{"status_code": 404, "description": "Experiment not found"}]
    ),
    response_description="Experiment deleted successfully",
    status_code=204,
)
async def delete_experiment(
    request: Request,
    experiment_id: str,
    delete_project: bool = Query(
        default=False,
        description=(
            "If true, also delete the project associated with the experiment "
            "that contains traces and spans for the experiment tasks."
        ),
    ),
) -> None:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    # Stop any running experiment and wait for in-flight shielded DB writes
    # to drain, avoiding FK constraint violations from concurrent writes.
    # Note: only drains experiments owned by this replica. In multi-replica
    # deployments, another replica's shielded writes may still race with
    # the DELETE (possible FK errors or orphaned rows), but these are
    # harmless since the experiment is being deleted anyway.
    await request.state.experiment_runner.stop_experiment(experiment_rowid)

    stmt = (
        sa.delete(models.Experiment)
        .where(models.Experiment.id == experiment_rowid)
        .returning(models.Experiment.project_name)
    )
    async with request.app.state.db() as session:
        result = (await session.execute(stmt)).first()
        if result is None:
            raise HTTPException(detail="Experiment does not exist", status_code=404)
        project_name = result.project_name
        if delete_project and project_name:
            delete_project_stmt = sa.delete(models.Project).where(
                models.Project.name == project_name
            )
            await session.execute(delete_project_stmt)


class ListExperimentsResponseBody(PaginatedResponseBody[Experiment]):
    pass


class IncompleteExperimentRun(V1RoutesBaseModel):
    """
    Information about incomplete runs for a dataset example
    """

    dataset_example: DatasetExample = Field(description="The dataset example")
    repetition_numbers: list[int] = Field(
        description="List of repetition numbers that need to be run"
    )


class GetIncompleteExperimentRunsResponseBody(PaginatedResponseBody[IncompleteExperimentRun]):
    pass


@router.get(
    "/experiments/{experiment_id}/incomplete-runs",
    operation_id="getIncompleteExperimentRuns",
    summary="Get incomplete runs for an experiment",
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid cursor format"},
        ]
    ),
    response_description="Incomplete runs retrieved successfully",
)
async def get_incomplete_runs(
    request: Request,
    experiment_id: str,
    cursor: Optional[str] = Query(default=None, description="Cursor for pagination"),
    limit: int = Query(
        default=50, description="Maximum number of examples with incomplete runs to return", gt=0
    ),
) -> GetIncompleteExperimentRunsResponseBody:
    """
    Get runs that need to be completed for this experiment.

    Returns all incomplete runs, including both missing runs (not yet attempted)
    and failed runs (attempted but have errors).

    Args:
        experiment_id: The ID of the experiment
        cursor: Cursor for pagination
        limit: Maximum number of results to return

    Returns:
        Paginated list of incomplete runs grouped by dataset example,
        with repetition numbers that need to be run
    """
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        id_ = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Experiment with ID {experiment_globalid} does not exist",
            status_code=404,
        )

    # Parse cursor if provided
    cursor_example_rowid: Optional[int] = None
    if cursor:
        try:
            cursor_gid = GlobalID.from_id(cursor)
            cursor_example_rowid = from_global_id_with_expected_type(cursor_gid, "DatasetExample")
        except (ValueError, AttributeError):
            raise HTTPException(
                detail=f"Invalid cursor format: {cursor}",
                status_code=422,
            )

    # Fetch experiment first (we need its repetitions count for the query)
    async with request.app.state.db() as session:
        experiment_result = await session.execute(select(models.Experiment).filter_by(id=id_))
        experiment = experiment_result.scalar()
        if not experiment:
            raise HTTPException(
                detail=f"Experiment with ID {experiment_globalid} does not exist",
                status_code=404,
            )

        dialect = request.app.state.db.dialect

        stmt = get_experiment_incomplete_runs_query(
            experiment,
            dialect,
            cursor_example_rowid=cursor_example_rowid,
            limit=limit,
        )

        result = await session.execute(stmt)
        all_examples = result.all()

        # Check if there's a next page
        has_next_page = len(all_examples) > limit
        if has_next_page:
            # Remove the extra row
            examples_to_process = all_examples[:limit]
            # The cursor points to the FIRST item of the NEXT page
            next_item_id = all_examples[limit][0].dataset_example_id
            next_cursor = str(GlobalID("DatasetExample", str(next_item_id)))
        else:
            examples_to_process = all_examples
            next_cursor = None

        # Parse incomplete repetitions and build response
        # Optimization: Precompute the "all repetitions" list for completely missing examples
        # to avoid recomputing it for every missing example
        all_repetitions = list(range(1, experiment.repetitions + 1))
        incomplete_runs_list: list[IncompleteExperimentRun] = []

        for revision, successful_count, incomplete_reps in examples_to_process:
            example_id = revision.dataset_example_id

            # Three regimes:
            # 1. Completely missing (successful_count = 0): all repetitions are incomplete
            # 2. Partially completed (0 < successful_count < R): parse from SQL result
            # 3. Totally completed (successful_count = R): filtered out by SQL HAVING clause

            if successful_count == 0:
                # Regime 1: Completely missing - use precomputed list
                incomplete = all_repetitions
            else:
                # Regime 2: Partially completed - parse incomplete reps from SQL
                if dialect is SupportedSQLDialect.POSTGRESQL:
                    # PostgreSQL returns array (list), filter out nulls
                    incomplete = [r for r in incomplete_reps if r is not None]
                else:
                    # SQLite returns JSON string
                    incomplete = [r for r in json.loads(incomplete_reps) if r is not None]

            # Build response
            example_globalid = GlobalID("DatasetExample", str(example_id))
            incomplete_runs_list.append(
                IncompleteExperimentRun(
                    dataset_example=DatasetExample(
                        id=str(example_globalid),
                        node_id=str(example_globalid),
                        input=revision.input,
                        output=revision.output,
                        metadata=revision.metadata_,
                        updated_at=revision.created_at,
                    ),
                    repetition_numbers=sorted(incomplete),
                )
            )

        return GetIncompleteExperimentRunsResponseBody(
            data=incomplete_runs_list, next_cursor=next_cursor
        )


@router.get(
    "/datasets/{dataset_id}/experiments",
    operation_id="listExperiments",
    summary="List experiments by dataset",
    description="Retrieve a paginated list of experiments for the specified dataset.",
    response_description="Paginated list of experiments for the dataset",
    responses=add_errors_to_responses([422]),
)
async def list_experiments(
    request: Request,
    dataset_id: str = Path(..., title="Dataset ID"),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded experiment ID)",
    ),
    limit: int = Query(
        default=50, description="The max number of experiments to return at a time.", gt=0
    ),
) -> ListExperimentsResponseBody:
    try:
        dataset_gid = GlobalID.from_id(dataset_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid dataset ID format: {dataset_id}",
            status_code=422,
        ) from e
    try:
        dataset_rowid = from_global_id_with_expected_type(dataset_gid, "Dataset")
    except ValueError:
        raise HTTPException(
            detail=f"Dataset with ID {dataset_gid} does not exist",
            status_code=404,
        )
    async with request.app.state.db() as session:
        query = (
            select(models.Experiment)
            .where(models.Experiment.dataset_id == dataset_rowid)
            .order_by(models.Experiment.id.desc())
        )

        # Handle cursor for pagination
        if cursor:
            try:
                cursor_gid = GlobalID.from_id(cursor)
                cursor_rowid = from_global_id_with_expected_type(cursor_gid, "Experiment")
                query = query.where(models.Experiment.id <= cursor_rowid)
            except (ValueError, Exception):
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=422,
                )

        # Overfetch by 1 to determine if there's a next page
        query = query.limit(limit + 1)

        result = await session.execute(query)
        experiments = result.scalars().all()

        if not experiments:
            return ListExperimentsResponseBody(data=[], next_cursor=None)

        # Get example counts and successful run counts for all experiments in a single query
        experiment_ids = [exp.id for exp in experiments]

        # Create subqueries for counts
        example_count_subq = (
            select(
                models.ExperimentDatasetExample.experiment_id, func.count().label("example_count")
            )
            .where(models.ExperimentDatasetExample.experiment_id.in_(experiment_ids))
            .group_by(models.ExperimentDatasetExample.experiment_id)
            .subquery()
        )

        # Optimize: Use CASE to count successful and failed in single table scan
        run_counts_subq = (
            select(
                models.ExperimentRun.experiment_id,
                func.sum(case((models.ExperimentRun.error.is_(None), 1), else_=0)).label(
                    "successful_run_count"
                ),
                func.sum(case((models.ExperimentRun.error.is_not(None), 1), else_=0)).label(
                    "failed_run_count"
                ),
            )
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(models.ExperimentRun.experiment_id)
            .subquery()
        )

        # Get all counts in one query using outer join
        counts_result = await session.execute(
            select(
                func.coalesce(
                    example_count_subq.c.experiment_id,
                    run_counts_subq.c.experiment_id,
                ).label("experiment_id"),
                func.coalesce(example_count_subq.c.example_count, 0).label("example_count"),
                func.coalesce(run_counts_subq.c.successful_run_count, 0).label(
                    "successful_run_count"
                ),
                func.coalesce(run_counts_subq.c.failed_run_count, 0).label("failed_run_count"),
            )
            .select_from(example_count_subq)
            .outerjoin(
                run_counts_subq,
                example_count_subq.c.experiment_id == run_counts_subq.c.experiment_id,
            )
        )

        counts_by_experiment = {
            row.experiment_id: (row.example_count, row.successful_run_count, row.failed_run_count)
            for row in counts_result
        }

        # Handle pagination: check if we have a next page
        next_cursor = None
        if len(experiments) == limit + 1:
            last_experiment = experiments[-1]
            next_cursor = str(GlobalID("Experiment", str(last_experiment.id)))
            experiments = experiments[:-1]  # Remove the extra overfetched experiment

        data = []
        for experiment in experiments:
            counts = counts_by_experiment.get(experiment.id, (0, 0, 0))
            example_count = counts[0]
            successful_run_count = counts[1]
            failed_run_count = counts[2]

            # Calculate missing runs (no database query needed)
            total_expected_runs = example_count * experiment.repetitions
            missing_run_count = total_expected_runs - successful_run_count - failed_run_count

            data.append(
                Experiment(
                    id=str(GlobalID("Experiment", str(experiment.id))),
                    dataset_id=str(GlobalID("Dataset", str(experiment.dataset_id))),
                    dataset_version_id=str(
                        GlobalID("DatasetVersion", str(experiment.dataset_version_id))
                    ),
                    name=experiment.name,
                    description=experiment.description,
                    repetitions=experiment.repetitions,
                    metadata=experiment.metadata_,
                    project_name=experiment.project_name,
                    created_at=experiment.created_at,
                    updated_at=experiment.updated_at,
                    example_count=example_count,
                    successful_run_count=successful_run_count,
                    failed_run_count=failed_run_count,
                    missing_run_count=missing_run_count,
                )
            )

        return ListExperimentsResponseBody(data=data, next_cursor=next_cursor)


async def _get_experiment_runs_and_revisions(
    session: AsyncSession, experiment_rowid: int
) -> tuple[models.Experiment, tuple[models.ExperimentRun], tuple[models.DatasetExampleRevision]]:
    experiment = await session.get(models.Experiment, experiment_rowid)
    if not experiment:
        raise HTTPException(detail="Experiment not found", status_code=404)
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
            status_code=404,
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
            {"status_code": 404, "description": "Experiment not found"},
        ]
    ),
)
async def get_experiment_json(
    request: Request,
    experiment_id: str = Path(..., title="Experiment ID"),
) -> Response:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Invalid experiment ID: {experiment_globalid}",
            status_code=422,
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
    responses={**add_text_csv_content_to_responses(200)},
)
async def get_experiment_csv(
    request: Request,
    experiment_id: str = Path(..., title="Experiment ID"),
) -> Response:
    try:
        experiment_globalid = GlobalID.from_id(experiment_id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid experiment ID format: {experiment_id}",
            status_code=422,
        ) from e
    try:
        experiment_rowid = from_global_id_with_expected_type(experiment_globalid, "Experiment")
    except ValueError:
        raise HTTPException(
            detail=f"Invalid experiment ID: {experiment_globalid}",
            status_code=422,
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
                "metadata": json.dumps(revision.metadata_),
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
