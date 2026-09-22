"""GraphQL types for the pairwise comparison of two project evaluators' results."""

from typing import Optional

import strawberry

from phoenix.db import models
from phoenix.server.api.helpers.evaluator_comparison import (
    ComparisonResult,
    SideSummary,
)
from phoenix.server.api.types.Evaluator import EvaluationTarget, ProjectEvaluator

_SHARED_POPULATION = (
    "Computed over the shared population: entities in the selected time range "
    "evaluated by both evaluators and binnable by both."
)


@strawberry.type
class EvaluatorComparisonCoverage:
    evaluated_by_both: int = strawberry.field(
        description=(
            "Entities in range with results from both evaluators. Counts presence only; "
            "the summaries and statistics divide by `populationSize`, which also requires "
            "both results to be binnable."
        )
    )
    only_a: int = strawberry.field(description="Entities in range evaluated only by evaluator A.")
    only_b: int = strawberry.field(description="Entities in range evaluated only by evaluator B.")
    total_in_range: int = strawberry.field(
        description="All entities of the compared evaluation target in the project and time range."
    )


_STATISTICS_EXAMPLE = (
    "Worked example, populationSize 100: A flags 40 entities and B flags 30; they agree "
    "on 25 flagged and 55 not flagged. agreement = (25 + 55) / 100 = 0.80 and "
    "disagreementCount = 20. Agreement expected by chance is "
    "0.4 × 0.3 + 0.6 × 0.7 = 0.54, so cohensKappa = (0.80 − 0.54) / (1 − 0.54) ≈ 0.57."
)


@strawberry.type(description=f"{_SHARED_POPULATION} {_STATISTICS_EXAMPLE}")
class EvaluatorComparisonStatistics:
    agreement: Optional[float] = strawberry.field(
        description=(
            "Share of the population where the two evaluators agree, reduced to "
            "flagged/not-flagged when both evaluators have determinable flag semantics, "
            "else to label equality when the label sets are identical; null otherwise. "
            "1.0 means the evaluators never disagree; 0.5 means they disagree on half "
            "the population."
        )
    )
    cohens_kappa: Optional[float] = strawberry.field(
        description=(
            "Chance-corrected agreement over the same reduction as `agreement`: "
            "1.0 is perfect agreement, 0.0 is what two independent evaluators with these "
            "flag rates would reach by chance, and negative values are worse than chance. "
            "Null when chance agreement is already 1.0 (e.g. both evaluators flag "
            "everything), where kappa is undefined."
        )
    )
    spearman_rho: Optional[float] = strawberry.field(
        description=(
            "Spearman rank correlation over the raw score pairs; null unless both "
            "evaluators emit continuous scores. 1.0 when B ranks every entity in the same "
            "order as A, −1.0 when the order is reversed, near 0.0 when the rankings are "
            "unrelated. Uses the scores, not the flag thresholds, so it is unaffected by "
            "thresholdA / thresholdB."
        )
    )
    disagreement_count: Optional[int] = strawberry.field(
        description=(
            "Population count minus agreements, i.e. populationSize × (1 − agreement); "
            "null when `agreement` is null."
        )
    )


@strawberry.type(description=f"One evaluator's numbers within a comparison. {_SHARED_POPULATION}")
class EvaluatorComparisonSummary:
    evaluator: ProjectEvaluator = strawberry.field(
        description="The project evaluator these numbers describe."
    )
    annotation_name: str = strawberry.field(
        description=(
            "The annotation name whose rows are compared: the evaluator's primary result "
            "name. Any annotation stored under this name counts, whichever source wrote it."
        )
    )
    labels: list[str] = strawberry.field(
        description=(
            "Binned labels for this evaluator, in confusion-matrix order. A continuous "
            "evaluator contributes flagged/not-flagged split at its threshold; a "
            "categorical evaluator contributes the labels present in range, capped with an "
            "'other' fold."
        )
    )
    threshold: Optional[float] = strawberry.field(
        description="The flag threshold used to bin scores; null for categorical evaluators."
    )
    flagged_count: Optional[int] = strawberry.field(
        description="Entities this evaluator flags, over the shared population."
    )
    flag_rate: Optional[float] = strawberry.field(description="flaggedCount over `populationSize`.")
    mean_score: Optional[float] = strawberry.field(
        description="Mean of this evaluator's non-null scores over the shared population."
    )


@strawberry.type(
    description=(
        "Pairwise comparison of two project evaluators' results over one shared "
        "population. Confusion matrix rows follow a.labels and columns follow b.labels."
    )
)
class ProjectEvaluatorComparison:
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target both evaluators share."
    )
    coverage: EvaluatorComparisonCoverage
    population_size: int = strawberry.field(
        description=(
            "Entities in range evaluated by both evaluators and binnable by both: the "
            "denominator of every summary and statistic. At most coverage.evaluatedByBoth."
        )
    )
    a: EvaluatorComparisonSummary = strawberry.field(
        description="Evaluator A's summary; confusion matrix rows follow its labels."
    )
    b: EvaluatorComparisonSummary = strawberry.field(
        description="Evaluator B's summary; confusion matrix columns follow its labels."
    )
    confusion_matrix: list[list[int]] = strawberry.field(
        description="Counts; rows follow a.labels, columns follow b.labels."
    )
    statistics: EvaluatorComparisonStatistics


def _to_gql_summary(
    summary: SideSummary, record: models.ProjectEvaluator
) -> EvaluatorComparisonSummary:
    return EvaluatorComparisonSummary(
        evaluator=ProjectEvaluator(id=record.id, db_record=record),
        annotation_name=summary.annotation_name,
        labels=list(summary.labels),
        threshold=summary.threshold,
        flagged_count=summary.flagged_count,
        flag_rate=summary.flag_rate,
        mean_score=summary.mean_score,
    )


def to_gql_comparison(
    evaluation_target: EvaluationTarget,
    coverage: EvaluatorComparisonCoverage,
    result: ComparisonResult,
    record_a: models.ProjectEvaluator,
    record_b: models.ProjectEvaluator,
) -> ProjectEvaluatorComparison:
    return ProjectEvaluatorComparison(
        evaluation_target=evaluation_target,
        coverage=coverage,
        population_size=result.n,
        a=_to_gql_summary(result.side_a, record_a),
        b=_to_gql_summary(result.side_b, record_b),
        confusion_matrix=[list(row) for row in result.matrix],
        statistics=EvaluatorComparisonStatistics(
            agreement=result.agreement,
            cohens_kappa=result.cohens_kappa,
            spearman_rho=result.spearman_rho,
            disagreement_count=result.disagreement_count,
        ),
    )
