from uuid import uuid4

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart, UserMessageMetadata
from phoenix.server.api.routers.agents import (
    _build_compaction_message,
    _load_agent_session_history,
)
from phoenix.server.types import DbSessionFactory


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
        message_id="compaction-1",
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
        _message(message_id="user-1", role="user", text="question"),
        _message(message_id="assistant-1", role="assistant", text="answer"),
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
                position=position,
                message=message,
            )
            for position, message in enumerate(messages)
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
        _message(message_id="user-1", role="user", text="old question"),
        _message(message_id="assistant-1", role="assistant", text="old answer"),
        _build_compaction_message(message_id="compaction-1", summary="first summary"),
        _message(message_id="user-2", role="user", text="newer question"),
        _message(message_id="assistant-2", role="assistant", text="newer answer"),
        _build_compaction_message(message_id="compaction-2", summary="second summary"),
        _message(message_id="user-3", role="user", text="retained question"),
        _message(message_id="assistant-3", role="assistant", text="retained answer"),
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
                position=position,
                message=message,
            )
            for position, message in enumerate(messages)
        ]
        session.add_all(message_rows)
        await session.flush()
        session.add_all(
            models.AgentSessionCompactionPoint(agent_session_message_id=message_rows[index].id)
            for index in (2, 5)
        )
        agent_session_rowid = agent_session.id

    async with db() as session:
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert [row.message.id for row in history] == [
        "compaction-2",
        "user-3",
        "assistant-3",
    ]
    assert history[0].is_compaction_point
    assert history[0].message.id == "compaction-2"
