from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from jinja2 import Template
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, ToolOutputAvailableChunk
from sqlalchemy import delete, func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import (
    SandboxAvailability,
)
from phoenix.server.api.routers.agents import (
    _interleave_agent_and_subagent_message_chunks,
    _load_phoenix_user_email,
    _load_sandbox_availability,
    _maybe_using_user,
    _persist_db_traces_and_emit_event,
    _refresh_and_load_agent_session,
    _SubagentMessageChunksClosed,
    _update_agent_session,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import DbSessionFactory, UserId


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
                project_session_id="11111111-1111-4111-8111-111111111111",
                user_id=None,
                title="",
                project_name="assistant_agent",
            )
            session.add(created)
            await session.flush()
            assert created.project_session_id == "11111111-1111-4111-8111-111111111111"
            created_rowid = created.id
            created_project_session_id = created.project_session_id

        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(created_rowid))),
                user_id=None,
            )
            assert loaded is not None
            assert loaded.id == created_rowid
            assert loaded.project_session_id == created_project_session_id
            await session.execute(
                delete(models.AgentSession).where(models.AgentSession.id == created_rowid)
            )

        async with db() as session:
            updated_rowid = await _update_agent_session(
                session,
                agent_session_rowid=created_rowid,
                user_id=None,
                title="title",
            )
            assert updated_rowid is None
            assert await session.scalar(select(models.AgentSession.id)) is None

    async def test_deleted_rowid_is_not_reused(self, db: DbSessionFactory) -> None:
        async with db() as session:
            first = models.AgentSession(
                project_session_id="11111111-1111-4111-8111-111111111111",
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
                project_session_id="22222222-2222-4222-8222-222222222222",
                user_id=None,
                title="second",
                project_name="assistant_agent",
            )
            session.add(second)
            await session.flush()
            assert second.id > first_rowid

    async def test_refreshes_expiry_for_a_temporary_session(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            temporary = models.AgentSession(
                project_session_id="33333333-3333-4333-8333-333333333333",
                user_id=None,
                title="",
                project_name="assistant_agent",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
            session.add(temporary)
            await session.flush()
            temporary_rowid = temporary.id

        before_refresh = datetime.now(timezone.utc)
        async with db() as session:
            loaded = await _refresh_and_load_agent_session(
                session,
                agent_session_id=str(GlobalID("AgentSession", str(temporary_rowid))),
                user_id=None,
            )
            # The sliding window is pushed well past the original near-term expiry.
            assert loaded.expires_at is not None
            assert loaded.expires_at > before_refresh + timedelta(hours=23)

        async with db() as session:
            persisted_expiry = await session.scalar(
                select(models.AgentSession.expires_at).where(
                    models.AgentSession.id == temporary_rowid
                )
            )
            assert persisted_expiry is not None
            assert persisted_expiry > before_refresh + timedelta(hours=23)

    async def test_marks_a_persistent_session_active_without_granting_expiry(
        self,
        db: DbSessionFactory,
    ) -> None:
        stale = datetime.now(timezone.utc) - timedelta(days=30)
        async with db() as session:
            persistent = models.AgentSession(
                project_session_id="44444444-4444-4444-8444-444444444444",
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
            assert loaded.expires_at is None
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

    async def test_rejects_an_expired_temporary_session(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            temporary = models.AgentSession(
                project_session_id="55555555-5555-4555-8555-555555555555",
                user_id=None,
                title="",
                project_name="assistant_agent",
                expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            )
            session.add(temporary)
            await session.flush()
            temporary_rowid = temporary.id

        async with db() as session:
            with pytest.raises(HTTPException) as exc_info:
                await _refresh_and_load_agent_session(
                    session,
                    agent_session_id=str(GlobalID("AgentSession", str(temporary_rowid))),
                    user_id=None,
                )
            assert exc_info.value.status_code == 404

        # The refresh never deletes; the expired row is left for the sweeper.
        async with db() as session:
            surviving_rowid = await session.scalar(
                select(models.AgentSession.id).where(models.AgentSession.id == temporary_rowid)
            )
            assert surviving_rowid == temporary_rowid


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


class TestEditCodeEvaluatorDraftToolRendering:
    """The code-evaluator draft-edit tool template no longer inlines a sandbox
    inventory. It renders without any ``available_sandbox_configs`` variable and
    directs the agent to fetch the selectable set on-demand via ``phoenix-gql``,
    requesting env-var names but never ``secretKey``."""

    def _edit_template(self) -> Template:
        return AgentPrompts().edit_code_evaluator_draft_tool

    def test_directs_on_demand_sandbox_inventory_fetch(self) -> None:
        rendered = self._edit_template().render()
        assert "phoenix-gql" in rendered
        assert "sandboxProviders" in rendered
        assert "envVars { name }" in rendered
        # The projection requests env-var names only; the prompt explicitly
        # forbids requesting the secret-bearing field.
        assert "never `secretKey`" in rendered


class TestObservabilityMixinAttachUserId:
    def test_defaults_to_false_and_accepts_camel_alias(self) -> None:
        from phoenix.server.api.routers.agents import _ObservabilityMixin

        mixin = _ObservabilityMixin()
        assert mixin.attach_user_id is False

        mixin = _ObservabilityMixin.model_validate({"attachUserId": True})
        assert mixin.attach_user_id is True


class TestMaybeUsingUser:
    def test_returns_nullcontext_when_flag_is_false(self) -> None:
        ctx = _maybe_using_user(attach_user_id=False, phoenix_user_email="user@example.com")
        assert isinstance(ctx, nullcontext)

    def test_returns_nullcontext_when_flag_is_true_but_no_email(self) -> None:
        ctx = _maybe_using_user(attach_user_id=True, phoenix_user_email=None)
        assert isinstance(ctx, nullcontext)

    def test_passes_user_email_to_using_user(self) -> None:
        with patch("phoenix.server.api.routers.agents.using_user") as mock_cm:
            _maybe_using_user(attach_user_id=True, phoenix_user_email="user@example.com")
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
