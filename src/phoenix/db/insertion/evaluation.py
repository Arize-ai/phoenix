from typing import NamedTuple, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, num_docs_col
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.exceptions import PhoenixException
from phoenix.trace import v1 as pb


class InsertEvaluationError(PhoenixException):
    pass


class EvaluationInsertionEvent(NamedTuple):
    project_rowid: int
    evaluation_name: str


class SpanEvaluationInsertionEvent(EvaluationInsertionEvent): ...


class TraceEvaluationInsertionEvent(EvaluationInsertionEvent): ...


class DocumentEvaluationInsertionEvent(EvaluationInsertionEvent): ...


async def insert_evaluation(
    session: AsyncSession,
    evaluation: pb.Evaluation,
) -> Optional[EvaluationInsertionEvent]:
    evaluation_name = evaluation.name
    result = evaluation.result
    label = result.label.value if result.HasField("label") else None
    score = result.score.value if result.HasField("score") else None
    explanation = result.explanation.value if result.HasField("explanation") else None
    if (evaluation_kind := evaluation.subject_id.WhichOneof("kind")) is None:
        raise InsertEvaluationError("Cannot insert an evaluation that has no evaluation kind")
    elif evaluation_kind == "trace_id":
        trace_id = evaluation.subject_id.trace_id
        return await _insert_trace_evaluation(
            session, trace_id, evaluation_name, label, score, explanation
        )
    elif evaluation_kind == "span_id":
        span_id = evaluation.subject_id.span_id
        return await _insert_span_evaluation(
            session, span_id, evaluation_name, label, score, explanation
        )
    elif evaluation_kind == "document_retrieval_id":
        span_id = evaluation.subject_id.document_retrieval_id.span_id
        document_position = evaluation.subject_id.document_retrieval_id.document_position
        return await _insert_document_evaluation(
            session, span_id, document_position, evaluation_name, label, score, explanation
        )
    else:
        assert_never(evaluation_kind)


async def _insert_trace_evaluation(
    session: AsyncSession,
    trace_id: str,
    evaluation_name: str,
    label: Optional[str],
    score: Optional[float],
    explanation: Optional[str],
) -> TraceEvaluationInsertionEvent:
    stmt = select(
        models.Trace.project_rowid,
        models.Trace.id,
    ).where(models.Trace.trace_id == trace_id)
    if not (row := (await session.execute(stmt)).first()):
        raise InsertEvaluationError(
            f"Cannot insert a trace evaluation for a missing trace: {evaluation_name=}, {trace_id=}"
        )
    project_rowid, trace_rowid = row
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    values = dict(
        trace_rowid=trace_rowid,
        name=evaluation_name,
        label=label,
        score=score,
        explanation=explanation,
        metadata_={},  # `metadata_` must match ORM
        annotator_kind="LLM",
    )
    await session.execute(
        insert_on_conflict(
            values,
            dialect=dialect,
            table=models.TraceAnnotation,
            unique_by=("name", "trace_rowid"),
        )
    )
    return TraceEvaluationInsertionEvent(project_rowid, evaluation_name)


async def _insert_span_evaluation(
    session: AsyncSession,
    span_id: str,
    evaluation_name: str,
    label: Optional[str],
    score: Optional[float],
    explanation: Optional[str],
) -> SpanEvaluationInsertionEvent:
    stmt = (
        select(
            models.Trace.project_rowid,
            models.Span.id,
        )
        .join_from(models.Span, models.Trace)
        .where(models.Span.span_id == span_id)
    )
    if not (row := (await session.execute(stmt)).first()):
        raise InsertEvaluationError(
            f"Cannot insert a span evaluation for a missing span: {evaluation_name=}, {span_id=}"
        )
    project_rowid, span_rowid = row
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    values = dict(
        span_rowid=span_rowid,
        name=evaluation_name,
        label=label,
        score=score,
        explanation=explanation,
        metadata_={},  # `metadata_` must match ORM
        annotator_kind="LLM",
    )
    await session.execute(
        insert_on_conflict(
            values,
            dialect=dialect,
            table=models.SpanAnnotation,
            unique_by=("name", "span_rowid"),
        )
    )
    return SpanEvaluationInsertionEvent(project_rowid, evaluation_name)


async def _insert_document_evaluation(
    session: AsyncSession,
    span_id: str,
    document_position: int,
    evaluation_name: str,
    label: Optional[str],
    score: Optional[float],
    explanation: Optional[str],
) -> EvaluationInsertionEvent:
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    stmt = (
        select(
            models.Trace.project_rowid,
            models.Span.id,
            num_docs_col(dialect),
        )
        .join_from(models.Span, models.Trace)
        .where(models.Span.span_id == span_id)
    )
    if not (row := (await session.execute(stmt)).first()):
        raise InsertEvaluationError(
            f"Cannot insert a document evaluation for a missing span: {span_id=}"
        )
    project_rowid, span_rowid, num_docs = row
    if num_docs is None or num_docs <= document_position:
        raise InsertEvaluationError(
            f"Cannot insert a document evaluation for a non-existent "
            f"document position: {evaluation_name=}, {span_id=}, {document_position=}"
        )
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    values = dict(
        span_rowid=span_rowid,
        document_position=document_position,
        name=evaluation_name,
        label=label,
        score=score,
        explanation=explanation,
        metadata_={},  # `metadata_` must match ORM
        annotator_kind="LLM",
    )
    await session.execute(
        insert_on_conflict(
            values,
            dialect=dialect,
            table=models.DocumentAnnotation,
            unique_by=("name", "span_rowid", "document_position"),
        )
    )
    return DocumentEvaluationInsertionEvent(project_rowid, evaluation_name)
