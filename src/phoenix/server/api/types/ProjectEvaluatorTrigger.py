from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.db.types.evaluator_trigger_predicates import (
    AnnotationPredicates,
    TriggerPredicates,
)
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

if TYPE_CHECKING:
    from .Evaluator import ProjectEvaluator


@strawberry.enum(description="The kind of event a trigger matches on.")
class EvaluatorEventKind(Enum):
    ANNOTATION_UPSERTED = "annotation_upserted"


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


ANNOTATION_TARGET_DESCRIPTION = (
    "Match only annotations attached to this kind of entity. Annotations on spans or "
    "traces outside any session cannot match SESSION evaluators."
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
        description=ANNOTATION_TARGET_DESCRIPTION
    )


@strawberry.type(
    description=(
        "A rule saying which events should make its project evaluator run. Its predicates "
        "live in the object for its event kind; leaving that object null means the trigger "
        "fires on every event of that kind in the project, including annotations project "
        "evaluators write. To match a set of values ('label A or B'), add one trigger per "
        "value. A trigger applies to events recorded after it is created and never to "
        "earlier ones; use requestProjectSessionEvaluation to evaluate sessions that "
        "already match."
    )
)
class ProjectEvaluatorTrigger(Node):
    id: NodeID[int]
    criteria_id: strawberry.Private[int]
    event_kind: EvaluatorEventKind
    annotation_predicates: Optional[ProjectEvaluatorTriggerAnnotationPredicates] = strawberry.field(
        description=(
            "What an annotation must look like for this trigger to fire, or null to match "
            "every annotation written in the project, whoever wrote it."
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
    """Build the GraphQL trigger from its validated predicate JSON."""
    predicates = (
        TriggerPredicates(root=record.predicates).root if record.predicates is not None else None
    )
    if predicates is not None and predicates.type != record.event_kind:
        raise ValueError(
            f"Trigger {record.id} predicate type {predicates.type} disagrees with "
            f"event kind {record.event_kind}"
        )
    return ProjectEvaluatorTrigger(
        id=record.id,
        criteria_id=record.criteria_id,
        event_kind=EvaluatorEventKind(record.event_kind),
        annotation_predicates=_to_gql_annotation_predicates(predicates),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _to_gql_annotation_predicates(
    predicates: Optional[AnnotationPredicates],
) -> Optional[ProjectEvaluatorTriggerAnnotationPredicates]:
    if not isinstance(predicates, AnnotationPredicates):
        return None
    return ProjectEvaluatorTriggerAnnotationPredicates(
        name=predicates.name,
        label=predicates.label,
        score_below=predicates.score_below,
        score_above=predicates.score_above,
        annotator_kind=(
            AnnotatorKind(predicates.annotator_kind)
            if predicates.annotator_kind is not None
            else None
        ),
        annotation_change=(
            AnnotationChange(predicates.annotation_change)
            if predicates.annotation_change is not None
            else None
        ),
        annotation_target=(
            AnnotationTarget(predicates.annotation_target)
            if predicates.annotation_target is not None
            else None
        ),
    )
