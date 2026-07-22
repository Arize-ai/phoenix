from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from pydantic import Field, StringConstraints
from pydantic_ai import ModelRetry, Tool
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset, FunctionToolset
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.dml_event import DmlEvent, SpanAnnotationInsertEvent
from phoenix.server.types import CanPutItem, DbSessionFactory

PXI_SPAN_NOTE_IDENTIFIER = "pxi"
WRITE_SPAN_NOTE_TOOL_NAME = "write_span_note"

_SPAN_ID_PATTERN = "^[0-9a-fA-F]{16}$"

_WRITE_SPAN_NOTE_DESCRIPTION = (
    "Write a PXI-owned open-coding note to a Phoenix span. The tool targets a span by "
    "`spanId`, writes the note immediately with identifier `pxi`, and updates the existing "
    "PXI note on that span when called repeatedly."
)


class WriteSpanNoteToolset(FunctionToolset[AgentDepsT]):
    """Toolset exposing the server-side PXI span-note writer."""

    def __init__(
        self,
        *,
        db: DbSessionFactory,
        event_queue: CanPutItem[DmlEvent],
        read_only: bool = False,
        auth_enabled: bool = False,
        user_id: int | None = None,
        is_viewer: bool = False,
    ) -> None:
        async def write_span_note(
            span_id: Annotated[
                str,
                Field(
                    alias="spanId",
                    description="16-character OpenTelemetry span id.",
                ),
                StringConstraints(strip_whitespace=True, pattern=_SPAN_ID_PATTERN),
            ],
            note: Annotated[
                str,
                Field(
                    description="Specific open-coding observation to store on the span.",
                ),
                StringConstraints(strip_whitespace=True, min_length=1),
            ],
        ) -> dict[str, str]:
            _ensure_can_write_span_note(
                db=db,
                read_only=read_only,
                auth_enabled=auth_enabled,
                user_id=user_id,
                is_viewer=is_viewer,
            )
            annotation_id = await _write_span_note(
                db=db,
                event_queue=event_queue,
                span_id=span_id,
                note=note,
                user_id=user_id,
            )

            return {
                "status": "written",
                "spanId": span_id,
                "identifier": PXI_SPAN_NOTE_IDENTIFIER,
                "annotationId": str(GlobalID("SpanAnnotation", str(annotation_id))),
            }

        super().__init__(
            tools=[
                Tool(
                    write_span_note,
                    name=WRITE_SPAN_NOTE_TOOL_NAME,
                    description=_WRITE_SPAN_NOTE_DESCRIPTION,
                    takes_ctx=False,
                )
            ]
        )


@dataclass
class WriteSpanNoteCapability(AbstractStaticCapability[AgentDepsT]):
    """Capability that adds the PXI span-note writer."""

    db: DbSessionFactory
    event_queue: CanPutItem[DmlEvent]
    instructions: str
    read_only: bool = False
    auth_enabled: bool = False
    user_id: int | None = None
    is_viewer: bool = False

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return WriteSpanNoteToolset(
            db=self.db,
            event_queue=self.event_queue,
            read_only=self.read_only,
            auth_enabled=self.auth_enabled,
            user_id=self.user_id,
            is_viewer=self.is_viewer,
        )

    def get_static_instructions(self) -> str:
        return self.instructions


def _ensure_can_write_span_note(
    *,
    db: DbSessionFactory,
    read_only: bool,
    auth_enabled: bool,
    user_id: int | None,
    is_viewer: bool,
) -> None:
    """Mirror GraphQL span-note mutation write guards for the agent tool.

    This duplicates the read-only, locked-storage, authentication, and viewer checks
    enforced around `create_span_note` by `IsNotReadOnly`, `IsLocked`, request user
    extraction, and `IsNotViewer`. Remove this helper once agent write tools are
    consolidated to call GraphQL mutations directly.
    """
    if read_only:
        raise ModelRetry("Cannot write span note because Phoenix is running in read-only mode.")
    if db.should_not_insert_or_update:
        raise ModelRetry(
            "Cannot write span note because database writes are locked due to insufficient storage."
        )
    if auth_enabled and user_id is None:
        raise ModelRetry("Cannot write span note without an authenticated Phoenix user.")
    if is_viewer:
        raise ModelRetry("Viewers cannot write span notes.")


async def _write_span_note(
    *,
    db: DbSessionFactory,
    event_queue: CanPutItem[DmlEvent],
    span_id: str,
    note: str,
    user_id: int | None,
) -> int:
    async with db() as session:
        span_rowid = await session.scalar(
            select(models.Span.id).where(models.Span.span_id == span_id)
        )
        if span_rowid is None:
            raise ModelRetry(f"Span with ID {span_id} not found.")

        values = {
            "span_rowid": span_rowid,
            "name": "note",
            "label": None,
            "score": None,
            "explanation": note,
            "annotator_kind": "HUMAN",
            "metadata_": {},
            "identifier": PXI_SPAN_NOTE_IDENTIFIER,
            "source": "API",
            "user_id": user_id,
        }
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        result = await session.execute(
            insert_on_conflict(
                values,
                dialect=dialect,
                table=models.SpanAnnotation,
                unique_by=("name", "span_rowid", "identifier"),
            ).returning(models.SpanAnnotation.id)
        )
        annotation_id = result.scalar_one()

    event_queue.put(SpanAnnotationInsertEvent((annotation_id,)))
    return annotation_id
