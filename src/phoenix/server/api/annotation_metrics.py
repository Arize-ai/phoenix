"""Shared query builders for annotation metrics responses."""

from typing import Any

from sqlalchemy import Select, and_, distinct, func, literal, select, union_all


def build_entity_weighted_annotation_metrics_stmt(
    annotation_rows: Select[Any],
) -> Select[Any]:
    """Aggregate time-series rows using the existing entity-weighted convention."""
    rows = annotation_rows.subquery()
    # Match `api/dataloaders/annotation_summaries.py`: normalize repeated labels
    # within each entity, then average across all result-bearing entities. This
    # keeps repeated annotations from changing entity weight and leaves the
    # score-only share available to the UI as `other`.
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
        mean_scores.c.mean_score.label("avg_score"),
    ).join(
        mean_scores,
        and_(
            coverage.c.bucket == mean_scores.c.bucket,
            coverage.c.name == mean_scores.c.name,
        ),
    )

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
    label_fractions_by_entity = (
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
        .subquery()
    )
    label_fractions = (
        select(
            label_fractions_by_entity.c.bucket,
            label_fractions_by_entity.c.name,
            label_fractions_by_entity.c.label,
            (
                func.sum(label_fractions_by_entity.c.label_fraction) / entity_counts.c.entity_count
            ).label("avg_label_fraction"),
        )
        .join(
            entity_counts,
            and_(
                label_fractions_by_entity.c.bucket == entity_counts.c.bucket,
                label_fractions_by_entity.c.name == entity_counts.c.name,
            ),
        )
        .group_by(
            label_fractions_by_entity.c.bucket,
            label_fractions_by_entity.c.name,
            label_fractions_by_entity.c.label,
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
