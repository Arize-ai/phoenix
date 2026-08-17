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


@strawberry.type(
    description=(
        "A rule saying which occurrences should make its project evaluator run. Every "
        "predicate is optional, and leaving one null means it does not constrain the match, "
        "so a trigger with all of them null fires on every occurrence of its signal kind in "
        "the project. To match a set of values ('label A or B'), add one trigger per value."
    )
)
class ProjectEvaluatorTrigger(Node):
    id: NodeID[int]
    project_evaluator_id: strawberry.Private[int]
    source_project_evaluator_id: strawberry.Private[Optional[int]]
    signal_kind: EvaluatorSignalKind
    annotation_name: Optional[str] = strawberry.field(
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
        description="Match only annotations from this kind of annotator. ANNOTATION_UPSERTED only."
    )
    annotation_change: Optional[AnnotationChange] = strawberry.field(
        description="Match only new or only replaced annotations. ANNOTATION_UPSERTED only."
    )
    annotation_target: Optional[AnnotationTarget] = strawberry.field(
        description="Match only annotations attached to this kind of entity. "
        "ANNOTATION_UPSERTED only."
    )
    result_changed_only: bool = strawberry.field(
        description=(
            "Match only evaluations whose result differs from the previous one for the same "
            "target. EVALUATION_COMPLETED only."
        )
    )
    created_at: datetime
    updated_at: datetime

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The project evaluator this trigger runs."
    )
    def project_evaluator(self) -> Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]:
        from .Evaluator import ProjectEvaluator

        return ProjectEvaluator(id=self.project_evaluator_id)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Match only evaluations produced by this project evaluator, or null to match any. "
            "A project evaluator never triggers on its own result. EVALUATION_COMPLETED only."
        )
    )
    def source_project_evaluator(
        self,
    ) -> Optional[Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]]:
        from .Evaluator import ProjectEvaluator

        if self.source_project_evaluator_id is None:
            return None
        return ProjectEvaluator(id=self.source_project_evaluator_id)


def to_gql_project_evaluator_trigger(
    record: models.ProjectEvaluatorTrigger,
) -> ProjectEvaluatorTrigger:
    return ProjectEvaluatorTrigger(
        id=record.id,
        project_evaluator_id=record.project_evaluator_id,
        source_project_evaluator_id=record.source_project_evaluator_id,
        signal_kind=EvaluatorSignalKind(record.signal_kind),
        annotation_name=record.annotation_name,
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
        result_changed_only=record.result_changed_only,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )

