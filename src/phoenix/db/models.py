from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    MetaData,
    UniqueConstraint,
    func,
    insert,
)
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    WriteOnlyMapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    # Enforce best practices for naming constraints
    # https://alembic.sqlalchemy.org/en/latest/naming.html#integration-of-naming-conventions-into-operations-autogenerate
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_`%(constraint_name)s`",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )
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
            name="uq_projects_name",
            sqlite_on_conflict="IGNORE",
        ),
    )


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_rowid: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    session_id: Mapped[Optional[str]]
    trace_id: Mapped[str]
    start_time: Mapped[datetime] = mapped_column(DateTime(), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime())

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
            name="uq_traces_trace_id",
            sqlite_on_conflict="IGNORE",
        ),
    )


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int] = mapped_column(ForeignKey("traces.id"))
    span_id: Mapped[str]
    parent_span_id: Mapped[Optional[str]] = mapped_column(index=True)
    name: Mapped[str]
    kind: Mapped[str]
    start_time: Mapped[datetime] = mapped_column(DateTime())
    end_time: Mapped[datetime] = mapped_column(DateTime())
    attributes: Mapped[Dict[str, Any]]
    events: Mapped[List[Dict[str, Any]]]
    status: Mapped[str] = mapped_column(
        CheckConstraint("status IN ('OK', 'ERROR', 'UNSET')", "valid_status")
    )
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
            name="uq_spans_span_id",
            sqlite_on_conflict="IGNORE",
        ),
    )


async def init_models(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            insert(Project).values(
                name="default",
                description="default project",
            )
        )
