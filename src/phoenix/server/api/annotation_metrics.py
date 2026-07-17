"""Shared query builders for annotation metrics responses."""

from collections.abc import Iterable
from typing import Any

from sqlalchemy import Select, and_, distinct, func, literal, select, tuple_, union_all

MAX_ANNOTATION_LABEL_COUNT = 12


def build_top_annotation_labels_stmt(
    annotation_rows: Select[Any],
    limit: int = MAX_ANNOTATION_LABEL_COUNT,
) -> Select[Any]:
    """Select each evaluation's most frequent labels across the requested window."""
    rows = annotation_rows.subquery()
    label_counts = (
        select(
            rows.c.name,
            rows.c.label,
            func.count().label("label_count"),
        )
        .where(rows.c.label.is_not(None))
        .group_by(rows.c.name, rows.c.label)
        .subquery()
    )
    ranked_labels = select(
        label_counts.c.name,
        label_counts.c.label,
        func.row_number()
        .over(
            partition_by=label_counts.c.name,
            order_by=(
                label_counts.c.label_count.desc(),
                label_counts.c.label,
            ),
        )
        .label("label_rank"),
    ).subquery()
    return (
        select(
            ranked_labels.c.name,
            ranked_labels.c.label,
        )
        .where(ranked_labels.c.label_rank <= limit)
        .order_by(
            ranked_labels.c.name,
            ranked_labels.c.label_rank,
        )
    )


def build_entity_weighted_annotation_metrics_stmt(
    annotation_rows: Select[Any],
    selected_label_pairs: Iterable[tuple[str, str]],
) -> Select[Any]:
    """Aggregate bounded time-series rows using the existing entity-weighted convention."""
    rows = annotation_rows.subquery()
    # Keep the same weighting order as `dataloaders/annotation_summaries.py`:
    # first calculate each entity's distribution and score, then average those
    # entity-level values so repeated annotations do not give an entity more weight.
    # All result-bearing entities stay in the denominator. The unreturned
    # share covers both omitted labels and entities without labels, and can be
    # exposed as a future `other` bucket without renormalizing these fractions.
    entity_counts = (
        select(
            rows.c.bucket,
            rows.c.name,
            func.count(distinct(rows.c.entity_id)).label("entity_count"),
        )
        .group_by(rows.c.bucket, rows.c.name)
        .subquery()
    )
    coverage = (
        select(
            rows.c.bucket,
            rows.c.name,
            func.count().label("record_count"),
            func.count(rows.c.label).label("label_count"),
            func.count(rows.c.score).label("score_count"),
            func.sum(rows.c.score).label("score_sum"),
        )
        .group_by(rows.c.bucket, rows.c.name)
        .subquery()
    )
    entity_scores = (
        select(
            rows.c.bucket,
            rows.c.entity_id,
            rows.c.name,
            func.avg(rows.c.score).label("mean_score"),
        )
        .group_by(rows.c.bucket, rows.c.entity_id, rows.c.name)
        .subquery()
    )
    mean_scores = (
        select(
            entity_scores.c.bucket,
            entity_scores.c.name,
            func.avg(entity_scores.c.mean_score).label("mean_score"),
        )
        .group_by(entity_scores.c.bucket, entity_scores.c.name)
        .subquery()
    )
    # Counts and the evaluation-wide mean live on one synthetic row so
    # AnnotationSummary does not double-count them across selected labels.
    coverage_rows = select(
        coverage.c.bucket,
        coverage.c.name,
        literal(None).label("label"),
        coverage.c.record_count,
        coverage.c.label_count,
        coverage.c.score_count,
        coverage.c.score_sum,
        literal(None).label("avg_label_fraction"),
        mean_scores.c.mean_score.label("avg_score"),
    ).join(
        mean_scores,
        and_(
            coverage.c.bucket == mean_scores.c.bucket,
            coverage.c.name == mean_scores.c.name,
        ),
    )

    selected_label_pairs = list(selected_label_pairs)
    if not selected_label_pairs:
        return coverage_rows.order_by(coverage.c.bucket, coverage.c.name)

    label_counts_by_entity = (
        select(
            rows.c.bucket,
            rows.c.entity_id,
            rows.c.name,
            rows.c.label,
            func.count().label("label_count"),
        )
        .where(rows.c.label.is_not(None))
        .group_by(rows.c.bucket, rows.c.entity_id, rows.c.name, rows.c.label)
        .subquery()
    )
    label_totals_by_entity = (
        select(
            label_counts_by_entity.c.bucket,
            label_counts_by_entity.c.entity_id,
            label_counts_by_entity.c.name,
            func.sum(label_counts_by_entity.c.label_count).label("label_count"),
        )
        .group_by(
            label_counts_by_entity.c.bucket,
            label_counts_by_entity.c.entity_id,
            label_counts_by_entity.c.name,
        )
        .subquery()
    )
    # Apply the selected-label filter after computing each entity's full label
    # total so omitted labels do not inflate the fractions that remain.
    selected_label_fractions_by_entity = (
        select(
            label_counts_by_entity.c.bucket,
            label_counts_by_entity.c.entity_id,
            label_counts_by_entity.c.name,
            label_counts_by_entity.c.label,
            (
                label_counts_by_entity.c.label_count * 1.0 / label_totals_by_entity.c.label_count
            ).label("label_fraction"),
        )
        .join(
            label_totals_by_entity,
            and_(
                label_counts_by_entity.c.bucket == label_totals_by_entity.c.bucket,
                label_counts_by_entity.c.entity_id == label_totals_by_entity.c.entity_id,
                label_counts_by_entity.c.name == label_totals_by_entity.c.name,
            ),
        )
        .where(
            tuple_(label_counts_by_entity.c.name, label_counts_by_entity.c.label).in_(
                selected_label_pairs
            )
        )
        .subquery()
    )
    label_fractions = (
        select(
            selected_label_fractions_by_entity.c.bucket,
            selected_label_fractions_by_entity.c.name,
            selected_label_fractions_by_entity.c.label,
            (
                func.sum(selected_label_fractions_by_entity.c.label_fraction)
                / entity_counts.c.entity_count
            ).label("avg_label_fraction"),
        )
        .join(
            entity_counts,
            and_(
                selected_label_fractions_by_entity.c.bucket == entity_counts.c.bucket,
                selected_label_fractions_by_entity.c.name == entity_counts.c.name,
            ),
        )
        .group_by(
            selected_label_fractions_by_entity.c.bucket,
            selected_label_fractions_by_entity.c.name,
            selected_label_fractions_by_entity.c.label,
            entity_counts.c.entity_count,
        )
        .subquery()
    )
    label_rows = select(
        label_fractions.c.bucket,
        label_fractions.c.name,
        label_fractions.c.label,
        literal(0).label("record_count"),
        literal(0).label("label_count"),
        literal(0).label("score_count"),
        literal(0).label("score_sum"),
        label_fractions.c.avg_label_fraction,
        literal(None).label("avg_score"),
    )
    metrics = union_all(label_rows, coverage_rows).subquery()
    return select(metrics).order_by(metrics.c.bucket, metrics.c.name, metrics.c.label)
