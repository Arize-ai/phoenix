"""Persist annotations and announce matching writes at the same transactional seams."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal, Optional, TypeVar, Union

from sqlalchemy import insert, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.triggering.log import AnnotationUpserted, append
from phoenix.server.online_eval.triggering.rules import annotation_rules_exist

Annotation: TypeAlias = Union[
    models.SpanAnnotation,
    models.TraceAnnotation,
    models.ProjectSessionAnnotation,
]
AnnotationT = TypeVar("AnnotationT", bound=Annotation)


async def insert_annotations(
    session: AsyncSession,
    *records: Mapping[str, Any],
    table: type[AnnotationT],
    write_token: Optional[str] = None,
) -> tuple[AnnotationT, ...]:
    """Insert annotations and announce them."""
    if not records:
        return ()
    annotation_ids = tuple(await session.scalars(insert(table).values(records).returning(table.id)))
    annotations = await _load_annotations(session, table, annotation_ids)
    await _append_events(
        session,
        table,
        annotations,
        existing_keys=frozenset(),
        write_token=write_token,
    )
    return annotations


async def upsert_annotations(
    session: AsyncSession,
    *records: Mapping[str, Any],
    table: type[AnnotationT],
    dialect: SupportedSQLDialect,
    unique_by: Sequence[str],
    on_conflict: OnConflict = OnConflict.DO_UPDATE,
    set_: Optional[Mapping[str, Any]] = None,
    constraint_name: Optional[str] = None,
    write_token: Optional[str] = None,
) -> tuple[AnnotationT, ...]:
    """Insert annotations, resolving conflicts as asked, and announce them."""
    if not records:
        return ()
    existing_keys = await _existing_keys(session, table, records, unique_by)
    annotation_ids = tuple(
        await session.scalars(
            insert_on_conflict(
                *records,
                table=table,
                dialect=dialect,
                unique_by=unique_by,
                on_conflict=on_conflict,
                set_=set_,
                constraint_name=constraint_name,
            ).returning(table.id)
        )
    )
    annotations = await _load_annotations(session, table, annotation_ids)
    await _append_events(
        session,
        table,
        annotations,
        existing_keys=existing_keys,
        unique_by=unique_by,
        write_token=write_token,
    )
    return annotations


async def update_annotations(
    session: AsyncSession,
    *annotations: AnnotationT,
) -> tuple[AnnotationT, ...]:
    if not annotations:
        return ()
    table = type(annotations[0])
    if any(type(annotation) is not table for annotation in annotations):
        raise TypeError("annotations must belong to one table")
    await session.flush()
    loaded = await _load_annotations(session, table, [annotation.id for annotation in annotations])
    await _append_events(
        session,
        table,
        loaded,
        existing_keys=frozenset((annotation.id,) for annotation in annotations),
        unique_by=("id",),
    )
    return annotations


async def _existing_keys(
    session: AsyncSession,
    table: type[AnnotationT],
    records: Sequence[Mapping[str, Any]],
    unique_by: Sequence[str],
) -> frozenset[tuple[Any, ...]]:
    columns = tuple(getattr(table, name) for name in unique_by)
    keys = {tuple(record.get(name) for name in unique_by) for record in records}
    if len(columns) == 1:
        scalar_rows = await session.scalars(
            select(columns[0]).where(columns[0].in_(key[0] for key in keys))
        )
        return frozenset((value,) for value in scalar_rows)
    composite_rows = await session.execute(select(*columns).where(tuple_(*columns).in_(keys)))
    return frozenset(tuple(row) for row in composite_rows)


async def _load_annotations(
    session: AsyncSession,
    table: type[AnnotationT],
    annotation_ids: Sequence[int],
) -> tuple[AnnotationT, ...]:
    if not annotation_ids:
        return ()
    rows = await session.scalars(select(table).where(table.id.in_(annotation_ids)))
    by_id = {annotation.id: annotation for annotation in rows}
    return tuple(by_id[annotation_id] for annotation_id in annotation_ids)


async def _append_events(
    session: AsyncSession,
    table: type[AnnotationT],
    annotations: Sequence[AnnotationT],
    *,
    existing_keys: frozenset[tuple[Any, ...]],
    unique_by: Sequence[str] = (),
    write_token: Optional[str] = None,
) -> None:
    if not annotations:
        return
    annotation_ids = [annotation.id for annotation in annotations]
    stmt: Any
    if table is models.SpanAnnotation:
        stmt = (
            select(
                models.SpanAnnotation,
                models.ProjectSession.project_id,
                models.ProjectSession.id.label("project_session_rowid"),
            )
            .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .join(
                models.ProjectSession,
                models.Trace.project_session_rowid == models.ProjectSession.id,
            )
            .where(
                models.SpanAnnotation.id.in_(annotation_ids),
            )
        )
        annotation_target: models.AnnotationTarget = "span"
        target_attribute = "span_rowid"
    elif table is models.TraceAnnotation:
        stmt = (
            select(
                models.TraceAnnotation,
                models.ProjectSession.project_id,
                models.ProjectSession.id.label("project_session_rowid"),
            )
            .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
            .join(
                models.ProjectSession,
                models.Trace.project_session_rowid == models.ProjectSession.id,
            )
            .where(
                models.TraceAnnotation.id.in_(annotation_ids),
            )
        )
        annotation_target = "trace"
        target_attribute = "trace_rowid"
    elif table is models.ProjectSessionAnnotation:
        stmt = (
            select(
                models.ProjectSessionAnnotation,
                models.ProjectSession.project_id,
                models.ProjectSession.id.label("project_session_rowid"),
            )
            .join(
                models.ProjectSession,
                models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
            )
            .where(
                models.ProjectSessionAnnotation.id.in_(annotation_ids),
            )
        )
        annotation_target = "session"
        target_attribute = "project_session_id"
    else:
        raise TypeError(f"unsupported annotation table: {table.__name__}")

    routed_annotations = tuple(await session.execute(stmt))
    project_ids_with_rules = {
        project_id
        for project_id in {row.project_id for row in routed_annotations}
        if await annotation_rules_exist(session, project_id=project_id)
    }
    for annotation, project_id, project_session_rowid in routed_annotations:
        if project_id not in project_ids_with_rules:
            continue
        key = tuple(getattr(annotation, name) for name in unique_by)
        change: Literal["created", "updated"] = "updated" if key in existing_keys else "created"
        await append(
            session,
            AnnotationUpserted(
                annotation_target=annotation_target,
                annotation_id=annotation.id,
                target_rowid=getattr(annotation, target_attribute),
                change=change,
                updated_at=annotation.updated_at,
                name=annotation.name,
                label=annotation.label,
                score=annotation.score,
                annotator_kind=annotation.annotator_kind,
                source=annotation.source,
                user_id=annotation.user_id,
                identifier=annotation.identifier,
                **({} if write_token is None else {"write_token": write_token}),
            ),
            project_id=project_id,
            evaluation_target="SESSION",
            target_rowid=project_session_rowid,
        )

