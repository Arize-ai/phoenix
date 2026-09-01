"""GraphQL types for the pairwise evaluator comparison (compare page)."""

from datetime import datetime
from typing import Optional, Sequence

import strawberry

from phoenix.server.api.helpers.evaluator_comparison import (
    ComparisonResult,
    ComparisonTimeSeriesPoint,
    SideSummary,
)
from phoenix.server.api.types.Evaluator import EvaluationTarget

_SHARED_POPULATION = (
    "Computed over the shared population: entities in the selected time range "
    "evaluated by both evaluators and binnable on both sides."
)


@strawberry.type
class EvaluatorComparisonCoverage:
    evaluated_by_both: int = strawberry.field(
        description="Entities in range with results from both evaluators."
    )
    only_a: int = strawberry.field(description="Entities in range evaluated only by evaluator A.")
    only_b: int = strawberry.field(description="Entities in range evaluated only by evaluator B.")
    total_in_range: int = strawberry.field(
        description="All entities of the compared level in the project and time range."
    )


@strawberry.type(description=_SHARED_POPULATION)
class EvaluatorComparisonStatistics:
    agreement: Optional[float] = strawberry.field(
        description=(
            "Share of the population where the two evaluators agree, reduced to "
            "flagged/not-flagged when both sides have determinable flag semantics, "
            "else to label equality when the label sets are identical; null otherwise."
        )
    )
    cohens_kappa: Optional[float] = strawberry.field(
        description="Chance-corrected agreement over the same reduction as `agreement`."
    )
    spearman_rho: Optional[float] = strawberry.field(
        description=(
            "Spearman rank correlation over the raw score pairs; null unless both "
            "evaluators emit continuous scores."
        )
    )
    disagreement_count: Optional[int] = strawberry.field(
        description="Population count minus agreements; null when `agreement` is null."
    )


@strawberry.type(description=_SHARED_POPULATION)
class EvaluatorComparisonSide:
    annotation_name: str = strawberry.field(
        description="The annotation name this evaluator writes its results under."
    )
    labels: list[str] = strawberry.field(
        description=(
            "Binned labels for this side, in matrix order. A continuous evaluator "
            "contributes flagged/not-flagged split at its threshold; a categorical "
            "evaluator contributes the labels present in range, capped with an "
            "'other' fold."
        )
    )
    flagged_labels: Optional[list[str]] = strawberry.field(
        description=(
            "Which of `labels` count as flagged; null when the evaluator's config "
            "does not determine flag semantics."
        )
    )
    threshold: Optional[float] = strawberry.field(
        description="The flag threshold used to bin scores; null for categorical sides."
    )
    flagged_count: Optional[int] = strawberry.field(
        description="Entities this evaluator flags, over the shared population."
    )
    flag_rate: Optional[float] = strawberry.field(
        description="flaggedCount over the shared population size."
    )
    mean_score: Optional[float] = strawberry.field(
        description="Mean of this evaluator's non-null scores over the shared population."
    )
    score_bin_counts: Optional[list[int]] = strawberry.field(
        description=(
            "Score histogram over the shared population: counts in 10 fixed bins over "
            "the side's score domain (the config's bounds when both are set, else "
            "[0, 1]), out-of-range scores clamped into the edge bins. Null for "
            "categorical sides — their distribution is the confusion matrix marginal."
        )
    )
    score_bin_edges: Optional[list[float]] = strawberry.field(
        description=(
            "The 11 bin edges scoreBinCounts is computed over; null for categorical sides."
        )
    )


@strawberry.type(description="One time bin's numbers over the shared population in that bin.")
class EvaluatorComparisonTimeSeriesDataPoint:
    timestamp: datetime
    evaluated_by_both: int = strawberry.field(
        description="Entities in this bin evaluated by both evaluators."
    )
    flag_rate_a: Optional[float] = strawberry.field(
        description="Evaluator A's flag rate in this bin; null without flag semantics."
    )
    flag_rate_b: Optional[float] = strawberry.field(
        description="Evaluator B's flag rate in this bin; null without flag semantics."
    )
    mean_score_a: Optional[float] = strawberry.field(
        description="Mean of evaluator A's non-null scores in this bin."
    )
    mean_score_b: Optional[float] = strawberry.field(
        description="Mean of evaluator B's non-null scores in this bin."
    )
    agreement: Optional[float] = strawberry.field(
        description="Agreement in this bin, under the same reduction as the overall statistic."
    )


@strawberry.type
class EvaluatorComparisonTimeSeries:
    data: list[EvaluatorComparisonTimeSeriesDataPoint]


@strawberry.type(
    description=(
        "Pairwise comparison of two project evaluators' results over one shared "
        "population. Confusion matrix rows follow sideA.labels and columns follow "
        "sideB.labels."
    )
)
class ProjectEvaluatorComparison:
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation level both evaluators share."
    )
    coverage: EvaluatorComparisonCoverage
    side_a: EvaluatorComparisonSide
    side_b: EvaluatorComparisonSide
    confusion_matrix: list[list[int]] = strawberry.field(
        description="Counts; rows follow sideA.labels, columns follow sideB.labels."
    )
    statistics: EvaluatorComparisonStatistics
    time_series: EvaluatorComparisonTimeSeries = strawberry.field(
        description=(
            "Per-time-bin numbers over the shared population, with empty bins "
            "filled throughout the requested range."
        )
    )


def to_gql_comparison_side(summary: SideSummary) -> EvaluatorComparisonSide:
    return EvaluatorComparisonSide(
        annotation_name=summary.annotation_name,
        labels=list(summary.labels),
        flagged_labels=list(summary.flagged_labels) if summary.flagged_labels is not None else None,
        threshold=summary.threshold,
        flagged_count=summary.flagged_count,
        flag_rate=summary.flag_rate,
        mean_score=summary.mean_score,
        score_bin_counts=list(summary.score_bin_counts)
        if summary.score_bin_counts is not None
        else None,
        score_bin_edges=list(summary.score_bin_edges)
        if summary.score_bin_edges is not None
        else None,
    )


def to_gql_comparison(
    evaluation_target: EvaluationTarget,
    coverage: EvaluatorComparisonCoverage,
    result: ComparisonResult,
    time_series_points: Sequence[ComparisonTimeSeriesPoint],
) -> ProjectEvaluatorComparison:
    return ProjectEvaluatorComparison(
        evaluation_target=evaluation_target,
        coverage=coverage,
        side_a=to_gql_comparison_side(result.side_a),
        side_b=to_gql_comparison_side(result.side_b),
        confusion_matrix=[list(row) for row in result.matrix],
        statistics=EvaluatorComparisonStatistics(
            agreement=result.agreement,
            cohens_kappa=result.cohens_kappa,
            spearman_rho=result.spearman_rho,
            disagreement_count=result.disagreement_count,
        ),
        time_series=EvaluatorComparisonTimeSeries(
            data=[
                EvaluatorComparisonTimeSeriesDataPoint(
                    timestamp=point.timestamp,
                    evaluated_by_both=point.evaluated_by_both,
                    flag_rate_a=point.flag_rate_a,
                    flag_rate_b=point.flag_rate_b,
                    mean_score_a=point.mean_score_a,
                    mean_score_b=point.mean_score_b,
                    agreement=point.agreement,
                )
                for point in time_series_points
            ]
        ),
    )
