"""Independent project evaluator distributions and their score and label counts."""

from typing import Optional

import strawberry

from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.evaluators.results.comparison import make_side_binning
from phoenix.server.evaluators.results.distribution import get_evaluator_distribution
from phoenix.server.types import DbSessionFactory


@strawberry.type
class EvaluatorScoreValueCount:
    score: float
    count: int = 0


@strawberry.type
class EvaluatorLabelCount:
    label: str
    score: Optional[float] = None
    is_other: bool = False
    count: int = 0


@strawberry.type(description="Independent distribution of a project evaluator's primary result.")
class EvaluatorDistribution:
    evaluated_count: int = strawberry.field(
        description=(
            "Targets with an annotation in range, including results without scores or labels."
        )
    )
    threshold: Optional[float] = strawberry.field(
        description="The configured score flag threshold, or null for categorical outputs."
    )
    mean_score: Optional[float] = strawberry.field(
        description=(
            "Mean of all finite scores from this evaluator in the selected target time range."
        )
    )
    score_bin_counts: Optional[list[int]] = strawberry.field(
        description=(
            "Histogram of all finite scores from this evaluator in range. Null when exact "
            "scoreValueCounts are used or scores are unavailable."
        )
    )
    score_bin_edges: Optional[list[float]] = strawberry.field(
        description=(
            "Edges for scoreBinCounts, with one more edge than counts. Lower edges are inclusive; "
            "upper edges are exclusive except the final edge is inclusive. The domain covers "
            "configured bounds and observed finite scores. Null when no histogram is used."
        )
    )
    score_value_counts: Optional[list[EvaluatorScoreValueCount]] = strawberry.field(
        description=(
            "Exact finite score counts across all results, ascending by score; null for histograms."
        )
    )
    label_counts: Optional[list[EvaluatorLabelCount]] = strawberry.field(
        description=(
            "Label counts across all results, independent of score availability. Configured order, "
            "then alphabetical, with a synthetic Other group last when categories are folded. "
            "Null when labels are unavailable."
        )
    )


async def resolve_evaluator_distribution(
    *,
    db: DbSessionFactory,
    project_rowid: int,
    evaluation_target: str,
    annotation_name: str,
    config: Optional[OutputConfigType],
    time_range: TimeRange,
    shared_with_annotation_name: Optional[str] = None,
) -> EvaluatorDistribution:
    """Summarize an evaluator's results as the GraphQL distribution type."""
    summary = await get_evaluator_distribution(
        db=db,
        project_rowid=project_rowid,
        evaluation_target=evaluation_target,
        annotation_name=annotation_name,
        config=config,
        time_range=time_range,
        shared_with_annotation_name=shared_with_annotation_name,
    )
    binning = make_side_binning(annotation_name, config, None)
    return EvaluatorDistribution(
        evaluated_count=summary.evaluated_count,
        threshold=binning.threshold if binning.is_thresholded else None,
        mean_score=summary.mean_score,
        score_bin_edges=summary.score_bin_edges,
        score_bin_counts=summary.score_bin_counts,
        score_value_counts=[
            EvaluatorScoreValueCount(score=item.score, count=item.count)
            for item in summary.score_value_counts
        ]
        if summary.score_value_counts is not None
        else None,
        label_counts=[
            EvaluatorLabelCount(
                label=item.label,
                score=item.score,
                is_other=item.is_other,
                count=item.count,
            )
            for item in summary.label_counts
        ]
        if summary.label_counts is not None
        else None,
    )
