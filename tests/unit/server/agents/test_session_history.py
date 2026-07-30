from uuid import uuid4

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart, UserMessageMetadata
from phoenix.server.api.routers.agents import (
    _build_compaction_message,
    _load_agent_session_history,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _message_uuid


def _message(*, message_id: str, role: str, text: str) -> PhoenixUIMessage:
    return PhoenixUIMessage.model_validate(
        {
            "id": message_id,
            "role": role,
            "parts": [{"type": "text", "text": text}],
        }
    )


def test_build_compaction_message_creates_a_marked_user_message() -> None:
    message = _build_compaction_message(
        message_id=_message_uuid("compaction-1"),
        summary='{"objectives":["continue"]}',
    )

    assert message.role == "user"
    assert isinstance(message.metadata, UserMessageMetadata)
    assert message.metadata.is_compaction_message
    assert "\n".join(part.text for part in message.parts if isinstance(part, TextUIPart)) == (
        '{"objectives":["continue"]}'
    )


async def test_load_agent_session_history_returns_the_full_uncompacted_transcript(
    db: DbSessionFactory,
) -> None:
    messages = [
        _message(message_id=_message_uuid("user-1"), role="user", text="question"),
        _message(message_id=_message_uuid("assistant-1"), role="assistant", text="answer"),
    ]
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=message,
            )
            for message in messages
        )
        agent_session_rowid = agent_session.id

    async with db() as session:
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert [row.message for row in history] == messages
    assert not history[0].is_compaction_point


async def test_load_agent_session_history_starts_at_the_latest_compaction_point(
    db: DbSessionFactory,
) -> None:
    messages = [
        _message(message_id=_message_uuid("user-1"), role="user", text="old question"),
        _message(message_id=_message_uuid("assistant-1"), role="assistant", text="old answer"),
        _build_compaction_message(
            message_id=_message_uuid("compaction-1"), summary="first summary"
        ),
        _message(message_id=_message_uuid("user-2"), role="user", text="newer question"),
        _message(message_id=_message_uuid("assistant-2"), role="assistant", text="newer answer"),
        _build_compaction_message(
            message_id=_message_uuid("compaction-2"), summary="second summary"
        ),
        _message(message_id=_message_uuid("user-3"), role="user", text="retained question"),
        _message(message_id=_message_uuid("assistant-3"), role="assistant", text="retained answer"),
    ]
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        message_rows = [
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=message,
            )
            for message in messages
        ]
        session.add_all(message_rows)
        agent_session_rowid = agent_session.id

    async with db() as session:
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert [row.message.id for row in history] == [
        _message_uuid("compaction-2"),
        _message_uuid("user-3"),
        _message_uuid("assistant-3"),
    ]
    assert history[0].is_compaction_point
    assert history[0].message.id == _message_uuid("compaction-2")


async def test_transcript_order_follows_insertion_order_not_message_content(
    db: DbSessionFactory,
) -> None:
    """Transcript order is the primary key's ascending order.

    Nothing in the row content encodes position, so appending a message after
    the fact must land it at the end of the transcript.
    """
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_rowid = agent_session.id
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                message=_message(message_id=_message_uuid(label), role=role, text=label),
            )
            for label, role in (("user-1", "user"), ("assistant-1", "assistant"))
        )

    # A later transaction appends a third message.
    async with db() as session:
        session.add(
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                message=_message(message_id=_message_uuid("user-2"), role="user", text="user-2"),
            )
        )

    async with db() as session:
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert [row.message.id for row in history] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
        _message_uuid("user-2"),
    ]
    assert [row.id for row in history] == sorted(row.id for row in history)


async def test_message_id_must_be_a_uuid_at_the_database_level(
    db: DbSessionFactory,
) -> None:
    """``message_id`` is a generated column, so the CHECK is the only thing
    standing between a malformed client id and the transcript."""
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_rowid = agent_session.id

    for bad_message_id in (
        "not-a-uuid",
        "",
        # Right length and shape, but 'z' is not a hex digit.
        "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
        # A UUID with the hyphens stripped out.
        uuid4().hex,
        # Trailing junk after an otherwise valid UUID.
        f"{uuid4()}-extra",
    ):
        # The exception class differs by driver — SQLAlchemy translates the
        # PostgreSQL driver's error but re-raises sqlean's untranslated — so the
        # named constraint in the message is what this pins.
        with pytest.raises(Exception, match="valid_message_id"):
            async with db() as session:
                session.add(
                    models.AgentSessionMessage(
                        agent_session_id=agent_session_rowid,
                        message=_message(
                            message_id=bad_message_id,
                            role="user",
                            text="rejected",
                        ),
                    )
                )
                await session.flush()

    async with db() as session:
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_uppercase_and_lowercase_uuids_are_both_accepted(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_rowid = agent_session.id
        lowercase_id = str(uuid4())
        uppercase_id = str(uuid4()).upper()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                message=_message(message_id=message_id, role="user", text="accepted"),
            )
            for message_id in (lowercase_id, uppercase_id)
        )

    async with db() as session:
        stored = list(await session.scalars(select(models.AgentSessionMessage.message_id)))
    assert stored == [lowercase_id, uppercase_id]
