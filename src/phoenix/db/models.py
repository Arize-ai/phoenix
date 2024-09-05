from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

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
    case,
    func,
    insert,
    select,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
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

from phoenix.config import ENABLE_AUTH, get_env_database_schema
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


class JsonDict(TypeDecorator[Dict[str, Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[Dict[str, Any]], _: Dialect) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}


class JsonList(TypeDecorator[List[Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[List[Any]], _: Dialect) -> List[Any]:
        return value if isinstance(value, list) else []


class UtcTimeStamp(TypeDecorator[datetime]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = TIMESTAMP(timezone=True)

    def process_bind_param(self, value: Optional[datetime], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value)

    def process_result_value(self, value: Optional[Any], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value, timezone.utc)


class ExperimentRunOutput(TypedDict, total=False):
    task_output: Any


class Base(DeclarativeBase):
    # Enforce best practices for naming constraints
    # https://alembic.sqlalchemy.org/en/latest/naming.html#integration-of-naming-conventions-into-operations-autogenerate
    metadata = MetaData(
        schema=get_env_database_schema(),
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_N_name)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "ck": "ck_%(table_name)s_`%(constraint_name)s`",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        },
    )
    type_annotation_map = {
        Dict[str, Any]: JsonDict,
        List[Dict[str, Any]]: JsonList,
        ExperimentRunOutput: JsonDict,
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
    experiment_runs: Mapped[List["ExperimentRun"]] = relationship(
        primaryjoin="foreign(ExperimentRun.trace_id) == Trace.trace_id",
        back_populates="trace",
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
    span_id: Mapped[str] = mapped_column(index=True)
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
    llm_token_count_prompt: Mapped[Optional[int]]
    llm_token_count_completion: Mapped[Optional[int]]

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

    @hybrid_property
    def llm_token_count_total(self) -> Optional[int]:
        if self.llm_token_count_prompt is None and self.llm_token_count_completion is None:
            return None
        return (self.llm_token_count_prompt or 0) + (self.llm_token_count_completion or 0)

    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")
    document_annotations: Mapped[List["DocumentAnnotation"]] = relationship(back_populates="span")
    dataset_examples: Mapped[List["DatasetExample"]] = relationship(back_populates="span")

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


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    description: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )

    @hybrid_property
    def example_count(self) -> Optional[int]:
        if hasattr(self, "_example_count_value"):
            assert isinstance(self._example_count_value, int)
            return self._example_count_value
        return None

    @example_count.inplace.expression
    def _example_count(cls) -> ColumnElement[int]:
        return (
            select(
                func.sum(
                    case(
                        (DatasetExampleRevision.revision_kind == "CREATE", 1),
                        (DatasetExampleRevision.revision_kind == "DELETE", -1),
                        else_=0,
                    )
                )
            )
            .select_from(DatasetExampleRevision)
            .join(
                DatasetExample,
                onclause=DatasetExample.id == DatasetExampleRevision.dataset_example_id,
            )
            .filter(DatasetExample.dataset_id == cls.id)
            .label("example_count")
        )

    async def load_example_count(self, session: AsyncSession) -> None:
        if not hasattr(self, "_example_count_value"):
            self._example_count_value = await session.scalar(
                select(
                    func.sum(
                        case(
                            (DatasetExampleRevision.revision_kind == "CREATE", 1),
                            (DatasetExampleRevision.revision_kind == "DELETE", -1),
                            else_=0,
                        )
                    )
                )
                .select_from(DatasetExampleRevision)
                .join(
                    DatasetExample,
                    onclause=DatasetExample.id == DatasetExampleRevision.dataset_example_id,
                )
                .filter(DatasetExample.dataset_id == self.id)
            )


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
    )
    description: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())


class DatasetExample(Base):
    __tablename__ = "dataset_examples"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
    )
    span_rowid: Mapped[Optional[int]] = mapped_column(
        ForeignKey("spans.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())

    span: Mapped[Optional[Span]] = relationship(back_populates="dataset_examples")


class DatasetExampleRevision(Base):
    __tablename__ = "dataset_example_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_example_id: Mapped[int] = mapped_column(
        ForeignKey("dataset_examples.id", ondelete="CASCADE"),
        index=True,
    )
    dataset_version_id: Mapped[int] = mapped_column(
        ForeignKey("dataset_versions.id", ondelete="CASCADE"),
        index=True,
    )
    input: Mapped[Dict[str, Any]]
    output: Mapped[Dict[str, Any]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    revision_kind: Mapped[str] = mapped_column(
        CheckConstraint(
            "revision_kind IN ('CREATE', 'PATCH', 'DELETE')", name="valid_revision_kind"
        ),
    )
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "dataset_example_id",
            "dataset_version_id",
        ),
    )


class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
    )
    dataset_version_id: Mapped[int] = mapped_column(
        ForeignKey("dataset_versions.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str]
    description: Mapped[Optional[str]]
    repetitions: Mapped[int]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    project_name: Mapped[Optional[str]] = mapped_column(index=True)
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(
        ForeignKey("experiments.id", ondelete="CASCADE"),
        index=True,
    )
    dataset_example_id: Mapped[int] = mapped_column(
        ForeignKey("dataset_examples.id", ondelete="CASCADE"),
        index=True,
    )
    repetition_number: Mapped[int]
    trace_id: Mapped[Optional[str]]
    output: Mapped[ExperimentRunOutput]
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    prompt_token_count: Mapped[Optional[int]]
    completion_token_count: Mapped[Optional[int]]
    error: Mapped[Optional[str]]

    trace: Mapped["Trace"] = relationship(
        primaryjoin="foreign(ExperimentRun.trace_id) == Trace.trace_id",
        back_populates="experiment_runs",
    )

    __table_args__ = (
        UniqueConstraint(
            "experiment_id",
            "dataset_example_id",
            "repetition_number",
        ),
    )


class ExperimentRunAnnotation(Base):
    __tablename__ = "experiment_run_annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_run_id: Mapped[int] = mapped_column(
        ForeignKey("experiment_runs.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str]
    annotator_kind: Mapped[str] = mapped_column(
        CheckConstraint("annotator_kind IN ('LLM', 'CODE', 'HUMAN')", name="valid_annotator_kind"),
    )
    label: Mapped[Optional[str]]
    score: Mapped[Optional[float]]
    explanation: Mapped[Optional[str]]
    trace_id: Mapped[Optional[str]]
    error: Mapped[Optional[str]]
    metadata_: Mapped[Dict[str, Any]] = mapped_column("metadata")
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)

    __table_args__ = (
        UniqueConstraint(
            "experiment_run_id",
            "name",
        ),
    )


# todo: unnest the following models when auth is released (https://github.com/Arize-ai/phoenix/issues/4183)
if ENABLE_AUTH:

    class UserRole(Base):
        __tablename__ = "user_roles"
        id: Mapped[int] = mapped_column(primary_key=True)
        name: Mapped[str] = mapped_column(unique=True)
        users: Mapped[List["User"]] = relationship("User", back_populates="role")

    class User(Base):
        __tablename__ = "users"
        id: Mapped[int] = mapped_column(primary_key=True)
        user_role_id: Mapped[int] = mapped_column(
            ForeignKey("user_roles.id"),
            index=True,
        )
        role: Mapped["UserRole"] = relationship("UserRole", back_populates="users")
        username: Mapped[Optional[str]] = mapped_column(nullable=True, unique=True, index=True)
        email: Mapped[str] = mapped_column(nullable=False, unique=True, index=True)
        auth_method: Mapped[str] = mapped_column(
            CheckConstraint("auth_method IN ('LOCAL')", name="valid_auth_method")
        )
        password_hash: Mapped[Optional[str]]
        reset_password: Mapped[bool]
        created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
        updated_at: Mapped[datetime] = mapped_column(
            UtcTimeStamp, server_default=func.now(), onupdate=func.now()
        )
        deleted_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp)
        api_keys: Mapped[List["APIKey"]] = relationship("APIKey", back_populates="user")

    class APIKey(Base):
        __tablename__ = "api_keys"
        id: Mapped[int] = mapped_column(primary_key=True)
        user_id: Mapped[int] = mapped_column(
            ForeignKey("users.id"),
            index=True,
        )
        user: Mapped["User"] = relationship("User", back_populates="api_keys")
        name: Mapped[str]
        description: Mapped[Optional[str]]
        created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
        expires_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp)

    # todo: standardize audit table format (https://github.com/Arize-ai/phoenix/issues/4185)
    class AuditAPIKey(Base):
        __tablename__ = "audit_api_keys"
        id: Mapped[int] = mapped_column(primary_key=True)
        api_key_id: Mapped[int] = mapped_column(
            ForeignKey("api_keys.id"),
            nullable=False,
            index=True,
        )
        user_id: Mapped[int] = mapped_column(
            ForeignKey("users.id"),
            nullable=False,
            index=True,
        )
        action: Mapped[str] = mapped_column(
            CheckConstraint("action IN ('CREATE', 'DELETE')", name="valid_action")
        )
        created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
