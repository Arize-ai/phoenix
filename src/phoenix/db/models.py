from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    WriteOnlyMapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    type_annotation_map = {
        Dict[str, Any]: JSON,
        List[Dict[str, Any]]: JSON,
    }


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[Optional[str]]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    traces: WriteOnlyMapped["Trace"] = relationship(
        "Trace",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    __table_args__ = (
        UniqueConstraint(
            "name",
            name="project_name_unique",
            sqlite_on_conflict="IGNORE",
        ),
    )


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_rowid: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    session_id: Mapped[Optional[str]]
    trace_id: Mapped[str]
    # TODO(mikeldking): why is the start and end time necessary? just filtering?
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="traces",
    )
    spans: Mapped[List["Span"]] = relationship(
        "Span",
        back_populates="trace",
        cascade="all, delete-orphan",
    )
    __table_args__ = (
        UniqueConstraint(
            "trace_id",
            name="trace_id_unique",
            sqlite_on_conflict="IGNORE",
        ),
    )


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int] = mapped_column(ForeignKey("traces.id"))
    span_id: Mapped[str]
    parent_span_id: Mapped[Optional[str]]
    name: Mapped[str]
    kind: Mapped[str]
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attributes: Mapped[Dict[str, Any]]
    events: Mapped[List[Dict[str, Any]]]
    status: Mapped[str]
    status_message: Mapped[str]

    # TODO(mikeldking): is computed columns possible here
    latency_ms: Mapped[float]
    cumulative_error_count: Mapped[int]
    cumulative_llm_token_count_prompt: Mapped[int]
    cumulative_llm_token_count_completion: Mapped[int]

    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")

    __table_args__ = (
        UniqueConstraint(
            "span_id",
            name="trace_id_unique",
            sqlite_on_conflict="IGNORE",
        ),
    )
