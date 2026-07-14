from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import pytest
from pydantic import ValidationError
from pydantic_ai import ModelRetry
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.agents.capabilities.tools.internal.write_span_note import (
    PXI_SPAN_NOTE_IDENTIFIER,
    WRITE_SPAN_NOTE_TOOL_NAME,
    WriteSpanNoteToolset,
)
from phoenix.server.dml_event import DmlEvent, SpanAnnotationInsertEvent
from phoenix.server.types import DbSessionFactory

_SPAN_ID = "7e2f08cb43bbf521"


@dataclass
class _EventQueue:
    events: list[DmlEvent] = field(default_factory=list)

    def put(self, item: DmlEvent) -> None:
        self.events.append(item)


async def _insert_span(db: DbSessionFactory) -> None:
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="write-span-note-tool").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="649993371fa95c788177f739b7423818",
                project_rowid=project_rowid,
                start_time=datetime(2021, 1, 1, tzinfo=timezone.utc),
                end_time=datetime(2021, 1, 1, 0, 1, tzinfo=timezone.utc),
            )
            .returning(models.Trace.id)
        )
        await session.execute(
            insert(models.Span).values(
                trace_rowid=trace_rowid,
                span_id=_SPAN_ID,
                parent_id=None,
                name="chain span",
                span_kind="CHAIN",
                start_time=datetime(2021, 1, 1, tzinfo=timezone.utc),
                end_time=datetime(2021, 1, 1, 0, 1, tzinfo=timezone.utc),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )


async def _call_tool(
    db: DbSessionFactory,
    event_queue: _EventQueue,
    arguments: dict[str, Any],
    *,
    read_only: bool = False,
    auth_enabled: bool = False,
    user_id: int | None = None,
    is_viewer: bool = False,
) -> dict[str, str]:
    toolset = WriteSpanNoteToolset(
        db=db,
        event_queue=event_queue,
        read_only=read_only,
        auth_enabled=auth_enabled,
        user_id=user_id,
        is_viewer=is_viewer,
    )
    run_context: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())
    tools = await toolset.get_tools(run_context)
    tool = tools[WRITE_SPAN_NOTE_TOOL_NAME]
    validated_arguments: dict[str, Any] = tool.args_validator.validate_python(arguments)
    result: dict[str, str] = await toolset.call_tool(
        WRITE_SPAN_NOTE_TOOL_NAME,
        validated_arguments,
        run_context,
        tool,
    )
    return result


async def test_write_span_note_schema_uses_span_id_alias(db: DbSessionFactory) -> None:
    toolset = WriteSpanNoteToolset(db=db, event_queue=_EventQueue())
    run_context: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())
    tools = await toolset.get_tools(run_context)

    schema = tools[WRITE_SPAN_NOTE_TOOL_NAME].tool_def.parameters_json_schema

    assert schema == {
        "additionalProperties": False,
        "properties": {
            "spanId": {
                "description": "16-character OpenTelemetry span id.",
                "pattern": "^[0-9a-fA-F]{16}$",
                "type": "string",
            },
            "note": {
                "description": "Specific open-coding observation to store on the span.",
                "minLength": 1,
                "type": "string",
            },
        },
        "required": ["spanId", "note"],
        "type": "object",
    }


async def test_write_span_note_writes_pxi_note(db: DbSessionFactory) -> None:
    await _insert_span(db)
    event_queue = _EventQueue()

    result = await _call_tool(
        db,
        event_queue,
        {"spanId": f"  {_SPAN_ID}  ", "note": "  Tool returned a 404 for a valid-looking id.  "},
    )

    assert result["status"] == "written"
    assert result["spanId"] == _SPAN_ID
    assert result["identifier"] == PXI_SPAN_NOTE_IDENTIFIER
    async with db() as session:
        annotation = await session.scalar(
            select(models.SpanAnnotation).where(models.SpanAnnotation.name == "note")
        )
    assert annotation is not None
    assert annotation.identifier == PXI_SPAN_NOTE_IDENTIFIER
    assert annotation.explanation == "Tool returned a 404 for a valid-looking id."
    assert event_queue.events == [SpanAnnotationInsertEvent((annotation.id,))]


async def test_write_span_note_repeated_write_updates_existing_note(
    db: DbSessionFactory,
) -> None:
    await _insert_span(db)
    event_queue = _EventQueue()

    await _call_tool(db, event_queue, {"spanId": _SPAN_ID, "note": "First observation."})
    await _call_tool(db, event_queue, {"spanId": _SPAN_ID, "note": "Revised observation."})

    async with db() as session:
        annotations = list(
            (
                await session.scalars(
                    select(models.SpanAnnotation).where(models.SpanAnnotation.name == "note")
                )
            ).all()
        )

    assert len(annotations) == 1
    assert annotations[0].identifier == PXI_SPAN_NOTE_IDENTIFIER
    assert annotations[0].explanation == "Revised observation."


@pytest.mark.parametrize(
    ("arguments", "message"),
    [
        ({"note": "missing span id"}, "Field required"),
        ({"spanId": "not-a-span", "note": "bad span id"}, "String should match pattern"),
        ({"spanId": _SPAN_ID, "note": ""}, "String should have at least 1 character"),
        (
            {"spanId": _SPAN_ID, "note": "ok", "identifier": "other"},
            "Extra inputs are not permitted",
        ),
    ],
)
async def test_write_span_note_validates_arguments(
    db: DbSessionFactory,
    arguments: dict[str, Any],
    message: str,
) -> None:
    event_queue = _EventQueue()

    with pytest.raises(ValidationError, match=message):
        await _call_tool(db, event_queue, arguments)


async def test_write_span_note_missing_span_fails_clearly(db: DbSessionFactory) -> None:
    event_queue = _EventQueue()

    with pytest.raises(ModelRetry, match=f"Span with ID {_SPAN_ID} not found"):
        await _call_tool(db, event_queue, {"spanId": _SPAN_ID, "note": "No span exists."})


async def test_write_span_note_read_only_fails(db: DbSessionFactory) -> None:
    event_queue = _EventQueue()

    with pytest.raises(ModelRetry, match="read-only"):
        await _call_tool(
            db,
            event_queue,
            {"spanId": _SPAN_ID, "note": "No write."},
            read_only=True,
        )


async def test_write_span_note_db_writes_blocked_fails(db: DbSessionFactory) -> None:
    event_queue = _EventQueue()
    db.should_not_insert_or_update = True

    try:
        with pytest.raises(ModelRetry, match="writes are locked"):
            await _call_tool(db, event_queue, {"spanId": _SPAN_ID, "note": "No write."})
    finally:
        db.should_not_insert_or_update = False


async def test_write_span_note_viewer_fails(db: DbSessionFactory) -> None:
    event_queue = _EventQueue()

    with pytest.raises(ModelRetry, match="Viewers cannot write span notes"):
        await _call_tool(
            db,
            event_queue,
            {"spanId": _SPAN_ID, "note": "No write."},
            auth_enabled=True,
            user_id=1,
            is_viewer=True,
        )
