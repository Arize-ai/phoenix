from typing import Optional

import strawberry

from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation


@strawberry.type
class EvaluationResult:
    """One annotation an evaluator produced, or why it could not produce it."""

    evaluator_name: str
    status: Optional[str] = strawberry.field(
        default=None,
        description=("answered, error, or refused when a decision judge declined to answer."),
    )
    annotation: Optional[ExperimentRunAnnotation] = None
    error: Optional[str] = None


@strawberry.type
class EvaluatorPreviewSubjectResult:
    """What the evaluator returned for one subject of an evaluator preview."""

    id: str = strawberry.field(description="The id the subject was sent with.")
    results: list[EvaluationResult] = strawberry.field(
        description="One result per annotation the evaluator produces; empty when error is set."
    )
    error: Optional[str] = strawberry.field(
        default=None,
        description=(
            "Why the evaluator could not run on this subject at all, such as a sandbox "
            "runtime that was busy or timed out. The other subjects are unaffected."
        ),
    )
