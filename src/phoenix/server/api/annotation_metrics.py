"""Shared query builders for annotation metrics responses."""

from typing import Any

from sqlalchemy import BigInteger, Select, and_, cast, func, literal, select, union_all


def build_entity_weighted_annotation_metrics_stmt(
    annotation_rows: Select[Any],
) -> Select[Any]:
    """Aggregate time-series rows using the existing entity-weighted convention."""
    rows = annotation_rows.subquery()
    # Read the caller's rows once: every aggregate below derives from this CTE, so
    # the base join runs once per statement instead of once per reference to it.
    # MATERIALIZED makes that explicit instead of leaving it to each planner's
    # inlining heuristics.
    counts = (
        select(
            rows.c.bucket,
            rows.c.name,
            rows.c.entity_id,
            rows.c.label,
            func.count().label("record_count"),
            func.count(rows.c.label).label("label_count"),
            func.count(rows.c.score).label("score_count"),
            func.sum(rows.c.score).label("score_sum"),
        )
        .group_by(rows.c.bucket, rows.c.name, rows.c.entity_id, rows.c.label)
        .cte("annotation_counts")
        .prefix_with("MATERIALIZED")
    )
    # Match `api/dataloaders/annotation_summaries.py`: normalize repeated labels
    # within each entity, then average across all result-bearing entities. This
    # keeps repeated annotations from changing entity weight and leaves the
    # score-only share available to the UI as `other`.
    entity_metrics = (
        select(
            counts.c.bucket,
            counts.c.name,
            func.sum(counts.c.record_count).label("record_count"),
            func.sum(counts.c.label_count).label("label_count"),
            func.sum(counts.c.score_count).label("score_count"),
            func.sum(counts.c.score_sum).label("score_sum"),
            (func.sum(counts.c.score_sum) / func.nullif(func.sum(counts.c.score_count), 0)).label(
                "mean_score"
            ),
        )
        .group_by(counts.c.bucket, counts.c.name, counts.c.entity_id)
        .subquery()
    )
    coverage = (
        select(
            entity_metrics.c.bucket,
            entity_metrics.c.name,
            func.count().label("entity_count"),
            cast(func.sum(entity_metrics.c.record_count), BigInteger).label("record_count"),
            cast(func.sum(entity_metrics.c.label_count), BigInteger).label("label_count"),
            cast(func.sum(entity_metrics.c.score_count), BigInteger).label("score_count"),
            func.sum(entity_metrics.c.score_sum).label("score_sum"),
            func.avg(entity_metrics.c.mean_score).label("mean_score"),
        )
        .group_by(entity_metrics.c.bucket, entity_metrics.c.name)
        .cte("annotation_coverage")
    )
    # Match `api/types/AnnotationSummary.py`, which sums these columns across its DataFrame,
    # so put counts and the evaluation-wide mean on one synthetic row rather
    # than repeating them once per label.
    coverage_rows = select(
        coverage.c.bucket,
        coverage.c.name,
        literal(None).label("label"),
        coverage.c.record_count,
        coverage.c.label_count,
        coverage.c.score_count,
        coverage.c.score_sum,
        literal(None).label("avg_label_fraction"),
        coverage.c.mean_score.label("avg_score"),
    )

    label_fractions_by_entity = (
        select(
            counts.c.bucket,
            counts.c.name,
            counts.c.label,
            (
                counts.c.record_count
                * 1.0
                / func.sum(counts.c.record_count).over(
                    partition_by=(counts.c.bucket, counts.c.name, counts.c.entity_id)
                )
            ).label("label_fraction"),
        )
        .where(counts.c.label.is_not(None))
        .subquery()
    )
    label_rows = (
        select(
            label_fractions_by_entity.c.bucket,
            label_fractions_by_entity.c.name,
            label_fractions_by_entity.c.label,
            literal(0).label("record_count"),
            literal(0).label("label_count"),
            literal(0).label("score_count"),
            literal(0).label("score_sum"),
            (func.sum(label_fractions_by_entity.c.label_fraction) / coverage.c.entity_count).label(
                "avg_label_fraction"
            ),
            literal(None).label("avg_score"),
        )
        .join(
            coverage,
            and_(
                label_fractions_by_entity.c.bucket == coverage.c.bucket,
                label_fractions_by_entity.c.name == coverage.c.name,
            ),
        )
        .group_by(
            label_fractions_by_entity.c.bucket,
            label_fractions_by_entity.c.name,
            label_fractions_by_entity.c.label,
            coverage.c.entity_count,
        )
    )
    metrics = union_all(label_rows, coverage_rows).subquery()
    return select(metrics).order_by(metrics.c.bucket, metrics.c.name, metrics.c.label)
