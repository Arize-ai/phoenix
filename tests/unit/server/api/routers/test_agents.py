from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, ToolOutputAvailableChunk
from pydantic_ai.usage import RequestUsage
from sqlalchemy import delete, func, select, update
from strawberry.relay import GlobalID

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage, TextUIPart, TurnTraceContext
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.types import (
    SandboxAvailability,
)
from phoenix.server.api.routers.agents import (
    ChatRequestBody,
    _build_message_metadata_chunk,
    _get_current_context_usage,
    _interleave_agent_and_subagent_message_chunks,
    _load_phoenix_user_email,
    _load_sandbox_availability,
    _maybe_using_user,
    _persist_agent_session_title,
    _persist_agent_session_turn,
    _persist_db_traces_and_emit_event,
    _refresh_agent_session,
    _refresh_and_load_agent_session,
    _set_session_title_if_untitled,
    _SubagentMessageChunksClosed,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import DbSessionFactory, UserId
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid


def _ephemeral_sweep_cutoff() -> datetime:
    """The updated_at below which the sweeper's ephemeral pass reaps a session."""
    return datetime.now(timezone.utc) - timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS)


class _EventQueue:
    def __init__(self) -> None:
        self.events: list[DmlEvent] = []

    def put(self, item: DmlEvent) -> None:
        self.events.append(item)


class TestAgentSessionPersistence:
    async def test_create_load_and_final_update_does_not_recreate_deleted_session(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            created = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="",
                project_name="assistant_agent",
            )
            session.add(created)
            await session.flush()
            created_rowid = created.id

        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(created_rowid))),
                user_id=None,
            )
            assert loaded is not None
            assert loaded.id == created_rowid
            await session.execute(
                delete(models.AgentSession).where(models.AgentSession.id == created_rowid)
            )

        async with db() as session:
            refreshed_rowid = await _refresh_agent_session(
                session,
                agent_session_rowid=created_rowid,
                user_id=None,
            )
            title_was_applied = await _set_session_title_if_untitled(
                session,
                agent_session_rowid=created_rowid,
                user_id=None,
                title="title",
            )
            assert refreshed_rowid is None
            assert not title_was_applied
            assert await session.scalar(select(models.AgentSession.id)) is None

    async def test_deleted_rowid_is_not_reused(self, db: DbSessionFactory) -> None:
        async with db() as session:
            first = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="first",
                project_name="assistant_agent",
            )
            session.add(first)
            await session.flush()
            first_rowid = first.id
            await session.delete(first)

        async with db() as session:
            second = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="second",
                project_name="assistant_agent",
            )
            session.add(second)
            await session.flush()
            assert second.id > first_rowid

    async def test_slides_the_ttl_window_for_an_ephemeral_session(
        self,
        db: DbSessionFactory,
    ) -> None:
        # Idle long enough that the sweeper's next pass would have reaped it.
        stale = _ephemeral_sweep_cutoff() - timedelta(hours=1)
        async with db() as session:
            ephemeral = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="",
                project_name="assistant_agent",
                is_ephemeral=True,
            )
            ephemeral.created_at = stale
            ephemeral.updated_at = stale
            session.add(ephemeral)
            await session.flush()
            ephemeral_rowid = ephemeral.id

        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(ephemeral_rowid))),
                user_id=None,
            )
            # updated_at *is* the deadline now, so the bump is what buys another
            # full TTL — and the session stays ephemeral through the refresh.
            assert loaded.is_ephemeral is True
            assert loaded.updated_at > _ephemeral_sweep_cutoff()

        async with db() as session:
            persisted_updated_at = await session.scalar(
                select(models.AgentSession.updated_at).where(
                    models.AgentSession.id == ephemeral_rowid
                )
            )
            assert persisted_updated_at is not None
            assert persisted_updated_at > _ephemeral_sweep_cutoff()

    async def test_marks_a_persisted_session_active_without_making_it_ephemeral(
        self,
        db: DbSessionFactory,
    ) -> None:
        stale = datetime.now(timezone.utc) - timedelta(days=30)
        async with db() as session:
            persistent = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="",
                project_name="assistant_agent",
            )
            persistent.created_at = stale
            persistent.updated_at = stale
            session.add(persistent)
            await session.flush()
            persistent_rowid = persistent.id

        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(persistent_rowid))),
                user_id=None,
            )
            assert loaded.id == persistent_rowid
            assert loaded.is_ephemeral is False
            # The turn-start updated_at bump keeps the retention sweeper from
            # treating an in-flight turn as idle.
            assert loaded.updated_at > stale

        async with db() as session:
            persisted_updated_at = await session.scalar(
                select(models.AgentSession.updated_at).where(
                    models.AgentSession.id == persistent_rowid
                )
            )
            assert persisted_updated_at is not None
            assert persisted_updated_at > stale

    async def test_resumes_an_ephemeral_session_the_sweeper_has_not_reached_yet(
        self,
        db: DbSessionFactory,
    ) -> None:
        """A lapsed TTL is not a read-time gate — deletion is the sweeper's job alone.

        The deadline used to be stored, so reads could compare against it and hide
        a session the sweeper had not deleted yet. With the deadline derived from
        ``updated_at`` there is nothing to compare that resuming would not have
        reset anyway, so an idle ephemeral session stays resumable until a sweep
        removes it — at most one sweep interval past its TTL.
        """
        stale = _ephemeral_sweep_cutoff() - timedelta(hours=1)
        async with db() as session:
            ephemeral = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title="",
                project_name="assistant_agent",
                is_ephemeral=True,
            )
            ephemeral.created_at = stale
            ephemeral.updated_at = stale
            session.add(ephemeral)
            await session.flush()
            ephemeral_rowid = ephemeral.id

        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(ephemeral_rowid))),
                user_id=None,
            )
            assert loaded.id == ephemeral_rowid

        # The refresh never deletes; the row is left for the sweeper.
        async with db() as session:
            surviving_rowid = await session.scalar(
                select(models.AgentSession.id).where(models.AgentSession.id == ephemeral_rowid)
            )
            assert surviving_rowid == ephemeral_rowid


class TestAutoGeneratedTitle:
    """A manual rename made while the first turn streams must always win."""

    @staticmethod
    async def _insert_agent_session(db: DbSessionFactory, *, title: str) -> int:
        async with db() as session:
            agent_session = models.AgentSession(
                **_agent_session_model_kwargs(),
                user_id=None,
                title=title,
                project_name="assistant_agent",
            )
            session.add(agent_session)
            await session.flush()
            return agent_session.id

    @staticmethod
    async def _load_title(db: DbSessionFactory, agent_session_rowid: int) -> str | None:
        async with db() as session:
            title: str | None = await session.scalar(
                select(models.AgentSession.title).where(
                    models.AgentSession.id == agent_session_rowid
                )
            )
            return title

    async def test_fills_in_a_still_untitled_session(self, db: DbSessionFactory) -> None:
        agent_session_rowid = await self._insert_agent_session(db, title="")
        title_was_applied = await _persist_agent_session_title(
            db,
            agent_session_rowid=agent_session_rowid,
            user_id=None,
            title="Generated summary",
        )
        assert title_was_applied
        assert await self._load_title(db, agent_session_rowid) == "Generated summary"

    async def test_does_not_overwrite_a_rename_made_during_the_first_turn(
        self,
        db: DbSessionFactory,
    ) -> None:
        # The session was untitled when the turn started, but the user renamed
        # it before the background summary task finished.
        agent_session_rowid = await self._insert_agent_session(db, title="")
        async with db() as session:
            await session.execute(
                update(models.AgentSession)
                .where(models.AgentSession.id == agent_session_rowid)
                .values(title="Manual rename")
            )
        title_was_applied = await _persist_agent_session_title(
            db,
            agent_session_rowid=agent_session_rowid,
            user_id=None,
            title="Generated summary",
        )
        # The False return tells the stream to discard the summary instead of
        # sending it to the client, which would mirror it onto the UI title.
        assert not title_was_applied
        assert await self._load_title(db, agent_session_rowid) == "Manual rename"

    async def test_turn_persist_saves_messages_without_touching_the_title(
        self,
        db: DbSessionFactory,
    ) -> None:
        agent_session_rowid = await self._insert_agent_session(db, title="Manual rename")
        turn_messages = [
            PhoenixUIMessage(
                id=_message_uuid("user-message"),
                role="user",
                parts=[TextUIPart(type="text", text="Hello")],
            ),
            PhoenixUIMessage(
                id=_message_uuid("assistant-message"),
                role="assistant",
                parts=[TextUIPart(type="text", text="Hi")],
            ),
        ]
        await _persist_agent_session_turn(
            db,
            agent_session_rowid=agent_session_rowid,
            user_id=None,
            new_messages=turn_messages,
            bashkit_snapshot=None,
        )
        assert await self._load_title(db, agent_session_rowid) == "Manual rename"
        async with db() as session:
            persisted_message_count = await session.scalar(
                select(func.count(models.AgentSessionMessage.id)).where(
                    models.AgentSessionMessage.agent_session_id == agent_session_rowid
                )
            )
            assert persisted_message_count == len(turn_messages)


class TestPersistDbTracesAndEmitEvent:
    @staticmethod
    def _trace(
        *,
        project_id: int,
        session_id: str,
        trace_id: str,
        span_id: str,
        start_time: datetime,
    ) -> models.Trace:
        end_time = start_time + timedelta(seconds=1)
        trace = models.Trace(
            project_rowid=project_id,
            trace_id=trace_id,
            start_time=start_time,
            end_time=end_time,
            project_session=models.ProjectSession(
                project_id=project_id,
                session_id=session_id,
                start_time=start_time,
                end_time=end_time,
            ),
        )
        trace.spans = [
            models.Span(
                name="agent",
                span_id=span_id,
                parent_id=None,
                span_kind="AGENT",
                start_time=start_time,
                end_time=end_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
                llm_token_count_prompt=None,
                llm_token_count_completion=None,
            )
        ]
        return trace

    async def test_persists_local_traces_and_emits_span_insert_event(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name="pxi-dev-test")
            session.add(project)
            await session.flush()
            project_id = project.id

        start_time = datetime(2026, 6, 29, 15, 0, tzinfo=timezone.utc)
        db_traces = [
            self._trace(
                project_id=project_id,
                session_id="session-1",
                trace_id="trace-1",
                span_id="span-1",
                start_time=start_time,
            ),
            self._trace(
                project_id=project_id,
                session_id="session-1",
                trace_id="trace-2",
                span_id="span-2",
                start_time=start_time + timedelta(seconds=2),
            ),
        ]
        event_queue = _EventQueue()

        await _persist_db_traces_and_emit_event(
            db=db,
            event_queue=event_queue,
            db_traces=db_traces,
        )

        assert event_queue.events == [SpanInsertEvent((project_id,))]
        async with db.read() as session:
            trace_count = await session.scalar(
                select(func.count(models.Trace.id)).where(models.Trace.project_rowid == project_id)
            )
            assert trace_count == 2
            project_session = await session.scalar(
                select(models.ProjectSession).where(models.ProjectSession.session_id == "session-1")
            )
            assert project_session is not None
            assert project_session.start_time == start_time
            assert project_session.end_time == start_time + timedelta(seconds=3)


class TestBuildMessageMetadataChunk:
    def test_omits_turn_trace_context_when_none(self) -> None:
        # When tracing is off and the turn is not a continuation, no turn
        # trace context exists. The chunk must then advertise none so the UI
        # does not render feedback/trace actions pointing at a nonexistent
        # trace.
        chunk = _build_message_metadata_chunk(
            turn_trace_context=None,
            session_id="session-1",
            usage=RequestUsage(),
        )
        assert chunk.message_metadata.phoenix is not None
        assert chunk.message_metadata.phoenix.turn_trace_context is None

    def test_advertises_the_turn_trace_context_when_present(self) -> None:
        turn_trace_context = TurnTraceContext(
            trace_id="0123456789abcdef0123456789abcdef",
            root_span_id="0123456789abcdef",
            started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        chunk = _build_message_metadata_chunk(
            turn_trace_context=turn_trace_context,
            session_id="session-1",
            usage=RequestUsage(),
        )
        assert chunk.message_metadata.phoenix is not None
        assert chunk.message_metadata.phoenix.turn_trace_context == turn_trace_context

    def test_reports_the_final_request_as_the_current_context_size(self) -> None:
        chunk = _build_message_metadata_chunk(
            turn_trace_context=None,
            session_id="session-1",
            usage=RequestUsage(
                input_tokens=100,
                output_tokens=20,
                cache_read_tokens=60,
                cache_write_tokens=10,
            ),
        )

        assert chunk.message_metadata.phoenix is not None
        usage = chunk.message_metadata.phoenix.usage
        assert usage is not None
        assert usage.tokens.prompt == 100
        assert usage.tokens.completion == 20
        assert usage.tokens.total == 120
        assert usage.prompt_details is not None
        assert usage.prompt_details.cache_read == 60
        assert usage.prompt_details.cache_write == 10

    def test_uses_final_request_usage_instead_of_cumulative_run_usage(self) -> None:
        final_request_usage = RequestUsage(input_tokens=100, output_tokens=20)
        result = MagicMock()
        result.response.usage = final_request_usage
        result.usage.input_tokens = 250
        result.usage.output_tokens = 40

        assert _get_current_context_usage(result) is final_request_usage


class TestLoadSandboxAvailability:
    """``_load_sandbox_availability`` is the one-shot pre-flight the agents
    router runs to populate ``AgentDependencies.sandbox_availability``. It
    computes only the pre-turn ``has_usable`` gate (any enabled config under an
    enabled provider on an available backend); the selectable inventory is
    fetched on-demand by the agent via ``phoenix-gql``. The ``enabled AND
    provider.enabled`` AND semantics and the available-backend-types filter must
    hold."""

    async def test_returns_false_with_no_sandbox_rows(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False

    async def test_returns_true_when_enabled_config_under_enabled_provider(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # ``sandbox_config`` fixture seeds providers (WASM enabled by default)
        # and creates a config (enabled defaults to True via server_default).
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is True

    async def test_returns_false_when_config_is_disabled(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            row = await session.get(models.SandboxConfig, sandbox_config.id)
            assert row is not None
            row.enabled = False
            await session.flush()
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False

    async def test_disabled_config_under_other_provider_does_not_mask_enabled_one(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Two providers, two configs: one disabled config under one provider,
        # one enabled config under a different enabled provider. The disabled
        # path must NOT mask the enabled one — ``has_usable`` is "any enabled
        # row anywhere," not "every row is enabled."
        async with db() as session:
            wasm_cfg = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("disabled-wasm"),
                description=None,
                config={},
                timeout=30,
                enabled=False,
            )
            session.add(wasm_cfg)
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False
            other_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="PYTHON",
                name=Identifier("enabled-e2b"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add(other_cfg)
            await session.flush()
            # E2B provider defaults to enabled=False in sync_sandbox_providers;
            # flip it so the test exercises the positive branch.
            e2b = await session.get(models.SandboxProvider, "E2B")
            assert e2b is not None
            e2b.enabled = True
            await session.flush()
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is True

    async def test_available_backend_types_filter_excludes_unavailable_backends(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Only an E2B config is enabled, but E2B is not in the available-backend
        # set, so the gate must be False under the form's backend-status filter.
        async with db() as session:
            e2b_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="PYTHON",
                name=Identifier("enabled-e2b"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add(e2b_cfg)
            e2b = await session.get(models.SandboxProvider, "E2B")
            assert e2b is not None
            e2b.enabled = True
            await session.flush()

            availability = await _load_sandbox_availability(
                session,
                available_backend_types=frozenset({"WASM"}),
            )

        assert availability.has_usable is False


class TestInterleaveAgentAndSubagentMessageChunks:
    async def test_drops_stale_preliminary_subagent_chunk_after_final_output(self) -> None:
        tool_call_id = "call-subagent-1"
        final_chunk = ToolOutputAvailableChunk(
            tool_call_id=tool_call_id,
            output={"summary": "final"},
        )
        stale_preliminary_chunk = ToolOutputAvailableChunk(
            tool_call_id=tool_call_id,
            output={"summary": "still running"},
            preliminary=True,
        )
        subagent_message_chunks: asyncio.Queue[BaseChunk | _SubagentMessageChunksClosed] = (
            asyncio.Queue()
        )

        async def agent_chunks() -> AsyncIterator[BaseChunk]:
            yield final_chunk
            await subagent_message_chunks.put(stale_preliminary_chunk)

        chunks = [
            chunk
            async for chunk in _interleave_agent_and_subagent_message_chunks(
                agent_message_chunks=agent_chunks(),
                subagent_message_chunks=subagent_message_chunks,
                final_tool_outputs_by_tool_call_id={},
            )
        ]

        assert chunks == [final_chunk]


class TestAgentDependenciesShape:
    """``AgentDependencies`` carries an ``is_viewer`` flag and a
    ``SandboxAvailability`` snapshot. Both default to safe-fail values so any
    constructor that omits them (auth-off mode, legacy call site) gets the
    conservative answer: viewer=False, no usable sandbox (advertise nothing
    tool-side)."""

    def test_defaults_are_safe_fail(self) -> None:
        from phoenix.server.agents.types import (
            AgentDependencies,
        )

        deps = AgentDependencies(contexts=ResolvedContexts())
        assert deps.is_viewer is False
        assert isinstance(deps.sandbox_availability, SandboxAvailability)
        assert deps.sandbox_availability.has_usable is False


class TestChatRequestBodyInstrumentUserId:
    def test_defaults_to_false_and_accepts_camel_alias(self) -> None:
        payload = {
            "id": "chat-1",
            "headless": False,
            "model": {
                "providerType": "builtin",
                "provider": "OPENAI",
                "modelName": "gpt-4o",
            },
            "message": {
                "id": _message_uuid("user-message"),
                "role": "user",
                "parts": [{"type": "text", "text": "Hello"}],
            },
        }
        request = ChatRequestBody.model_validate(payload)
        assert request.instrument_user_id is False

        request = ChatRequestBody.model_validate({**payload, "instrumentUserId": True})
        assert request.instrument_user_id is True


class TestMaybeUsingUser:
    def test_returns_nullcontext_when_flag_is_false(self) -> None:
        ctx = _maybe_using_user(instrument_user_id=False, phoenix_user_email="user@example.com")
        assert isinstance(ctx, nullcontext)

    def test_returns_nullcontext_when_flag_is_true_but_no_email(self) -> None:
        ctx = _maybe_using_user(instrument_user_id=True, phoenix_user_email=None)
        assert isinstance(ctx, nullcontext)

    def test_passes_user_email_to_using_user(self) -> None:
        with patch("phoenix.server.api.routers.agents.using_user") as mock_cm:
            _maybe_using_user(instrument_user_id=True, phoenix_user_email="user@example.com")
        mock_cm.assert_called_once_with("user@example.com")


class TestLoadPhoenixUserEmail:
    def _make_phoenix_user(self, user_id: int) -> PhoenixUser:
        from phoenix.server.types import UserClaimSet, UserTokenAttributes

        uid = UserId(user_id)
        attrs = UserTokenAttributes(user_role="MEMBER")
        return PhoenixUser(uid, UserClaimSet(subject=uid, attributes=attrs))

    async def test_returns_none_when_no_phoenix_user(self, db: DbSessionFactory) -> None:
        async with db() as session:
            email = await _load_phoenix_user_email(session=session, phoenix_user=None)

        assert email is None

    async def test_loads_email_from_authenticated_user_row(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_role = models.UserRole(name="MEMBER")
            session.add(user_role)
            await session.flush()
            user = models.User(
                user_role_id=user_role.id,
                username="agent-test-user",
                email="agent-test-user@example.com",
                password_hash=b"hash",
                password_salt=b"salt",
                reset_password=False,
                auth_method="LOCAL",
            )
            session.add(user)
            await session.flush()

            email = await _load_phoenix_user_email(
                session=session,
                phoenix_user=self._make_phoenix_user(user.id),
            )

        assert email == "agent-test-user@example.com"

    async def test_returns_none_when_user_row_has_no_email(self, db: DbSessionFactory) -> None:
        async with db() as session:
            user_role = models.UserRole(name="MEMBER")
            session.add(user_role)
            await session.flush()
            user = models.User(
                user_role_id=user_role.id,
                username="agent-test-user-no-email",
                email=None,
                password_hash=None,
                password_salt=None,
                reset_password=False,
                auth_method="LDAP",
                ldap_unique_id="agent-test-user-no-email",
            )
            session.add(user)
            await session.flush()

            email = await _load_phoenix_user_email(
                session=session,
                phoenix_user=self._make_phoenix_user(user.id),
            )

        assert email is None
