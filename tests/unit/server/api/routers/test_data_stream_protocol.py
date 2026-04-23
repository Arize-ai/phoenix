import json
from datetime import datetime, timezone

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.routers.agent_backend_tools import (
    resolve_backend_tool_registry,
)
from phoenix.server.api.routers.chat_tracing import StreamAccumulator
from phoenix.server.api.routers.data_stream_protocol import (
    ChatBody,
    FrontendProjectContext,
    FrontendTraceContext,
    NormalizedProjectContext,
    NormalizedSpanFilterConditionContext,
    NormalizedTraceContext,
    _backend_tool_loop_limit_error,
    build_current_phoenix_context_system_prompt,
    normalize_agent_contexts,
    parse_chat_body,
)
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.types import DbSessionFactory


class TestParseChatBody:
    def test_parses_basic_body(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
            }
        ).encode()
        body = parse_chat_body(raw)
        assert isinstance(body, ChatBody)
        assert body.session_id is None
        assert body.export_remote_traces is False
        assert body.ingest_traces is True
        assert body.trace_name_suffix == "Turn"
        assert body.system is None
        assert body.tools is None
        assert len(body.messages) >= 1

    def test_parses_session_id_and_trace_destination_flags(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
                "sessionId": "my-session",
                "exportRemoteTraces": False,
                "ingestTraces": False,
                "traceNameSuffix": "Summary",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.session_id == "my-session"
        assert body.export_remote_traces is False
        assert body.ingest_traces is False
        assert body.trace_name_suffix == "Summary"

    def test_parses_tools(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Search for X"}],
                    }
                ],
                "tools": [
                    {"name": "search", "description": "Search the web", "parameters": {}},
                ],
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.tools is not None
        assert len(body.tools) == 1
        assert body.tools[0].name == "search"
        assert len(body.raw_tools) == 1
        assert body.raw_tools[0]["type"] == "function"
        assert body.raw_tools[0]["function"]["name"] == "search"
        assert body.raw_tools[0]["function"]["description"] == "Search the web"

    def test_parses_system_prompt(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
                "system": "You are a helpful assistant.",
            }
        ).encode()
        body = parse_chat_body(raw)
        assert body.system == "You are a helpful assistant."
        # System prompt should be prepended to messages as a ModelRequest.
        from pydantic_ai.messages import ModelRequest, SystemPromptPart

        first_msg = body.messages[0]
        assert isinstance(first_msg, ModelRequest)
        assert any(isinstance(p, SystemPromptPart) for p in first_msg.parts)

    def test_parses_structured_contexts(self) -> None:
        raw = json.dumps(
            {
                "trigger": "submit-message",
                "id": "test-1",
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello"}],
                    }
                ],
                "contexts": [
                    {
                        "source": "route",
                        "type": "project",
                        "projectId": "project-1",
                    },
                    {
                        "source": "route",
                        "type": "trace",
                        "projectId": "project-1",
                        "traceId": "trace-1",
                    },
                ],
            }
        ).encode()

        body = parse_chat_body(raw)

        assert body.contexts is not None
        assert isinstance(body.contexts[0], FrontendProjectContext)
        assert body.contexts[0].project_id == "project-1"
        assert isinstance(body.contexts[1], FrontendTraceContext)
        assert body.contexts[1].trace_id == "trace-1"


class TestStreamAccumulator:
    def test_accumulates_text(self) -> None:
        acc = StreamAccumulator()
        acc.text_parts.append("Hello ")
        acc.text_parts.append("world!")
        assert acc.accumulated_text == "Hello world!"

    def test_accumulates_tool_calls(self) -> None:
        acc = StreamAccumulator()
        # Simulate tool call start.
        acc._current_tool_meta[0] = {"id": "tc-1", "name": "search"}
        acc._current_tool_args[0] = ['{"q":', '"test"}']
        # Simulate tool call end.
        meta = acc._current_tool_meta.pop(0)
        args = acc._current_tool_args.pop(0)
        acc.tool_calls.append(
            {
                "id": meta["id"],
                "name": meta["name"],
                "arguments": "".join(args),
            }
        )
        assert len(acc.tool_calls) == 1
        assert acc.tool_calls[0]["id"] == "tc-1"
        assert acc.tool_calls[0]["name"] == "search"
        assert acc.tool_calls[0]["arguments"] == '{"q":"test"}'

    def test_empty_accumulator(self) -> None:
        acc = StreamAccumulator()
        assert acc.accumulated_text == ""
        assert acc.tool_calls == []


class TestBackendToolLoopLimitError:
    def test_returns_error_when_backend_loop_limit_is_exhausted(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=5,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=False,
        )

        assert error is not None
        assert "maximum number of follow-up model calls" in error

    def test_skips_error_before_limit(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=4,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=False,
        )

        assert error is None


class TestAgentContexts:
    @pytest.mark.asyncio
    async def test_normalize_contexts_resolves_project_ids_and_drops_invalid_ones(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name="context-project")
            session.add(project)
            await session.flush()
            project_id = str(GlobalID(ProjectNodeType.__name__, str(project.id)))
            await session.commit()

        raw_body = parse_chat_body(
            json.dumps(
                {
                    "trigger": "submit-message",
                    "id": "test-1",
                    "messages": [
                        {
                            "id": "msg-1",
                            "role": "user",
                            "parts": [{"type": "text", "text": "Hello"}],
                        }
                    ],
                    "contexts": [
                        {
                            "source": "route",
                            "type": "project",
                            "projectId": project_id,
                        },
                        {
                            "source": "route",
                            "type": "trace",
                            "projectId": project_id,
                            "traceId": "trace-1",
                        },
                        {
                            "source": "route",
                            "type": "project",
                            "projectId": "invalid-project-id",
                        },
                    ],
                }
            ).encode()
        )

        normalized_contexts = await normalize_agent_contexts(
            db=db,
            contexts=raw_body.contexts,
        )

        assert normalized_contexts == [
            NormalizedProjectContext(
                source="route",
                type="project",
                project_id=project_id,
                project_rowid=project.id,
            ),
            NormalizedTraceContext(
                source="route",
                type="trace",
                project_id=project_id,
                project_rowid=project.id,
                trace_id="trace-1",
            ),
        ]

    def test_builds_server_authored_context_prompt(self) -> None:
        prompt = build_current_phoenix_context_system_prompt(
            [
                NormalizedProjectContext(
                    source="route",
                    type="project",
                    project_id="project-1",
                    project_rowid=1,
                ),
                NormalizedSpanFilterConditionContext(
                    source="mounted",
                    type="span_filter_condition",
                    project_id="project-1",
                    project_rowid=1,
                    filter_condition="span_kind == 'LLM'",
                ),
            ]
        )

        assert prompt is not None
        assert "Current Phoenix context" in prompt
        assert "Project ID (GraphQL GlobalID): project-1" in prompt
        assert "Active span filter condition: span_kind == 'LLM'" in prompt

    @pytest.mark.asyncio
    async def test_project_tool_registry_requires_project_context(
        self,
        db: DbSessionFactory,
    ) -> None:
        registry_without_project = await resolve_backend_tool_registry(
            db=db,
            contexts=[],
            mcp_client=None,
        )

        assert "search_project" not in registry_without_project.tool_names

    @pytest.mark.asyncio
    async def test_search_project_tool_uses_active_project_context(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name="search-project")
            session.add(project)
            await session.flush()

            trace = models.Trace(
                project_rowid=project.id,
                trace_id="trace-1",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id="span-1",
                name="CheckoutAgent",
                span_kind="CHAIN",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
                attributes={
                    "input": {"value": "checkout question"},
                    "output": {"value": "checkout answer"},
                },
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.commit()

        project_id = str(GlobalID(ProjectNodeType.__name__, str(project.id)))
        registry = await resolve_backend_tool_registry(
            db=db,
            contexts=[
                NormalizedProjectContext(
                    source="route",
                    type="project",
                    project_id=project_id,
                    project_rowid=project.id,
                )
            ],
            mcp_client=None,
        )

        assert "search_project" in registry.tool_names

        result = await registry.execute(
            "search_project",
            {"query": "checkout", "limit": 3},
        )

        assert 'Project "search-project"' in result
        assert 'Search query: "checkout"' in result
        assert "trace-1" in result
        assert "CheckoutAgent" in result

    def test_skips_error_when_frontend_tools_are_pending(self) -> None:
        error = _backend_tool_loop_limit_error(
            loop_count=5,
            max_loops=5,
            backend_calls=[{"name": "search_docs"}],
            has_frontend_calls=True,
        )

        assert error is None
