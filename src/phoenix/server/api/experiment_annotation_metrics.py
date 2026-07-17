"""Dataset-scoped aggregation for experiment evaluation metric charts."""

from collections import defaultdict
from typing import Any, cast

from pandas import DataFrame
from sqlalchemy import and_, func, or_, select, tuple_

from phoenix.db import models
from phoenix.server.api.annotation_metrics import build_top_annotation_labels_stmt
from phoenix.server.api.experiment_tags import BASELINE_EXPERIMENT_TAG_NAME
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.Experiment import to_gql_experiment
from phoenix.server.api.types.ExperimentAnnotationMetrics import (
    ExperimentAnnotationMetrics,
    ExperimentAnnotationMetricsDataPoint,
)
from phoenix.server.types import DbSessionFactory


async def get_experiment_annotation_metrics(
    *,
    db: DbSessionFactory,
    dataset_id: int,
    first: int,
) -> ExperimentAnnotationMetrics:
    """Return a bounded, shared evaluation domain for a dataset's metric window."""
    recent_experiments, baseline_experiment = await _get_experiment_window(
        db=db,
        dataset_id=dataset_id,
        first=first,
    )
    experiment_rows_by_id = {
        experiment.id: (experiment, sequence_number)
        for experiment, sequence_number in recent_experiments
    }
    if baseline_experiment is not None:
        experiment_rows_by_id.setdefault(baseline_experiment[0].id, baseline_experiment)
    experiment_ids = list(experiment_rows_by_id)
    if not experiment_ids:
        return ExperimentAnnotationMetrics(
            names=[],
            baseline_experiment=None,
            recent_experiments=[],
        )

    baseline_experiment_id = baseline_experiment[0].id if baseline_experiment else None
    selected_labels_by_name = await _get_selected_labels_by_name(
        db=db,
        experiment_ids=experiment_ids,
    )
    summaries_by_experiment_id, names = await _get_annotation_summaries(
        db=db,
        experiment_ids=experiment_ids,
        selected_labels_by_name=selected_labels_by_name,
    )

    def make_data_point(
        experiment_row: tuple[models.Experiment, int],
        *,
        is_baseline: bool,
    ) -> ExperimentAnnotationMetricsDataPoint:
        experiment, sequence_number = experiment_row
        return ExperimentAnnotationMetricsDataPoint(
            experiment=to_gql_experiment(
                experiment,
                sequence_number,
                is_baseline=is_baseline,
            ),
            annotation_summaries=summaries_by_experiment_id[experiment.id],
        )

    return ExperimentAnnotationMetrics(
        names=names,
        baseline_experiment=(
            make_data_point(baseline_experiment, is_baseline=True)
            if baseline_experiment is not None
            else None
        ),
        recent_experiments=[
            make_data_point(
                experiment_row,
                is_baseline=experiment_row[0].id == baseline_experiment_id,
            )
            for experiment_row in recent_experiments
        ],
    )


async def _get_experiment_window(
    *,
    db: DbSessionFactory,
    dataset_id: int,
    first: int,
) -> tuple[
    list[tuple[models.Experiment, int]],
    tuple[models.Experiment, int] | None,
]:
    # Sequence numbers cover every persistent experiment, while the result set
    # is independently limited to the newest experiments shown on the page.
    row_number = func.row_number().over(order_by=models.Experiment.id).label("row_number")
    recent_experiments_query = (
        select(models.Experiment, row_number)
        .where(models.Experiment.dataset_id == dataset_id)
        .where(models.Experiment.is_ephemeral.is_(False))
        .order_by(models.Experiment.id.desc())
        .limit(first)
    )
    numbered_experiments = (
        select(models.Experiment.id.label("experiment_id"), row_number)
        .where(models.Experiment.dataset_id == dataset_id)
        .where(models.Experiment.is_ephemeral.is_(False))
        .subquery()
    )
    baseline_experiment_query = (
        select(models.Experiment, numbered_experiments.c.row_number)
        .join(
            numbered_experiments,
            numbered_experiments.c.experiment_id == models.Experiment.id,
        )
        .join(
            models.ExperimentTag,
            models.ExperimentTag.experiment_id == models.Experiment.id,
        )
        .where(models.ExperimentTag.dataset_id == dataset_id)
        .where(models.ExperimentTag.name == BASELINE_EXPERIMENT_TAG_NAME)
    )
    async with db.read() as session:
        recent_experiments = [
            (experiment, cast(int, sequence_number))
            for experiment, sequence_number in (
                await session.execute(recent_experiments_query)
            ).all()
        ]
        baseline_result = (await session.execute(baseline_experiment_query)).first()
    baseline_experiment = (
        (baseline_result[0], cast(int, baseline_result[1])) if baseline_result is not None else None
    )
    return recent_experiments, baseline_experiment


async def _get_selected_labels_by_name(
    *,
    db: DbSessionFactory,
    experiment_ids: list[int],
) -> dict[str, list[str]]:
    annotation = models.ExperimentRunAnnotation
    run = models.ExperimentRun
    annotation_rows = (
        select(
            annotation.name.label("name"),
            annotation.label.label("label"),
        )
        .select_from(annotation)
        .join(run, annotation.experiment_run_id == run.id)
        .where(run.experiment_id.in_(experiment_ids))
        .where(annotation.error.is_(None))
        .where(annotation.label.is_not(None))
    )
    selected_labels_by_name: defaultdict[str, list[str]] = defaultdict(list)
    async with db.read() as session:
        async for annotation_name, label in await session.stream(
            build_top_annotation_labels_stmt(annotation_rows)
        ):
            selected_labels_by_name[annotation_name].append(label)
    return dict(selected_labels_by_name)


async def _get_annotation_summaries(
    *,
    db: DbSessionFactory,
    experiment_ids: list[int],
    selected_labels_by_name: dict[str, list[str]],
) -> tuple[defaultdict[int, list[AnnotationSummary]], list[str]]:
    annotation = models.ExperimentRunAnnotation
    run = models.ExperimentRun
    # Average repetitions within each example first so examples with more runs
    # do not receive more weight in the experiment-wide score.
    mean_scores_by_example = (
        select(
            run.experiment_id.label("experiment_id"),
            annotation.name.label("annotation_name"),
            func.avg(annotation.score).label("mean_repetition_score"),
        )
        .select_from(annotation)
        .join(run, annotation.experiment_run_id == run.id)
        .where(run.experiment_id.in_(experiment_ids))
        .where(annotation.error.is_(None))
        .where(or_(annotation.score.is_not(None), annotation.label.is_not(None)))
        .group_by(run.experiment_id, run.dataset_example_id, annotation.name)
        .subquery()
    )
    mean_scores = (
        select(
            mean_scores_by_example.c.experiment_id,
            mean_scores_by_example.c.annotation_name,
            func.avg(mean_scores_by_example.c.mean_repetition_score).label("mean_score"),
        )
        .group_by(
            mean_scores_by_example.c.experiment_id,
            mean_scores_by_example.c.annotation_name,
        )
        .subquery()
    )
    annotation_counts = (
        select(
            run.experiment_id.label("experiment_id"),
            annotation.name.label("annotation_name"),
            func.count().label("record_count"),
            func.count(annotation.score).label("score_count"),
            func.count(annotation.label).label("label_count"),
        )
        .select_from(annotation)
        .join(run, annotation.experiment_run_id == run.id)
        .where(run.experiment_id.in_(experiment_ids))
        .where(annotation.error.is_(None))
        .where(or_(annotation.score.is_not(None), annotation.label.is_not(None)))
        .group_by(run.experiment_id, annotation.name)
        .subquery()
    )
    summaries_query = (
        select(
            annotation_counts.c.experiment_id,
            annotation_counts.c.annotation_name,
            annotation_counts.c.record_count,
            annotation_counts.c.score_count,
            annotation_counts.c.label_count,
            mean_scores.c.mean_score,
        )
        .join(
            mean_scores,
            and_(
                mean_scores.c.experiment_id == annotation_counts.c.experiment_id,
                mean_scores.c.annotation_name == annotation_counts.c.annotation_name,
            ),
        )
        .order_by(annotation_counts.c.experiment_id, annotation_counts.c.annotation_name)
    )

    selected_label_pairs = [
        (annotation_name, label)
        for annotation_name, labels in selected_labels_by_name.items()
        for label in labels
    ]
    label_counts_by_experiment_id_and_name: defaultdict[tuple[int, str], dict[str, int]] = (
        defaultdict(dict)
    )
    if selected_label_pairs:
        selected_label_counts_query = (
            select(
                run.experiment_id,
                annotation.name,
                annotation.label,
                func.count().label("label_count"),
            )
            .select_from(annotation)
            .join(run, annotation.experiment_run_id == run.id)
            .where(run.experiment_id.in_(experiment_ids))
            .where(annotation.error.is_(None))
            .where(tuple_(annotation.name, annotation.label).in_(selected_label_pairs))
            .group_by(run.experiment_id, annotation.name, annotation.label)
            .order_by(run.experiment_id, annotation.name, annotation.label)
        )
        async with db.read() as session:
            async for experiment_id, annotation_name, label, label_count in await session.stream(
                selected_label_counts_query
            ):
                label_counts_by_experiment_id_and_name[(experiment_id, annotation_name)][label] = (
                    int(label_count)
                )

    summaries_by_experiment_id: defaultdict[int, list[AnnotationSummary]] = defaultdict(list)
    names: set[str] = set()
    async with db.read() as session:
        async for summary_row in await session.stream(summaries_query):
            experiment_id = summary_row.experiment_id
            annotation_name = summary_row.annotation_name
            names.add(annotation_name)
            record_count = int(summary_row.record_count)
            score_count = int(summary_row.score_count)
            label_count = int(summary_row.label_count)
            selected_label_counts = label_counts_by_experiment_id_and_name[
                (experiment_id, annotation_name)
            ]
            selected_rows: list[dict[str, Any]] = [
                {
                    "label": label,
                    "record_count": selected_label_counts[label],
                    "label_count": selected_label_counts[label],
                    "score_count": 0,
                    "avg_score": None,
                    "avg_label_fraction": selected_label_counts[label] / record_count,
                }
                for label in selected_labels_by_name.get(annotation_name, [])
                if label in selected_label_counts
            ]
            selected_record_count = sum(cast(int, row["record_count"]) for row in selected_rows)
            selected_label_count = sum(cast(int, row["label_count"]) for row in selected_rows)
            # Keep hidden labels and annotations without a usable label in the
            # totals without exposing them as additional GraphQL categories.
            selected_rows.append(
                {
                    "label": None,
                    "record_count": record_count - selected_record_count,
                    "label_count": label_count - selected_label_count,
                    "score_count": score_count,
                    "avg_score": summary_row.mean_score,
                    "avg_label_fraction": None,
                }
            )
            summaries_by_experiment_id[experiment_id].append(
                AnnotationSummary(name=annotation_name, df=DataFrame(selected_rows))
            )
    return summaries_by_experiment_id, sorted(names)
