"""Independent project evaluator distributions and their score and label counts."""

from typing import Optional

import strawberry


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
