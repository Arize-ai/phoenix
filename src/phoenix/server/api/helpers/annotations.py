from collections.abc import Sequence
from typing import cast
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace

NOTE_NAME = "note"


def get_user_identifier(user_id: int) -> str:
    """
    Generates an annotation identifier unique to the user.
    """
    user_gid = str(GlobalID(type_name="User", node_id=str(user_id)))
    return f"px-app:{user_gid}"


def get_note_identifier(prefix: str) -> str:
    """
    Generates a UUIDv4 note identifier with the given prefix.
    """
    return f"{prefix}:{uuid4()}"


async def resolve_span_rowids(session: AsyncSession, refs: Sequence[GlobalID | str]) -> list[int]:
    return await _resolve_rowids(
        session,
        refs,
        expected_type=Span.__name__,
        rowid_column=models.Span.id,
        external_id_column=models.Span.span_id,
        entity_name="spans",
    )


async def resolve_trace_rowids(session: AsyncSession, refs: Sequence[GlobalID | str]) -> list[int]:
    return await _resolve_rowids(
        session,
        refs,
        expected_type=Trace.__name__,
        rowid_column=models.Trace.id,
        external_id_column=models.Trace.trace_id,
        entity_name="traces",
    )


async def resolve_project_session_rowids(
    session: AsyncSession, refs: Sequence[GlobalID | str]
) -> list[int]:
    return await _resolve_rowids(
        session,
        refs,
        expected_type=ProjectSession.__name__,
        rowid_column=models.ProjectSession.id,
        external_id_column=models.ProjectSession.session_id,
        entity_name="project sessions",
    )


async def _resolve_rowids(
    session: AsyncSession,
    refs: Sequence[GlobalID | str],
    *,
    expected_type: str,
    rowid_column: InstrumentedAttribute[int],
    external_id_column: InstrumentedAttribute[str],
    entity_name: str,
) -> list[int]:
    resolved_rowids: list[int | None] = [None] * len(refs)
    node_indexes: dict[int, list[int]] = {}
    external_id_indexes: dict[str, list[int]] = {}

    for index, ref in enumerate(refs):
        if isinstance(ref, str):
            external_id_indexes.setdefault(ref, []).append(index)
            continue
        try:
            rowid = from_global_id_with_expected_type(ref, expected_type)
        except ValueError as error:
            raise BadRequest(f"Invalid {expected_type} ID: {ref}. {error}") from error
        node_indexes.setdefault(rowid, []).append(index)

    if node_indexes:
        existing_rowids = set(
            await session.scalars(select(rowid_column).where(rowid_column.in_(node_indexes)))
        )
        for rowid in existing_rowids:
            for index in node_indexes[rowid]:
                resolved_rowids[index] = rowid

    if external_id_indexes:
        result = await session.execute(
            select(external_id_column, rowid_column).where(
                external_id_column.in_(external_id_indexes)
            )
        )
        for external_id, rowid in cast(Sequence[tuple[str, int]], result.all()):
            for index in external_id_indexes[external_id]:
                resolved_rowids[index] = rowid

    missing_refs = [str(ref) for ref, rowid in zip(refs, resolved_rowids) if rowid is None]
    if missing_refs:
        raise NotFound(f"Could not find {entity_name} with IDs: {missing_refs}")
    return cast(list[int], resolved_rowids)
