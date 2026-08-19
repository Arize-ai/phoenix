from typing import Annotated, Literal, Optional, Union

from pydantic import Field, RootModel
from typing_extensions import TypeAlias

from .db_helper_types import DBBaseModel


class AnnotationPredicates(DBBaseModel):
    type: Literal["annotation_upserted"]
    name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None
    annotation_change: Optional[Literal["created", "updated"]] = None
    annotation_target: Optional[Literal["span", "trace", "session"]] = None
    matches_evaluator_annotations: bool = False


class EvaluationPredicates(DBBaseModel):
    type: Literal["evaluation_completed"]
    name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    result_changed_only: bool = False


TriggerPredicatesType: TypeAlias = Annotated[
    Union[AnnotationPredicates, EvaluationPredicates],
    Field(..., discriminator="type"),
]


class TriggerPredicates(RootModel[TriggerPredicatesType]):
    root: TriggerPredicatesType

