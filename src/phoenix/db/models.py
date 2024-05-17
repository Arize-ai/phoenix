from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    NUMERIC,
    TIMESTAMP,
    CheckConstraint,
    ColumnElement,
    Dialect,
    Float,
    ForeignKey,
    Index,
    MetaData,
    String,
    TypeDecorator,
    UniqueConstraint,
    func,
    insert,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    WriteOnlyMapped,
    mapped_column,
    relationship,
)
from sqlalchemy.sql import expression

from phoenix.datetime_utils import normalize_datetime


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")  # type: ignore
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


class UtcTimeStamp(TypeDecorator[datetime]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = TIMESTAMP(timezone=True)

    def process_bind_param(self, value: Optional[datetime], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value)

    def process_result_value(self, value: Optional[Any], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value, timezone.utc)


class Base(DeclarativeBase):
    # Enforce best practices for naming constraints
    # https://alembic.sqlalchemy.org/en/latest/naming.html#integration-of-naming-conventions-into-operations-autogenerate
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_N_name)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
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
    gradient_start_color: Mapped[str] = mapped_column(
        String,
        server_default=text("'#5bdbff'"),
    )

    gradient_end_color: Mapped[str] = mapped_column(
        String,
        server_default=text("'#1c76fc'"),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )

    traces: WriteOnlyMapped[List["Trace"]] = relationship(
        "Trace",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=True,
    )
    __table_args__ = (
        UniqueConstraint(
            "name",
        ),
    )


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_rowid: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    trace_id: Mapped[str]
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)

    @hybrid_property
    def latency_ms(self) -> float:
        # See https://docs.sqlalchemy.org/en/20/orm/extensions/hybrid.html
        return (self.end_time - self.start_time).total_seconds() * 1000

    @latency_ms.inplace.expression
    @classmethod
    def _latency_ms_expression(cls) -> ColumnElement[float]:
        # See https://docs.sqlalchemy.org/en/20/orm/extensions/hybrid.html
        return LatencyMs(cls.start_time, cls.end_time)

    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="traces",
    )
    spans: Mapped[List["Span"]] = relationship(
        "Span",
        back_populates="trace",
        cascade="all, delete-orphan",
        uselist=True,
    )
    __table_args__ = (
        UniqueConstraint(
            "trace_id",
        ),
    )


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int] = mapped_column(
        ForeignKey("traces.id", ondelete="CASCADE"),
        index=True,
    )
    span_id: Mapped[str]
    parent_id: Mapped[Optional[str]] = mapped_column(index=True)
    name: Mapped[str]
    span_kind: Mapped[str]
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    attributes: Mapped[Dict[str, Any]]
    events: Mapped[List[Dict[str, Any]]]
    status_code: Mapped[str] = mapped_column(
        CheckConstraint("status_code IN ('OK', 'ERROR', 'UNSET')", name="valid_status")
    )
    status_message: Mapped[str]

    # TODO(mikeldking): is computed columns possible here
    cumulative_error_count: Mapped[int]
    cumulative_llm_token_count_prompt: Mapped[int]
    cumulative_llm_token_count_completion: Mapped[int]

    @hybrid_property
    def latency_ms(self) -> float:
        # See https://docs.sqlalchemy.org/en/20/orm/extensions/hybrid.html
        return (self.end_time - self.start_time).total_seconds() * 1000

    @latency_ms.inplace.expression
    @classmethod
    def _latency_ms_expression(cls) -> ColumnElement[float]:
        # See https://docs.sqlalchemy.org/en/20/orm/extensions/hybrid.html
        return LatencyMs(cls.start_time, cls.end_time)

    @hybrid_property
    def cumulative_llm_token_count_total(self) -> int:
        return self.cumulative_llm_token_count_prompt + self.cumulative_llm_token_count_completion

    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")
    document_annotations: Mapped[List["DocumentAnnotation"]] = relationship(back_populates="span")

    __table_args__ = (
        UniqueConstraint(
            "span_id",
            sqlite_on_conflict="IGNORE",
        ),
        Index("ix_latency", text("(end_time - start_time)")),
        Index(
            "ix_cumulative_llm_token_count_total",
            text("(cumulative_llm_token_count_prompt + cumulative_llm_token_count_completion)"),
        ),
    )


class LatencyMs(expression.FunctionElement[float]):
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    inherit_cache = True
    type = Float()
    name = "latency_ms"


@compiles(LatencyMs)  # type: ignore
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    start_time, end_time = list(element.clauses)
    return compiler.process(
        func.round(
            func.cast(
                (func.extract("EPOCH", end_time) - func.extract("EPOCH", start_time)) * 1000,
                NUMERIC,
            ),
            1,
        ),
        **kw,
    )


@compiles(LatencyMs, "sqlite")  # type: ignore
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    start_time, end_time = list(element.clauses)
    return compiler.process(
        # We don't know why sqlite returns a slightly different value.
        # postgresql is correct because it matches the value computed by Python.
        func.round(
            (func.unixepoch(end_time, "subsec") - func.unixepoch(start_time, "subsec")) * 1000, 1
        ),
        **kw,
    )


class TextContains(expression.FunctionElement[str]):
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    inherit_cache = True
    type = String()
    name = "text_contains"


@compiles(TextContains)  # type: ignore
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    string, substring = list(element.clauses)
    return compiler.process(string.contains(substring), **kw)


@compiles(TextContains, "postgresql")  # type: ignore
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    string, substring = list(element.clauses)
    return compiler.process(func.strpos(string, substring) > 0, **kw)


@compiles(TextContains, "sqlite")  # type: ignore
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    string, substring = list(element.clauses)
    return compiler.process(func.text_contains(string, substring) > 0, **kw)


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
    span_rowid: Mapped[int] = mapped_column(
        ForeignKey("spans.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str]
    label: Mapped[Optional[str]] = mapped_column(String, index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, index=True)
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
            "name",
            "span_rowid",
        ),
    )


class TraceAnnotation(Base):
    __tablename__ = "trace_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int] = mapped_column(
        ForeignKey("traces.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str]
    label: Mapped[Optional[str]] = mapped_column(String, index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, index=True)
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
            "name",
            "trace_rowid",
        ),
    )


class DocumentAnnotation(Base):
    __tablename__ = "document_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    span_rowid: Mapped[int] = mapped_column(
        ForeignKey("spans.id", ondelete="CASCADE"),
        index=True,
    )
    document_position: Mapped[int]
    name: Mapped[str]
    label: Mapped[Optional[str]] = mapped_column(String, index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, index=True)
    explanation: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    annotator_kind: Mapped[str] = mapped_column(
        CheckConstraint("annotator_kind IN ('LLM', 'HUMAN')", name="valid_annotator_kind"),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    span: Mapped["Span"] = relationship(back_populates="document_annotations")

    __table_args__ = (
        UniqueConstraint(
            "name",
            "span_rowid",
            "document_position",
        ),
    )
