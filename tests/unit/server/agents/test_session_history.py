from uuid import uuid4

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart, UserMessageMetadata
from phoenix.server.api.routers.agents import (
    _build_compaction_message,
    _load_agent_session_history,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid


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
    assert message.metadata is not None
    assert isinstance(message.metadata.phoenix, UserMessageMetadata)
    assert message.metadata.phoenix.is_compaction_message
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
            **_agent_session_model_kwargs(),
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
    assert not history[0].is_compaction_message


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
            **_agent_session_model_kwargs(),
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
    assert history[0].is_compaction_message
    assert history[0].message.id == _message_uuid("compaction-2")


async def test_uppercase_and_lowercase_uuids_are_both_accepted(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
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
