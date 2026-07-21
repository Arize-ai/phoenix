from uuid import uuid4

from pydantic_ai.messages import ModelRequest, UserPromptPart

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.agents.session_history import (
    AgentSessionCompactionCheckpoint,
    AgentSessionHistory,
    PersistedAgentSessionMessage,
    load_agent_session_history,
    project_agent_session_model_history,
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


def _history(*, with_checkpoint: bool = True) -> AgentSessionHistory:
    messages = (
        _message(message_id="user-1", role="user", text="old question"),
        _message(message_id="assistant-1", role="assistant", text="old answer"),
        _message(message_id="user-2", role="user", text="retained question"),
        _message(message_id="assistant-2", role="assistant", text="retained answer"),
    )
    return AgentSessionHistory(
        message_rows=tuple(
            PersistedAgentSessionMessage(
                position=position,
                message_id=message.id,
                message=message,
            )
            for position, message in enumerate(messages)
        ),
        checkpoint=(
            AgentSessionCompactionCheckpoint(
                summary='{"objectives":["continue"]}',
                compacted_through_position=1,
                compaction_event_position=1,
            )
            if with_checkpoint
            else None
        ),
    )


def test_projection_returns_full_transcript_without_a_checkpoint() -> None:
    history = _history(with_checkpoint=False)

    projection = project_agent_session_model_history(history)

    assert projection.messages == history.messages
    assert projection.message_history == []


def test_projection_replaces_compacted_prefix_with_one_checkpoint() -> None:
    history = _history()

    projection = project_agent_session_model_history(history)

    assert [message.id for message in projection.messages] == ["user-2", "assistant-2"]
    assert len(projection.message_history) == 1
    checkpoint_message = projection.message_history[0]
    assert isinstance(checkpoint_message, ModelRequest)
    assert len(checkpoint_message.parts) == 1
    checkpoint_part = checkpoint_message.parts[0]
    assert isinstance(checkpoint_part, UserPromptPart)
    assert '<conversation_checkpoint>{"objectives":["continue"]}' in str(checkpoint_part.content)


def test_projection_retains_a_new_message_after_the_persisted_transcript() -> None:
    history = _history()
    pending_message = _message(message_id="user-3", role="user", text="new question")

    projection = project_agent_session_model_history(
        history,
        messages=[*history.messages, pending_message],
    )

    assert [message.id for message in projection.messages] == [
        "user-2",
        "assistant-2",
        "user-3",
    ]
    assert len(projection.message_history) == 1


def test_projection_fails_safe_when_the_compacted_prefix_changed() -> None:
    history = _history()
    changed_boundary = _message(
        message_id="assistant-1",
        role="assistant",
        text="continued old answer",
    )
    changed_transcript = [history.messages[0], changed_boundary, *history.messages[2:]]

    projection = project_agent_session_model_history(
        history,
        messages=changed_transcript,
    )

    assert projection.messages == changed_transcript
    assert projection.message_history == []


async def test_load_agent_session_history_returns_ordered_messages_and_checkpoint(
    db: DbSessionFactory,
) -> None:
    history = _history()
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
                position=row.position,
                message=row.message,
            )
            for row in reversed(history.message_rows)
        )
        assert history.checkpoint is not None
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session.id,
                compaction_summary=history.checkpoint.summary,
                compacted_through_position=history.checkpoint.compacted_through_position,
                compaction_event_position=history.checkpoint.compaction_event_position,
            )
        )
        agent_session_rowid = agent_session.id

    async with db() as session:
        loaded_history = await load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert [row.position for row in loaded_history.message_rows] == [0, 1, 2, 3]
    assert loaded_history.checkpoint == history.checkpoint


async def test_load_agent_session_history_ignores_an_invalid_checkpoint(
    db: DbSessionFactory,
) -> None:
    message = _message(message_id="user-1", role="user", text="question")
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        session.add(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=0,
                message=message,
            )
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session.id,
                compaction_summary='{"objectives":["continue"]}',
                compacted_through_position=0,
                compaction_event_position=99,
            )
        )
        agent_session_rowid = agent_session.id

    async with db() as session:
        loaded_history = await load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )

    assert loaded_history.messages == [message]
    assert loaded_history.checkpoint is None
