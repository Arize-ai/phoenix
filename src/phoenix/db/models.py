from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    CheckConstraint,
    Dialect,
    ForeignKey,
    MetaData,
    TypeDecorator,
    UniqueConstraint,
    func,
    insert,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    WriteOnlyMapped,
    mapped_column,
    relationship,
)

JSON_ = JSON().with_variant(
    postgresql.JSONB(),  # type: ignore
    "postgresql",
)


class UtcTimeStamp(TypeDecorator[datetime]):
    """TODO(persistence): Figure out how to reliably store and retrieve
    timezone-aware datetime objects from the (sqlite) database. Below is a
    workaround to guarantee that the timestamps we fetch from the database is
    always timezone-aware, in order to prevent comparisons of timezone-naive
    datetime with timezone-aware datetime, because objects in the rest of our
    programs are always timezone-aware.
    """

    cache_ok = True
    impl = TIMESTAMP(timezone=True)
    _LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo

    def process_bind_param(
        self,
        value: Optional[datetime],
        dialect: Dialect,
    ) -> Optional[datetime]:
        if not value:
            return None
        if value.tzinfo is None:
            value = value.astimezone(self._LOCAL_TIMEZONE)
        return value.astimezone(timezone.utc)

    def process_result_value(
        self,
        value: Optional[Any],
        dialect: Dialect,
    ) -> Optional[datetime]:
        if not isinstance(value, datetime):
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


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
        Dict[str, Any]: JSON_,
        List[Dict[str, Any]]: JSON_,
    }


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[Optional[str]]
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
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
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    latency_ms: Mapped[float]

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
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    attributes: Mapped[Dict[str, Any]]
    events: Mapped[List[Dict[str, Any]]]
    status: Mapped[str] = mapped_column(
        CheckConstraint("status IN ('OK', 'ERROR', 'UNSET')", name="valid_status")
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


class SpanAnnotation(Base):
    __tablename__ = "span_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    span_rowid: Mapped[int] = mapped_column(ForeignKey("spans.id"))
    name: Mapped[str]
    label: Mapped[Optional[str]]
    score: Mapped[Optional[float]]
    explanation: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    annotator_kind: Mapped[str] = mapped_column(
        CheckConstraint("annotator_kind IN ('LLM', 'HUMAN')", name="valid_annotator_kind"),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        UniqueConstraint(
            "span_rowid",
            "name",
            name="uq_span_annotations_span_rowid_name",
            sqlite_on_conflict="REPLACE",
        ),
    )


class TraceAnnotation(Base):
    __tablename__ = "trace_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int] = mapped_column(ForeignKey("traces.id"))
    name: Mapped[str]
    label: Mapped[Optional[str]]
    score: Mapped[Optional[float]]
    explanation: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    annotator_kind: Mapped[str] = mapped_column(
        CheckConstraint("annotator_kind IN ('LLM', 'HUMAN')", name="valid_annotator_kind"),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        UniqueConstraint(
            "trace_rowid",
            "name",
            name="uq_trace_annotations_trace_rowid_name",
            sqlite_on_conflict="REPLACE",
        ),
    )


class DocumentAnnotation(Base):
    __tablename__ = "document_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    span_rowid: Mapped[int] = mapped_column(ForeignKey("spans.id"))
    document_index: Mapped[int]
    name: Mapped[str]
    label: Mapped[Optional[str]]
    score: Mapped[Optional[float]]
    explanation: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    annotator_kind: Mapped[str] = mapped_column(
        CheckConstraint("annotator_kind IN ('LLM', 'HUMAN')", name="valid_annotator_kind"),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        UniqueConstraint(
            "span_rowid",
            "document_index",
            "name",
            name="uq_document_annotations_span_rowid_document_index_name",
            sqlite_on_conflict="REPLACE",
        ),
    )
