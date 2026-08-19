from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

if TYPE_CHECKING:
    from .Evaluator import ProjectEvaluator


@strawberry.enum(description="The kind of occurrence a trigger matches on.")
class EvaluatorSignalKind(Enum):
    ANNOTATION_UPSERTED = "annotation_upserted"
    EVALUATION_COMPLETED = "evaluation_completed"


@strawberry.enum(
    description="Whether an annotation was written for the first time or replaced an earlier value."
)
class AnnotationChange(Enum):
    CREATED = "created"
    UPDATED = "updated"


@strawberry.enum(description="What an annotation is attached to.")
class AnnotationTarget(Enum):
    SPAN = "span"
    TRACE = "trace"
    SESSION = "session"


_MATCHES_EVALUATOR_ANNOTATIONS_DESCRIPTION = (
    "Also match annotations written by other project evaluators, not only the ones written "
    "by people or through the API. A project evaluator never matches its own annotations."
)


@strawberry.type(
    description=(
        "What an annotation must look like for its trigger to fire. Every predicate is "
        "optional, and leaving one null means it does not constrain the match."
    )
)
class ProjectEvaluatorTriggerAnnotationPredicates:
    name: Optional[str] = strawberry.field(
        description="Match only annotations written under this name."
    )
    label: Optional[str] = strawberry.field(description="Match only this annotation label.")
    score_below: Optional[float] = strawberry.field(
        description="Match only scores strictly below this value; unscored results never match."
    )
    score_above: Optional[float] = strawberry.field(
        description="Match only scores strictly above this value; unscored results never match."
    )
    annotator_kind: Optional[AnnotatorKind] = strawberry.field(
        description="Match only annotations from this kind of annotator."
    )
    annotation_change: Optional[AnnotationChange] = strawberry.field(
        description="Match only new or only replaced annotations."
    )
    annotation_target: Optional[AnnotationTarget] = strawberry.field(
        description="Match only annotations attached to this kind of entity."
    )
    matches_evaluator_annotations: bool = strawberry.field(
        description=_MATCHES_EVALUATOR_ANNOTATIONS_DESCRIPTION
    )


@strawberry.type(
    description=(
        "What a finished evaluation must look like for its trigger to fire. Every predicate "
        "is optional, and leaving one null means it does not constrain the match."
    )
)
class ProjectEvaluatorTriggerEvaluationPredicates:
    source_criteria_id: strawberry.Private[Optional[int]]
    name: Optional[str] = strawberry.field(
        description="Match only evaluations recorded under this name."
    )
    label: Optional[str] = strawberry.field(description="Match only this result label.")
    score_below: Optional[float] = strawberry.field(
        description="Match only scores strictly below this value; unscored results never match."
    )
    score_above: Optional[float] = strawberry.field(
        description="Match only scores strictly above this value; unscored results never match."
    )
    result_changed_only: bool = strawberry.field(
        description=(
            "Match only evaluations whose result differs from the previous one for the same target."
        )
    )

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Match only evaluations produced by this project evaluator, or null to match any. "
            "A project evaluator never triggers on its own result."
        )
    )
    def source_project_evaluator(
        self,
    ) -> Optional[Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]]:
        from .Evaluator import ProjectEvaluator

        if self.source_criteria_id is None:
            return None
        return ProjectEvaluator(id=self.source_criteria_id)


@strawberry.type(
    description=(
        "A rule saying which occurrences should make its project evaluator run. Its predicates "
        "live in the object for its signal kind; leaving that object null means the trigger "
        "fires on every occurrence of that kind in the project. To match a set of values "
        "('label A or B'), add one trigger per value. A trigger applies to occurrences recorded "
        "after it is created and never to earlier ones; use requestProjectSessionEvaluation to "
        "evaluate sessions that already match."
    )
)
class ProjectEvaluatorTrigger(Node):
    id: NodeID[int]
    criteria_id: strawberry.Private[int]
    signal_kind: EvaluatorSignalKind
    annotation_predicates: Optional[ProjectEvaluatorTriggerAnnotationPredicates] = strawberry.field(
        description=(
            "What an annotation must look like for this trigger to fire, or null to match every "
            "annotation. Null unless the signal kind is ANNOTATION_UPSERTED."
        )
    )
    evaluation_predicates: Optional[ProjectEvaluatorTriggerEvaluationPredicates] = strawberry.field(
        description=(
            "What a finished evaluation must look like for this trigger to fire, or null to "
            "match every evaluation. Null unless the signal kind is EVALUATION_COMPLETED."
        )
    )
    created_at: datetime
    updated_at: datetime

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The project evaluator this trigger runs."
    )
    def project_evaluator(self) -> Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]:
        from .Evaluator import ProjectEvaluator

        return ProjectEvaluator(id=self.criteria_id)


def to_gql_project_evaluator_trigger(
    record: models.ProjectEvaluatorTrigger,
) -> ProjectEvaluatorTrigger:
    """Build the GraphQL trigger from a record whose predicate children are already loaded."""
    return ProjectEvaluatorTrigger(
        id=record.id,
        criteria_id=record.criteria_id,
        signal_kind=EvaluatorSignalKind(record.signal_kind),
        annotation_predicates=_to_gql_annotation_predicates(record.annotation_predicates),
        evaluation_predicates=_to_gql_evaluation_predicates(record.evaluation_predicates),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _to_gql_annotation_predicates(
    record: Optional[models.ProjectEvaluatorTriggerAnnotationPredicates],
) -> Optional[ProjectEvaluatorTriggerAnnotationPredicates]:
    if record is None:
        return None
    return ProjectEvaluatorTriggerAnnotationPredicates(
        name=record.name,
        label=record.label,
        score_below=record.score_below,
        score_above=record.score_above,
        annotator_kind=(
            AnnotatorKind(record.annotator_kind) if record.annotator_kind is not None else None
        ),
        annotation_change=(
            AnnotationChange(record.annotation_change)
            if record.annotation_change is not None
            else None
        ),
        annotation_target=(
            AnnotationTarget(record.annotation_target)
            if record.annotation_target is not None
            else None
        ),
        matches_evaluator_annotations=record.matches_evaluator_annotations,
    )


def _to_gql_evaluation_predicates(
    record: Optional[models.ProjectEvaluatorTriggerEvaluationPredicates],
) -> Optional[ProjectEvaluatorTriggerEvaluationPredicates]:
    if record is None:
        return None
    return ProjectEvaluatorTriggerEvaluationPredicates(
        source_criteria_id=record.source_criteria_id,
        name=record.name,
        label=record.label,
        score_below=record.score_below,
        score_above=record.score_above,
        result_changed_only=record.result_changed_only,
    )
