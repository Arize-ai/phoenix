from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional, Sequence, TypedDict

import sqlalchemy.sql as sql
from openinference.semconv.trace import RerankerAttributes, SpanAttributes
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
    Integer,
    MetaData,
    Null,
    String,
    TypeDecorator,
    UniqueConstraint,
    case,
    func,
    insert,
    not_,
    select,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.sqlite.base import SQLiteCompiler
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
from sqlalchemy.sql.compiler import SQLCompiler
from sqlalchemy.sql.functions import coalesce

from phoenix.config import get_env_database_schema
from phoenix.datetime_utils import normalize_datetime
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptInvocationParameters,
    PromptInvocationParametersRootModel,
    PromptResponseFormat,
    PromptResponseFormatRootModel,
    PromptTemplate,
    PromptTemplateFormat,
    PromptTemplateRootModel,
    PromptTemplateType,
    PromptTools,
    is_prompt_invocation_parameters,
    is_prompt_template,
)
from phoenix.trace.attributes import get_attribute_value

INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL.split(".")
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split(".")
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split(".")
METADATA = SpanAttributes.METADATA.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
RERANKER_OUTPUT_DOCUMENTS = RerankerAttributes.RERANKER_OUTPUT_DOCUMENTS.split(".")
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS.split(".")


class AuthMethod(Enum):
    LOCAL = "LOCAL"
    OAUTH2 = "OAUTH2"


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
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


class JsonDict(TypeDecorator[dict[str, Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[dict[str, Any]], _: Dialect) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}


class JsonList(TypeDecorator[list[Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[list[Any]], _: Dialect) -> list[Any]:
        return value if isinstance(value, list) else []


class UtcTimeStamp(TypeDecorator[datetime]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = TIMESTAMP(timezone=True)

    def process_bind_param(self, value: Optional[datetime], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value)

    def process_result_value(self, value: Optional[Any], _: Dialect) -> Optional[datetime]:
        return normalize_datetime(value, timezone.utc)


class _Identifier(TypeDecorator[Identifier]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = String

    def process_bind_param(self, value: Optional[Identifier], _: Dialect) -> Optional[str]:
        assert isinstance(value, Identifier) or value is None
        return None if value is None else value.root

    def process_result_value(self, value: Optional[str], _: Dialect) -> Optional[Identifier]:
        return None if value is None else Identifier.model_validate(value)


class _ModelProvider(TypeDecorator[ModelProvider]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = String

    def process_bind_param(self, value: Optional[ModelProvider], _: Dialect) -> Optional[str]:
        if isinstance(value, str):
            return ModelProvider(value).value
        return None if value is None else value.value

    def process_result_value(self, value: Optional[str], _: Dialect) -> Optional[ModelProvider]:
        return None if value is None else ModelProvider(value)


class _InvocationParameters(TypeDecorator[PromptInvocationParameters]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(
        self, value: Optional[PromptInvocationParameters], _: Dialect
    ) -> Optional[dict[str, Any]]:
        assert is_prompt_invocation_parameters(value)
        invocation_parameters = value.model_dump()
        assert isinstance(invocation_parameters, dict)
        return invocation_parameters

    def process_result_value(
        self, value: Optional[dict[str, Any]], _: Dialect
    ) -> Optional[PromptInvocationParameters]:
        assert isinstance(value, dict)
        return PromptInvocationParametersRootModel.model_validate(value).root


class _PromptTemplate(TypeDecorator[PromptTemplate]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(
        self, value: Optional[PromptTemplate], _: Dialect
    ) -> Optional[dict[str, Any]]:
        assert is_prompt_template(value)
        return value.model_dump() if value is not None else None

    def process_result_value(
        self, value: Optional[dict[str, Any]], _: Dialect
    ) -> Optional[PromptTemplate]:
        assert isinstance(value, dict)
        return PromptTemplateRootModel.model_validate(value).root


class _Tools(TypeDecorator[PromptTools]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(
        self, value: Optional[PromptTools], _: Dialect
    ) -> Optional[dict[str, Any]]:
        return value.model_dump() if value is not None else None

    def process_result_value(
        self, value: Optional[dict[str, Any]], _: Dialect
    ) -> Optional[PromptTools]:
        return PromptTools.model_validate(value) if value is not None else None


class _PromptResponseFormat(TypeDecorator[PromptResponseFormat]):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(
        self, value: Optional[PromptResponseFormat], _: Dialect
    ) -> Optional[dict[str, Any]]:
        return value.model_dump() if value is not None else None

    def process_result_value(
        self, value: Optional[dict[str, Any]], _: Dialect
    ) -> Optional[PromptResponseFormat]:
        return (
            PromptResponseFormatRootModel.model_validate(value).root if value is not None else None
        )


class _PromptTemplateType(TypeDecorator[PromptTemplateType]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = String

    def process_bind_param(self, value: Optional[PromptTemplateType], _: Dialect) -> Optional[str]:
        if isinstance(value, str):
            return PromptTemplateType(value).value
        return None if value is None else value.value

    def process_result_value(
        self, value: Optional[str], _: Dialect
    ) -> Optional[PromptTemplateType]:
        return None if value is None else PromptTemplateType(value)


class _TemplateFormat(TypeDecorator[PromptTemplateFormat]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = String

    def process_bind_param(
        self, value: Optional[PromptTemplateFormat], _: Dialect
    ) -> Optional[str]:
        if isinstance(value, str):
            return PromptTemplateFormat(value).value
        return None if value is None else value.value

    def process_result_value(
        self, value: Optional[str], _: Dialect
    ) -> Optional[PromptTemplateFormat]:
        return None if value is None else PromptTemplateFormat(value)


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
        dict[str, Any]: JsonDict,
        list[dict[str, Any]]: JsonList,
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

    traces: WriteOnlyMapped[list["Trace"]] = relationship(
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


class ProjectSession(Base):
    __tablename__ = "project_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True, nullable=False)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True, nullable=False)
    traces: Mapped[list["Trace"]] = relationship(
        "Trace",
        back_populates="project_session",
        uselist=True,
    )


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_rowid: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trace_id: Mapped[str]
    project_session_rowid: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_sessions.id", ondelete="CASCADE"),
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp, index=True)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)

    @hybrid_property
    def latency_ms(self) -> float:
        return (self.end_time - self.start_time).total_seconds() * 1000

    @latency_ms.inplace.expression
    @classmethod
    def _latency_ms_expression(cls) -> ColumnElement[float]:
        return LatencyMs(cls.start_time, cls.end_time)

    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="traces",
    )
    spans: Mapped[list["Span"]] = relationship(
        "Span",
        back_populates="trace",
        cascade="all, delete-orphan",
        uselist=True,
    )
    project_session: Mapped[ProjectSession] = relationship(
        "ProjectSession",
        back_populates="traces",
    )
    experiment_runs: Mapped[list["ExperimentRun"]] = relationship(
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
    attributes: Mapped[dict[str, Any]]
    events: Mapped[list[dict[str, Any]]]
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
        return round((self.end_time - self.start_time).total_seconds() * 1000, 1)

    @latency_ms.inplace.expression
    @classmethod
    def _latency_ms_expression(cls) -> ColumnElement[float]:
        return LatencyMs(cls.start_time, cls.end_time)

    @hybrid_property
    def input_value(self) -> Any:
        return get_attribute_value(self.attributes, INPUT_VALUE)

    @input_value.inplace.expression
    @classmethod
    def _input_value_expression(cls) -> ColumnElement[Any]:
        return cls.attributes[INPUT_VALUE]

    @hybrid_property
    def input_value_first_101_chars(self) -> Any:
        if (v := get_attribute_value(self.attributes, INPUT_VALUE)) is None:
            return None
        return str(v)[:101]

    @input_value_first_101_chars.inplace.expression
    @classmethod
    def _input_value_first_101_chars_expression(cls) -> ColumnElement[Any]:
        return case(
            (
                cls.attributes[INPUT_VALUE] != sql.null(),
                func.substr(cls.attributes[INPUT_VALUE].as_string(), 1, 101),
            ),
        )

    @hybrid_property
    def input_mime_type(self) -> Any:
        return get_attribute_value(self.attributes, INPUT_MIME_TYPE)

    @input_mime_type.inplace.expression
    @classmethod
    def _input_mime_type_expression(cls) -> ColumnElement[Any]:
        return cls.attributes[INPUT_MIME_TYPE]

    @hybrid_property
    def output_value(self) -> Any:
        return get_attribute_value(self.attributes, OUTPUT_VALUE)

    @output_value.inplace.expression
    @classmethod
    def _output_value_expression(cls) -> ColumnElement[Any]:
        return cls.attributes[OUTPUT_VALUE]

    @hybrid_property
    def output_value_first_101_chars(self) -> Any:
        if (v := get_attribute_value(self.attributes, OUTPUT_VALUE)) is None:
            return None
        return str(v)[:101]

    @output_value_first_101_chars.inplace.expression
    @classmethod
    def _output_value_first_101_chars_expression(cls) -> ColumnElement[Any]:
        return case(
            (
                cls.attributes[OUTPUT_VALUE] != sql.null(),
                func.substr(cls.attributes[OUTPUT_VALUE].as_string(), 1, 101),
            ),
        )

    @hybrid_property
    def output_mime_type(self) -> Any:
        return get_attribute_value(self.attributes, OUTPUT_MIME_TYPE)

    @output_mime_type.inplace.expression
    @classmethod
    def _output_mime_type_expression(cls) -> ColumnElement[Any]:
        return cls.attributes[OUTPUT_MIME_TYPE]

    @hybrid_property
    def metadata_(self) -> Any:
        return get_attribute_value(self.attributes, METADATA)

    @metadata_.inplace.expression
    @classmethod
    def _metadata_expression(cls) -> ColumnElement[Any]:
        return cls.attributes[METADATA]

    @hybrid_property
    def num_documents(self) -> int:
        if self.span_kind.upper() == "RERANKER":
            reranker_documents = get_attribute_value(self.attributes, RERANKER_OUTPUT_DOCUMENTS)
            return len(reranker_documents) if isinstance(reranker_documents, Sequence) else 0
        retrieval_documents = get_attribute_value(self.attributes, RETRIEVAL_DOCUMENTS)
        return len(retrieval_documents) if isinstance(retrieval_documents, Sequence) else 0

    @num_documents.inplace.expression
    @classmethod
    def _num_documents_expression(cls) -> ColumnElement[int]:
        return NumDocuments(cls.attributes, cls.span_kind)

    @hybrid_property
    def cumulative_llm_token_count_total(self) -> int:
        return self.cumulative_llm_token_count_prompt + self.cumulative_llm_token_count_completion

    @cumulative_llm_token_count_total.inplace.expression
    @classmethod
    def _cumulative_llm_token_count_total_expression(cls) -> ColumnElement[int]:
        return cls.cumulative_llm_token_count_prompt + cls.cumulative_llm_token_count_completion

    @hybrid_property
    def llm_token_count_total(self) -> int:
        return (self.llm_token_count_prompt or 0) + (self.llm_token_count_completion or 0)

    @llm_token_count_total.inplace.expression
    @classmethod
    def _llm_token_count_total_expression(cls) -> ColumnElement[int]:
        return coalesce(
            coalesce(cls.llm_token_count_prompt, 0) + coalesce(cls.llm_token_count_completion, 0),
            0,
        )

    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")
    document_annotations: Mapped[list["DocumentAnnotation"]] = relationship(back_populates="span")
    dataset_examples: Mapped[list["DatasetExample"]] = relationship(back_populates="span")

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


@compiles(LatencyMs)
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


@compiles(LatencyMs, "sqlite")
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


class NumDocuments(expression.FunctionElement[int]):
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    inherit_cache = True
    type = Integer()
    name = "num_documents"


@compiles(NumDocuments)
def _(element: Any, compiler: SQLCompiler, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    array_length = (
        func.json_array_length if isinstance(compiler, SQLiteCompiler) else func.jsonb_array_length
    )
    attributes, span_kind = list(element.clauses)
    retrieval_docs = attributes[RETRIEVAL_DOCUMENTS]
    num_retrieval_docs = coalesce(array_length(retrieval_docs), 0)
    reranker_docs = attributes[RERANKER_OUTPUT_DOCUMENTS]
    num_reranker_docs = coalesce(array_length(reranker_docs), 0)
    return compiler.process(
        sql.case(
            (func.upper(span_kind) == "RERANKER", num_reranker_docs),
            else_=num_retrieval_docs,
        ),
        **kw,
    )


class TextContains(expression.FunctionElement[str]):
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    inherit_cache = True
    type = String()
    name = "text_contains"


@compiles(TextContains)
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    string, substring = list(element.clauses)
    return compiler.process(string.contains(substring), **kw)


@compiles(TextContains, "postgresql")
def _(element: Any, compiler: Any, **kw: Any) -> Any:
    # See https://docs.sqlalchemy.org/en/20/core/compiler.html
    string, substring = list(element.clauses)
    return compiler.process(func.strpos(string, substring) > 0, **kw)


@compiles(TextContains, "sqlite")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    input: Mapped[dict[str, Any]]
    output: Mapped[dict[str, Any]]
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
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

    @hybrid_property
    def latency_ms(self) -> float:
        return (self.end_time - self.start_time).total_seconds() * 1000

    @latency_ms.inplace.expression
    @classmethod
    def _latency_expression(cls) -> ColumnElement[float]:
        return LatencyMs(cls.start_time, cls.end_time)

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
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
    start_time: Mapped[datetime] = mapped_column(UtcTimeStamp)
    end_time: Mapped[datetime] = mapped_column(UtcTimeStamp)

    __table_args__ = (
        UniqueConstraint(
            "experiment_run_id",
            "name",
        ),
    )


class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True, index=True)
    users: Mapped[list["User"]] = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_role_id: Mapped[int] = mapped_column(
        ForeignKey("user_roles.id", ondelete="CASCADE"),
        index=True,
    )
    role: Mapped["UserRole"] = relationship("UserRole", back_populates="users")
    username: Mapped[str] = mapped_column(nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(nullable=False, unique=True, index=True)
    profile_picture_url: Mapped[Optional[str]]
    password_hash: Mapped[Optional[bytes]]
    password_salt: Mapped[Optional[bytes]]
    reset_password: Mapped[bool]
    oauth2_client_id: Mapped[Optional[str]] = mapped_column(index=True, nullable=True)
    oauth2_user_id: Mapped[Optional[str]] = mapped_column(index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
    password_reset_token: Mapped[Optional["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        uselist=False,
    )
    access_tokens: Mapped[list["AccessToken"]] = relationship("AccessToken", back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user"
    )
    api_keys: Mapped[list["ApiKey"]] = relationship("ApiKey", back_populates="user")

    @hybrid_property
    def auth_method(self) -> Optional[str]:
        if self.password_hash is not None:
            return AuthMethod.LOCAL.value
        elif self.oauth2_client_id is not None:
            return AuthMethod.OAUTH2.value
        return None

    @auth_method.inplace.expression
    @classmethod
    def _auth_method_expression(cls) -> ColumnElement[Optional[str]]:
        return case(
            (
                not_(cls.password_hash.is_(None)),
                AuthMethod.LOCAL.value,
            ),
            (
                not_(cls.oauth2_client_id.is_(None)),
                AuthMethod.OAUTH2.value,
            ),
            else_=None,
        )

    __table_args__ = (
        CheckConstraint(
            "(password_hash IS NULL) = (password_salt IS NULL)",
            name="password_hash_and_salt",
        ),
        CheckConstraint(
            "(oauth2_client_id IS NULL) = (oauth2_user_id IS NULL)",
            name="oauth2_client_id_and_user_id",
        ),
        CheckConstraint(
            "(password_hash IS NULL) != (oauth2_client_id IS NULL)",
            name="exactly_one_auth_method",
        ),
        UniqueConstraint(
            "oauth2_client_id",
            "oauth2_user_id",
        ),
        dict(sqlite_autoincrement=True),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    user: Mapped["User"] = relationship("User", back_populates="password_reset_token")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp, nullable=False, index=True)
    __table_args__ = (dict(sqlite_autoincrement=True),)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp, nullable=False, index=True)
    __table_args__ = (dict(sqlite_autoincrement=True),)


class AccessToken(Base):
    __tablename__ = "access_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    user: Mapped["User"] = relationship("User", back_populates="access_tokens")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp, nullable=False, index=True)
    refresh_token_id: Mapped[int] = mapped_column(
        ForeignKey("refresh_tokens.id", ondelete="CASCADE"),
        index=True,
        unique=True,
    )
    __table_args__ = (dict(sqlite_autoincrement=True),)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    user: Mapped["User"] = relationship("User", back_populates="api_keys")
    name: Mapped[str]
    description: Mapped[Optional[str]]
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(UtcTimeStamp, nullable=True, index=True)
    __table_args__ = (dict(sqlite_autoincrement=True),)


class PromptLabel(Base):
    __tablename__ = "prompt_labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]]
    color: Mapped[str] = mapped_column(String, nullable=True)

    prompts_prompt_labels: Mapped[list["PromptPromptLabel"]] = relationship(
        "PromptPromptLabel",
        back_populates="prompt_label",
        cascade="all, delete-orphan",
        uselist=True,
    )


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_prompt_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("prompts.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    name: Mapped[Identifier] = mapped_column(_Identifier, unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]]
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )

    prompts_prompt_labels: Mapped[list["PromptPromptLabel"]] = relationship(
        "PromptPromptLabel",
        back_populates="prompt",
        cascade="all, delete-orphan",
        uselist=True,
    )

    prompt_versions: Mapped[list["PromptVersion"]] = relationship(
        "PromptVersion",
        back_populates="prompt",
        cascade="all, delete-orphan",
        uselist=True,
    )

    prompt_version_tags: Mapped[list["PromptVersionTag"]] = relationship(
        "PromptVersionTag",
        back_populates="prompt",
        cascade="all, delete-orphan",
        uselist=True,
    )


class PromptPromptLabel(Base):
    __tablename__ = "prompts_prompt_labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    prompt_label_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_labels.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("prompts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    prompt_label: Mapped["PromptLabel"] = relationship(
        "PromptLabel", back_populates="prompts_prompt_labels"
    )
    prompt: Mapped["Prompt"] = relationship("Prompt", back_populates="prompts_prompt_labels")

    __table_args__ = (UniqueConstraint("prompt_label_id", "prompt_id"),)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("prompts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    template_type: Mapped[PromptTemplateType] = mapped_column(
        _PromptTemplateType,
        CheckConstraint("template_type IN ('CHAT', 'STR')", name="template_type"),
        nullable=False,
    )
    template_format: Mapped[PromptTemplateFormat] = mapped_column(
        _TemplateFormat,
        CheckConstraint(
            "template_format IN ('F_STRING', 'MUSTACHE', 'NONE')", name="template_format"
        ),
        nullable=False,
    )
    template: Mapped[PromptTemplate] = mapped_column(_PromptTemplate, nullable=False)
    invocation_parameters: Mapped[PromptInvocationParameters] = mapped_column(
        _InvocationParameters, nullable=False
    )
    tools: Mapped[Optional[PromptTools]] = mapped_column(_Tools, default=Null(), nullable=True)
    response_format: Mapped[Optional[PromptResponseFormat]] = mapped_column(
        _PromptResponseFormat, default=Null(), nullable=True
    )
    model_provider: Mapped[ModelProvider] = mapped_column(_ModelProvider)
    model_name: Mapped[str]
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata")
    created_at: Mapped[datetime] = mapped_column(UtcTimeStamp, server_default=func.now())

    prompt: Mapped["Prompt"] = relationship("Prompt", back_populates="prompt_versions")

    prompt_version_tags: Mapped[list["PromptVersionTag"]] = relationship(
        "PromptVersionTag",
        back_populates="prompt_version",
        cascade="all, delete-orphan",
        uselist=True,
    )


class PromptVersionTag(Base):
    __tablename__ = "prompt_version_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[Identifier] = mapped_column(_Identifier, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    prompt_id: Mapped[int] = mapped_column(
        ForeignKey("prompts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    prompt_version_id: Mapped[int] = mapped_column(
        ForeignKey("prompt_versions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    prompt: Mapped["Prompt"] = relationship("Prompt", back_populates="prompt_version_tags")
    prompt_version: Mapped["PromptVersion"] = relationship(
        "PromptVersion", back_populates="prompt_version_tags"
    )

    __table_args__ = (UniqueConstraint("name", "prompt_id"),)
