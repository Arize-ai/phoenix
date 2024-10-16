from __future__ import annotations

from abc import ABC
from dataclasses import dataclass, field
from typing import ClassVar, Tuple, Type

from phoenix.db import models


@dataclass(frozen=True)
class DmlEvent(ABC):
    """
    Event corresponding to a Data Manipulation Language (DML)
    operation, e.g. insertion, update, or deletion.
    """

    table: ClassVar[Type[models.Base]]
    ids: Tuple[int, ...] = field(default_factory=tuple)

    def __bool__(self) -> bool:
        return bool(self.ids)

    def __hash__(self) -> int:
        return id(self)


@dataclass(frozen=True)
class ProjectDmlEvent(DmlEvent):
    table = models.Project


@dataclass(frozen=True)
class ProjectDeleteEvent(ProjectDmlEvent): ...


@dataclass(frozen=True)
class SpanDmlEvent(ProjectDmlEvent): ...


@dataclass(frozen=True)
class SpanInsertEvent(SpanDmlEvent): ...


@dataclass(frozen=True)
class SpanDeleteEvent(SpanDmlEvent): ...


@dataclass(frozen=True)
class DatasetDmlEvent(DmlEvent):
    table = models.Dataset


@dataclass(frozen=True)
class DatasetInsertEvent(DatasetDmlEvent): ...


@dataclass(frozen=True)
class DatasetDeleteEvent(DatasetDmlEvent): ...


@dataclass(frozen=True)
class ExperimentDmlEvent(DmlEvent):
    table = models.Experiment


@dataclass(frozen=True)
class ExperimentInsertEvent(ExperimentDmlEvent): ...


@dataclass(frozen=True)
class ExperimentDeleteEvent(ExperimentDmlEvent): ...


@dataclass(frozen=True)
class ExperimentRunDmlEvent(DmlEvent):
    table = models.ExperimentRun


@dataclass(frozen=True)
class ExperimentRunInsertEvent(ExperimentRunDmlEvent): ...


@dataclass(frozen=True)
class ExperimentRunDeleteEvent(ExperimentRunDmlEvent): ...


@dataclass(frozen=True)
class ExperimentRunAnnotationDmlEvent(DmlEvent):
    table = models.ExperimentRunAnnotation


@dataclass(frozen=True)
class ExperimentRunAnnotationInsertEvent(ExperimentRunAnnotationDmlEvent): ...


@dataclass(frozen=True)
class ExperimentRunAnnotationDeleteEvent(ExperimentRunAnnotationDmlEvent): ...


@dataclass(frozen=True)
class SpanAnnotationDmlEvent(DmlEvent):
    table = models.SpanAnnotation


@dataclass(frozen=True)
class SpanAnnotationInsertEvent(SpanAnnotationDmlEvent): ...


@dataclass(frozen=True)
class SpanAnnotationDeleteEvent(SpanAnnotationDmlEvent): ...


@dataclass(frozen=True)
class TraceAnnotationDmlEvent(DmlEvent):
    table = models.TraceAnnotation


@dataclass(frozen=True)
class TraceAnnotationInsertEvent(TraceAnnotationDmlEvent): ...


@dataclass(frozen=True)
class TraceAnnotationDeleteEvent(TraceAnnotationDmlEvent): ...


@dataclass(frozen=True)
class DocumentAnnotationDmlEvent(DmlEvent):
    table = models.DocumentAnnotation


@dataclass(frozen=True)
class DocumentAnnotationInsertEvent(DocumentAnnotationDmlEvent): ...


@dataclass(frozen=True)
class DocumentAnnotationDeleteEvent(DocumentAnnotationDmlEvent): ...
