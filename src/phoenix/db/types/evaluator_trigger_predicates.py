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


# Tagged even with one member, so a stored object carrying a retired tag is rejected by
# name rather than coerced into the surviving shape.
TriggerPredicatesType: TypeAlias = Annotated[
    Union[AnnotationPredicates],
    Field(..., discriminator="type"),
]


class TriggerPredicates(RootModel[TriggerPredicatesType]):
    root: TriggerPredicatesType
