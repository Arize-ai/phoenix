from __future__ import annotations

import ast
import asyncio
import logging
import time
from collections.abc import AsyncIterator
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import anyio
import pytest
from jinja2 import Template
from opentelemetry.trace import (
    SpanContext,
    TraceFlags,
    format_span_id,
    format_trace_id,
)
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, ToolOutputAvailableChunk
from pydantic_ai.usage import RequestUsage
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import (
    SandboxAvailability,
)
from phoenix.server.api.routers import agents as agents_module
from phoenix.server.api.routers.agents import (
    TurnTraceContext,
    _build_message_metadata_chunk,
    _get_current_context_usage,
    _interleave_agent_and_subagent_message_chunks,
    _load_phoenix_user_email,
    _load_sandbox_availability,
    _maybe_using_user,
    _persist_agent_traces,
    _persist_db_traces_and_emit_event,
    _SubagentMessageChunksClosed,
    _tracer_scope,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import DbSessionFactory, UserId


class _EventQueue:
    def __init__(self) -> None:
        self.events: list[DmlEvent] = []

    def put(self, item: DmlEvent) -> None:
        self.events.append(item)


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


class TestTracerScope:
    def test_returns_the_tracer_so_the_block_releases_it(self) -> None:
        tracer = MagicMock()
        assert _tracer_scope(tracer) is tracer

    async def test_is_a_no_op_when_trace_recording_is_off(self) -> None:
        async with _tracer_scope(None):
            pass


class TestEveryAgentEndpointScopesItsTracer:
    """The agents router is the heaviest `Tracer` owner — one per turn, holding
    every span with its full message history — and it is the only owner with no
    runtime lifecycle test. Each endpoint needs app state, authentication, a
    built model and a constructed agent before it reaches the tracer, so none is
    reachable from a unit test.

    Guard the release structurally instead. Without this, deleting an
    `async with` is invisible: replacing all three with `_tracer_scope(None)`
    leaves this suite entirely green while no tracer is ever released.
    """

    ENDPOINTS = ("run_server_agent", "chat", "summarize_endpoint")

    @staticmethod
    def _functions() -> dict[str, ast.AsyncFunctionDef]:
        source = Path(agents_module.__file__).read_text(encoding="utf-8")
        return {
            node.name: node
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.AsyncFunctionDef)
        }

    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    def test_the_endpoint_builds_a_tracer(self, endpoint: str) -> None:
        function = self._functions()[endpoint]
        built = [
            node
            for node in ast.walk(function)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "Tracer"
        ]
        assert built, f"{endpoint} no longer builds a Tracer; this guard is now testing nothing"

    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    def test_the_endpoint_scopes_that_tracer(self, endpoint: str) -> None:
        function = self._functions()[endpoint]
        scoped = [
            item.context_expr
            for node in ast.walk(function)
            if isinstance(node, ast.AsyncWith)
            for item in node.items
            if isinstance(item.context_expr, ast.Call)
            and isinstance(item.context_expr.func, ast.Name)
            and item.context_expr.func.id == "_tracer_scope"
        ]
        assert scoped, f"{endpoint} never enters a tracer scope, so its tracer is never released"
        for call in scoped:
            assert [argument.id for argument in call.args if isinstance(argument, ast.Name)] == [
                "tracer"
            ], (
                f"{endpoint} scopes something other than its own `tracer`, "
                f"so the tracer it built is never released"
            )


class TestPersistAgentTraces:
    """Teardown and the remote drain both belong to the `async with` that owns
    the tracer, so what is left to protect here is that a bookkeeping failure
    never replaces the exception already in flight — every caller runs this
    from a `finally`.
    """

    @staticmethod
    def _tracer() -> MagicMock:
        tracer = MagicMock()
        tracer.get_db_traces.return_value = []
        return tracer

    async def test_persistence_failure_is_logged_not_raised(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        with patch(
            "phoenix.server.api.routers.agents._ensure_project_exists",
            new=AsyncMock(side_effect=RuntimeError("db is down")),
        ):
            with caplog.at_level(logging.ERROR, logger="phoenix.server.api.routers.agents"):
                await _persist_agent_traces(
                    tracer=self._tracer(),
                    request=MagicMock(),
                    project_name="p",
                )
        assert "Failed to persist agent traces" in caplog.text

    async def test_cancellation_propagates(self) -> None:
        """The guard must not swallow a `CancelledError` raised by the write
        itself. Shielding covers cancellation delivered from outside; it does
        not, and should not, turn this into a success.
        """
        with patch(
            "phoenix.server.api.routers.agents._ensure_project_exists",
            new=AsyncMock(side_effect=asyncio.CancelledError()),
        ):
            with pytest.raises(asyncio.CancelledError):
                await _persist_agent_traces(
                    tracer=self._tracer(),
                    request=MagicMock(),
                    project_name="p",
                )

    async def test_a_disconnected_client_does_not_lose_the_write(self) -> None:
        """The commonest failure: the client goes away mid-turn and cancels the
        scope this runs in. Unshielded, the first suspending `await` raises
        `CancelledError` before the database is reached and the turn's traces
        are lost even though the turn produced its answer.
        """
        persisted: list[object] = []

        async def _ensure(db: object, name: str) -> int:
            await anyio.lowlevel.checkpoint()
            return 1

        async def _persist(*, db: object, event_queue: object, db_traces: object) -> None:
            await anyio.lowlevel.checkpoint()
            persisted.append(db_traces)

        with (
            patch("phoenix.server.api.routers.agents._ensure_project_exists", new=_ensure),
            patch(
                "phoenix.server.api.routers.agents._persist_db_traces_and_emit_event",
                new=_persist,
            ),
        ):
            with anyio.CancelScope() as scope:
                scope.cancel()
                await _persist_agent_traces(
                    tracer=self._tracer(),
                    request=MagicMock(),
                    project_name="p",
                )
        assert persisted == [[]]

    async def test_a_stalled_database_cannot_hold_the_handler_open(self) -> None:
        """The shield is bounded, so a burst of disconnects against a stalled
        database cannot pile up handlers. Expiry logs like any write failure.

        The assertion is on elapsed time rather than an enclosing deadline. The
        bound lives inside the shield that protects the write from a client
        disconnect, and that shield swallows an outer cancellation too — so an
        enclosing `fail_after` can never fire, and dropping the bound would make
        this test slow instead of making it fail.
        """

        async def _hang(db: object, name: str) -> int:
            await anyio.sleep(5)
            raise AssertionError("unreachable")

        with (
            patch("phoenix.server.api.routers.agents._ensure_project_exists", new=_hang),
            patch("phoenix.server.api.routers.agents._TRACE_PERSIST_TIMEOUT_SECONDS", 0.05),
        ):
            started = time.monotonic()
            await _persist_agent_traces(
                tracer=self._tracer(),
                request=MagicMock(),
                project_name="p",
            )
            elapsed = time.monotonic() - started
        assert elapsed < 1, (
            f"the persist waited {elapsed:.1f}s on a stalled database, so the bound never fired"
        )


class TestBuildMessageMetadataChunk:
    @staticmethod
    def _span_context() -> SpanContext:
        return SpanContext(
            trace_id=0x0123456789ABCDEF0123456789ABCDEF,
            span_id=0x0123456789ABCDEF,
            is_remote=True,
            trace_flags=TraceFlags(TraceFlags.SAMPLED),
        )

    def test_omits_trace_when_no_span_or_turn_context(self) -> None:
        # When tracing is off, `_on_complete` passes no span context and no turn
        # trace context. The chunk must then advertise no trace so the UI does
        # not render feedback/trace actions pointing at a nonexistent trace.
        chunk = _build_message_metadata_chunk(
            span_context=None,
            turn_trace_context=None,
            session_id="session-1",
            usage=RequestUsage(),
        )
        assert chunk.message_metadata.trace is None

    def test_uses_turn_trace_context_when_present(self) -> None:
        turn_trace_context = TurnTraceContext(
            trace_id="0123456789abcdef0123456789abcdef",
            root_span_id="0123456789abcdef",
            started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        chunk = _build_message_metadata_chunk(
            span_context=self._span_context(),
            turn_trace_context=turn_trace_context,
            session_id="session-1",
            usage=RequestUsage(),
        )
        assert chunk.message_metadata.trace is not None
        assert chunk.message_metadata.trace.trace_id == turn_trace_context.trace_id
        assert chunk.message_metadata.trace.root_span_id == turn_trace_context.root_span_id

    def test_falls_back_to_span_context_when_no_turn_context(self) -> None:
        span_context = self._span_context()
        chunk = _build_message_metadata_chunk(
            span_context=span_context,
            turn_trace_context=None,
            session_id="session-1",
            usage=RequestUsage(),
        )
        assert chunk.message_metadata.trace is not None
        assert chunk.message_metadata.trace.trace_id == format_trace_id(span_context.trace_id)
        assert chunk.message_metadata.trace.root_span_id == format_span_id(span_context.span_id)

    def test_reports_the_final_request_as_the_current_context_size(self) -> None:
        chunk = _build_message_metadata_chunk(
            span_context=None,
            turn_trace_context=None,
            session_id="session-1",
            usage=RequestUsage(
                input_tokens=100,
                output_tokens=20,
                cache_read_tokens=60,
                cache_write_tokens=10,
            ),
        )

        usage = chunk.message_metadata.usage
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
