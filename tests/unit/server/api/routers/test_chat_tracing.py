import asyncio
import json

import pytest
from openinference.semconv.trace import OpenInferenceSpanKindValues
from sqlalchemy import select

from phoenix.config import get_env_phoenix_pxi_project_name
from phoenix.db import models
from phoenix.server.api.routers.chat_tracing import (
    create_agent_span,
    create_llm_span,
    ensure_project_exists,
    finalize_agent_span,
    finalize_llm_span,
    persist_traces,
    replay_history_spans,
)
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


class _FakeEventQueue:
    """Minimal event queue that records put() calls."""

    def __init__(self) -> None:
        self.events: list[object] = []

    def put(self, event: object) -> None:
        self.events.append(event)


class _FakeUsage:
    """Mimics pydantic-ai's RequestUsage for testing."""

    def __init__(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


def _make_tracer(db: DbSessionFactory) -> Tracer:
    store = GenerativeModelStore(db=db)
    calc = SpanCostCalculator(db=db, model_store=store)
    return Tracer(span_cost_calculator=calc)


class TestEnsureProjectExists:
    @pytest.mark.asyncio
    async def test_creates_project_when_not_exists(self, db: DbSessionFactory) -> None:
        project_id = await ensure_project_exists(db)
        assert project_id is not None
        async with db() as session:
            project = await session.get(models.Project, project_id)
            assert project is not None
            assert project.name == get_env_phoenix_pxi_project_name()

    @pytest.mark.asyncio
    async def test_returns_existing_project(self, db: DbSessionFactory) -> None:
        first_id = await ensure_project_exists(db)
        second_id = await ensure_project_exists(db)
        assert first_id == second_id

    @pytest.mark.asyncio
    async def test_concurrent_calls_create_one_project(self, db: DbSessionFactory) -> None:
        if db.dialect.value == "sqlite":
            pytest.skip("SQLite test fixture serializes nested transactions")

        first_id, second_id = await asyncio.gather(
            ensure_project_exists(db),
            ensure_project_exists(db),
        )

        assert first_id == second_id

        async with db() as session:
            projects = (
                (
                    await session.execute(
                        select(models.Project).filter_by(name=get_env_phoenix_pxi_project_name())
                    )
                )
                .scalars()
                .all()
            )
            assert len(projects) == 1


class TestSpanHierarchy:
    """Verify that AGENT → LLM parent-child span structure is correct."""

    def test_llm_span_is_child_of_agent_span(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="Hello")])]

        agent_span = create_agent_span(tracer, input_messages=messages, session_id="s1")
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)

        finalize_llm_span(llm_span, output_content="Hi there")
        finalize_agent_span(agent_span, output_content="Hi there")

        db_traces = tracer.get_db_traces(project_id=1)
        assert len(db_traces) == 1, "Both spans should be in the same trace"
        spans = db_traces[0].spans
        assert len(spans) == 2, "Should have AGENT + LLM spans"

        # Identify spans by kind.
        agent_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.AGENT.value)
        llm_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value)

        # LLM should be a child of AGENT.
        assert agent_db.parent_id is None, "AGENT is root span"
        assert llm_db.parent_id == agent_db.span_id, "LLM is child of AGENT"

    def test_agent_span_has_correct_attributes(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="What is 2+2?")])]

        agent_span = create_agent_span(tracer, input_messages=messages, session_id="test-session")
        finalize_agent_span(agent_span, output_content="The answer is 4.")

        db_traces = tracer.get_db_traces(project_id=1)
        db_span = db_traces[0].spans[0]

        assert db_span.span_kind == OpenInferenceSpanKindValues.AGENT.value
        assert db_span.name == "pxiAgent Turn"
        attrs = db_span.attributes
        assert attrs["openinference"]["span"]["kind"] == "AGENT"
        assert attrs["input"]["value"] == "What is 2+2?"
        assert attrs["input"]["mime_type"] == "text/plain"
        assert attrs["output"]["value"] == "The answer is 4."
        assert attrs["output"]["mime_type"] == "text/plain"
        assert attrs["session"]["id"] == "test-session"
        # AGENT span should NOT have llm.input_messages — those belong on LLM span.
        assert "llm" not in attrs

    def test_llm_span_has_correct_attributes(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, SystemPromptPart, UserPromptPart

        tracer = _make_tracer(db)
        messages = [
            ModelRequest(parts=[SystemPromptPart(content="You are helpful.")]),
            ModelRequest(parts=[UserPromptPart(content="Hi")]),
        ]
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search",
                    "description": "Search the web",
                    "parameters": {},
                },
            }
        ]

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(
            tracer, parent_span=agent_span, input_messages=messages, tools=tools
        )
        finalize_llm_span(
            llm_span,
            output_content="Hello!",
            usage=_FakeUsage(input_tokens=10, output_tokens=5),
            model_name="gpt-4o",
            provider="openai",
        )
        finalize_agent_span(agent_span, output_content="Hello!")

        db_traces = tracer.get_db_traces(project_id=1)
        spans = db_traces[0].spans
        llm_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value)

        assert llm_db.name == "pxiCompletion Turn"
        attrs = llm_db.attributes
        assert attrs["openinference"]["span"]["kind"] == "LLM"
        assert attrs["llm"]["model_name"] == "gpt-4o"
        assert attrs["llm"]["provider"] == "openai"
        assert attrs["llm"]["system"] == "openai"
        assert attrs["llm"]["token_count"]["prompt"] == 10
        assert attrs["llm"]["token_count"]["completion"] == 5
        assert attrs["llm"]["token_count"]["total"] == 15

        # Input messages should be on the LLM span.
        input_msgs = attrs["llm"]["input_messages"]
        assert input_msgs[0]["message"]["role"] == "system"
        assert input_msgs[0]["message"]["content"] == "You are helpful."
        assert input_msgs[1]["message"]["role"] == "user"
        assert input_msgs[1]["message"]["content"] == "Hi"

        # Output messages.
        output_msgs = attrs["llm"]["output_messages"]
        assert output_msgs[0]["message"]["role"] == "assistant"
        assert output_msgs[0]["message"]["content"] == "Hello!"

        # Tool definitions.
        tool_schema = attrs["llm"]["tools"][0]["tool"]["json_schema"]
        parsed = json.loads(tool_schema)
        assert parsed["type"] == "function"
        assert parsed["function"]["name"] == "search"
        assert parsed["function"]["description"] == "Search the web"

    def test_replays_prior_llm_and_tool_steps(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import (
            ModelRequest,
            ModelResponse,
            TextPart,
            ToolCallPart,
            ToolReturnPart,
            UserPromptPart,
        )

        tracer = _make_tracer(db)
        messages = [
            ModelRequest(parts=[UserPromptPart(content="What is 2+2?")]),
            ModelResponse(
                parts=[
                    TextPart(content="Let me calculate that."),
                    ToolCallPart(
                        tool_name="calculator",
                        args=json.dumps({"expr": "2+2"}),
                        tool_call_id="tc-1",
                    ),
                ]
            ),
            ModelRequest(
                parts=[
                    ToolReturnPart(
                        tool_name="calculator",
                        content={"result": 4},
                        tool_call_id="tc-1",
                    )
                ]
            ),
        ]
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "calculator",
                    "description": "Evaluates arithmetic expressions",
                    "parameters": {"type": "object"},
                },
            }
        ]

        agent_span = create_agent_span(tracer, input_messages=messages)
        completed_llm_steps, next_step_index = replay_history_spans(
            tracer,
            parent_span=agent_span,
            messages=messages,
            tools=tools,
        )
        llm_span = create_llm_span(
            tracer,
            parent_span=agent_span,
            input_messages=messages,
            tools=tools,
            trace_name_suffix=f"Step {completed_llm_steps + 1}",
            step_index=next_step_index,
        )

        finalize_llm_span(llm_span, output_content="The answer is 4.")
        finalize_agent_span(agent_span, output_content="The answer is 4.")

        spans = tracer.get_db_traces(project_id=1)[0].spans
        llm_spans = [s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value]
        tool_spans = [s for s in spans if s.span_kind == OpenInferenceSpanKindValues.TOOL.value]

        assert [s.name for s in llm_spans] == ["pxiCompletion Step 1", "pxiCompletion Step 2"]
        assert len(tool_spans) == 1
        assert tool_spans[0].name == "calculator"
        tool_attrs = tool_spans[0].attributes
        assert tool_attrs["tool"]["name"] == "calculator"
        assert tool_attrs["tool"]["description"] == "Evaluates arithmetic expressions"
        assert tool_attrs["tool"]["parameters"] == '{"expr": "2+2"}'
        assert tool_attrs["output"]["value"] == '{"result": 4}'

        # Verify step_index ordering: LLM(0) → TOOL(1) → LLM(2).
        # The metadata attribute is a JSON string at this layer; OTLP ingestion
        # parses it via load_json_strings, but the in-process Tracer does not.
        assert json.loads(llm_spans[0].attributes["metadata"])["step_index"] == 0
        assert json.loads(tool_spans[0].attributes["metadata"])["step_index"] == 1
        assert json.loads(llm_spans[1].attributes["metadata"])["step_index"] == 2

    def test_step_index_covers_multi_tool_multi_step_trajectory(self, db: DbSessionFactory) -> None:
        """Verify step_index is contiguous across a LLM → TOOL → TOOL → LLM trajectory."""
        from pydantic_ai.messages import (
            ModelRequest,
            ModelResponse,
            TextPart,
            ToolCallPart,
            ToolReturnPart,
            UserPromptPart,
        )

        tracer = _make_tracer(db)
        messages = [
            ModelRequest(parts=[UserPromptPart(content="Summarize the logs")]),
            # Step 1: LLM calls two tools.
            ModelResponse(
                parts=[
                    TextPart(content="I'll check two sources."),
                    ToolCallPart(tool_name="fetch_logs", args='{"hours": 12}', tool_call_id="tc-1"),
                    ToolCallPart(
                        tool_name="fetch_metrics", args='{"hours": 12}', tool_call_id="tc-2"
                    ),
                ]
            ),
            ModelRequest(
                parts=[
                    ToolReturnPart(tool_name="fetch_logs", content="log data", tool_call_id="tc-1"),
                    ToolReturnPart(
                        tool_name="fetch_metrics", content="metric data", tool_call_id="tc-2"
                    ),
                ]
            ),
        ]

        agent_span = create_agent_span(tracer, input_messages=messages)
        completed_llm_steps, next_step_index = replay_history_spans(
            tracer, parent_span=agent_span, messages=messages
        )

        # Current in-flight LLM span.
        llm_span = create_llm_span(
            tracer,
            parent_span=agent_span,
            input_messages=messages,
            trace_name_suffix=f"Step {completed_llm_steps + 1}",
            step_index=next_step_index,
        )
        finalize_llm_span(llm_span, output_content="Here is the summary.")
        finalize_agent_span(agent_span, output_content="Here is the summary.")

        spans = tracer.get_db_traces(project_id=1)[0].spans
        # Collect non-AGENT spans sorted by step_index.
        child_spans = [s for s in spans if s.span_kind != OpenInferenceSpanKindValues.AGENT.value]
        child_spans.sort(key=lambda s: json.loads(s.attributes["metadata"])["step_index"])

        assert len(child_spans) == 4
        kinds = [s.span_kind for s in child_spans]
        indices = [json.loads(s.attributes["metadata"])["step_index"] for s in child_spans]

        assert kinds == ["LLM", "TOOL", "TOOL", "LLM"]
        assert indices == [0, 1, 2, 3]

    def test_current_llm_span_preserves_kind_and_token_counts_for_long_conversations(
        self, db: DbSessionFactory
    ) -> None:
        from pydantic_ai.messages import (
            ModelRequest,
            ModelResponse,
            TextPart,
            ToolCallPart,
            ToolReturnPart,
            UserPromptPart,
        )

        tracer = _make_tracer(db)
        messages: list[ModelRequest | ModelResponse] = [
            ModelRequest(parts=[UserPromptPart(content="Analyze the last 12 hours")])
        ]
        for i in range(1, 18):
            messages.append(
                ModelResponse(
                    parts=[
                        TextPart(content=f"Step {i}"),
                        ToolCallPart(
                            tool_name="bash",
                            args=json.dumps({"command": f"run-{i}"}),
                            tool_call_id=f"tc-{i}",
                        ),
                    ]
                )
            )
            messages.append(
                ModelRequest(
                    parts=[
                        ToolReturnPart(
                            tool_name="bash",
                            content={"stdout": f"done-{i}"},
                            tool_call_id=f"tc-{i}",
                        )
                    ]
                )
            )

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)

        finalize_llm_span(
            llm_span,
            output_content="Final answer",
            usage=_FakeUsage(input_tokens=321, output_tokens=123),
            model_name="gpt-4o",
            provider="openai",
        )
        finalize_agent_span(agent_span, output_content="Final answer")

        spans = tracer.get_db_traces(project_id=1)[0].spans
        llm_db = next(s for s in spans if s.name == "pxiCompletion Turn")
        attrs = llm_db.attributes

        assert llm_db.span_kind == OpenInferenceSpanKindValues.LLM.value
        assert attrs["openinference"]["span"]["kind"] == "LLM"
        assert attrs["llm"]["token_count"]["prompt"] == 321
        assert attrs["llm"]["token_count"]["completion"] == 123
        assert attrs["llm"]["token_count"]["total"] == 444

        # Full history: 1 user + 17 assistant + 17 tool = 35 input messages.
        input_msgs = attrs["llm"]["input_messages"]
        assert len(input_msgs) == 35
        assert input_msgs[0]["message"]["role"] == "user"
        # Last assistant message (index 33) should be step 17.
        assert input_msgs[33]["message"]["role"] == "assistant"
        assert input_msgs[33]["message"]["tool_calls"][0]["tool_call"]["id"] == "tc-17"
        # Last tool message (index 34) should be the return for tc-17.
        assert input_msgs[34]["message"]["role"] == "tool"
        assert input_msgs[34]["message"]["tool_call_id"] == "tc-17"

    def test_llm_span_with_tool_calls(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)

        tool_calls = [{"id": "tc-1", "name": "search", "arguments": '{"q": "test"}'}]
        finalize_llm_span(llm_span, tool_calls=tool_calls)
        finalize_agent_span(agent_span)

        db_traces = tracer.get_db_traces(project_id=1)
        spans = db_traces[0].spans
        llm_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value)
        attrs = llm_db.attributes
        tc = attrs["llm"]["output_messages"][0]["message"]["tool_calls"][0]["tool_call"]
        assert tc["id"] == "tc-1"
        assert tc["function"]["name"] == "search"
        assert tc["function"]["arguments"] == '{"q": "test"}'

    def test_can_customize_trace_name_suffix(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="Summarize this")])]

        agent_span = create_agent_span(
            tracer,
            input_messages=messages,
            trace_name_suffix="Summary",
        )
        llm_span = create_llm_span(
            tracer,
            parent_span=agent_span,
            input_messages=messages,
            trace_name_suffix="Summary",
        )

        finalize_llm_span(llm_span, output_content="Short summary")
        finalize_agent_span(agent_span, output_content="Short summary")

        spans = tracer.get_db_traces(project_id=1)[0].spans
        agent_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.AGENT.value)
        llm_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value)

        assert agent_db.name == "pxiAgent Summary"
        assert llm_db.name == "pxiCompletion Summary"

    def test_llm_span_with_input_messages_including_tool_calls(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import (
            ModelRequest,
            ModelResponse,
            TextPart,
            ToolCallPart,
            UserPromptPart,
        )

        tracer = _make_tracer(db)
        messages = [
            ModelRequest(parts=[UserPromptPart(content="What is 2+2?")]),
            ModelResponse(
                parts=[
                    TextPart(content="Let me calculate."),
                    ToolCallPart(
                        tool_name="calculator",
                        args=json.dumps({"expr": "2+2"}),
                        tool_call_id="tc-1",
                    ),
                ]
            ),
        ]

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)
        finalize_llm_span(llm_span, output_content="4")
        finalize_agent_span(agent_span, output_content="4")

        db_traces = tracer.get_db_traces(project_id=1)
        spans = db_traces[0].spans
        llm_db = next(s for s in spans if s.span_kind == OpenInferenceSpanKindValues.LLM.value)
        attrs = llm_db.attributes
        input_msgs = attrs["llm"]["input_messages"]

        # User message at index 0.
        assert input_msgs[0]["message"]["role"] == "user"
        # Assistant message at index 1 with tool calls.
        assert input_msgs[1]["message"]["role"] == "assistant"
        assert input_msgs[1]["message"]["content"] == "Let me calculate."
        tc = input_msgs[1]["message"]["tool_calls"][0]["tool_call"]
        assert tc["id"] == "tc-1"
        assert tc["function"]["name"] == "calculator"

    def test_error_propagates_to_both_spans(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)

        error = RuntimeError("API timeout")
        finalize_llm_span(llm_span, error=error)
        finalize_agent_span(agent_span, error=error)

        db_traces = tracer.get_db_traces(project_id=1)
        for db_span in db_traces[0].spans:
            assert db_span.status_code == "ERROR"
            assert db_span.status_message == "API timeout"
            assert any(e["name"] == "exception" for e in db_span.events)


class TestPersistTraces:
    async def _persist_trace(
        self,
        db: DbSessionFactory,
        *,
        project_id: int,
        session_id: str | None = None,
        event_queue: _FakeEventQueue | None = None,
    ) -> list[models.Trace]:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]
        agent_span = create_agent_span(tracer, input_messages=messages, session_id=session_id)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)
        finalize_llm_span(llm_span, output_content="hello!")
        finalize_agent_span(agent_span, output_content="hello!")
        return await persist_traces(
            tracer,
            db=db,
            project_id=project_id,
            session_id=session_id,
            event_queue=event_queue or _FakeEventQueue(),
        )

    @pytest.mark.asyncio
    async def test_persists_traces_to_db(self, db: DbSessionFactory) -> None:
        project_id = await ensure_project_exists(db)
        event_queue = _FakeEventQueue()
        db_traces = await self._persist_trace(db, project_id=project_id, event_queue=event_queue)

        assert len(db_traces) == 1

        # Verify 2 spans in the DB.
        async with db() as session:
            result = await session.execute(
                select(models.Span).where(models.Span.trace_rowid == db_traces[0].id)
            )
            spans = result.scalars().all()
            assert len(spans) == 2
            names = {s.name for s in spans}
            assert names == {"pxiAgent Turn", "pxiCompletion Turn"}

        assert len(event_queue.events) == 1

    @pytest.mark.asyncio
    async def test_creates_session_when_session_id_provided(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        project_id = await ensure_project_exists(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]

        agent_span = create_agent_span(tracer, input_messages=messages, session_id="my-session")
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)
        finalize_llm_span(llm_span, output_content="hello!")
        finalize_agent_span(agent_span, output_content="hello!")

        event_queue = _FakeEventQueue()
        db_traces = await persist_traces(
            tracer,
            db=db,
            project_id=project_id,
            session_id="my-session",
            event_queue=event_queue,
        )

        assert len(db_traces) == 1

        # Verify the session was created and linked.
        async with db() as session:
            project_session = await session.scalar(
                select(models.ProjectSession).filter_by(session_id="my-session")
            )
            assert project_session is not None
            assert project_session.project_id == project_id

            # The trace should be linked to the session.
            trace = await session.get(models.Trace, db_traces[0].id)
            assert trace is not None
            assert trace.project_session_rowid == project_session.id

    @pytest.mark.asyncio
    async def test_reuses_existing_session(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer1 = _make_tracer(db)
        project_id = await ensure_project_exists(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]

        # First trace with session.
        agent1 = create_agent_span(tracer1, input_messages=messages, session_id="s1")
        llm1 = create_llm_span(tracer1, parent_span=agent1, input_messages=messages)
        finalize_llm_span(llm1, output_content="hello!")
        finalize_agent_span(agent1, output_content="hello!")

        event_queue = _FakeEventQueue()
        await persist_traces(
            tracer1, db=db, project_id=project_id, session_id="s1", event_queue=event_queue
        )

        # Second trace with the same session.
        tracer2 = _make_tracer(db)
        agent2 = create_agent_span(tracer2, input_messages=messages, session_id="s1")
        llm2 = create_llm_span(tracer2, parent_span=agent2, input_messages=messages)
        finalize_llm_span(llm2, output_content="world!")
        finalize_agent_span(agent2, output_content="world!")

        await persist_traces(
            tracer2, db=db, project_id=project_id, session_id="s1", event_queue=event_queue
        )

        # Should have exactly one session.
        async with db() as session:
            result = await session.execute(select(models.ProjectSession).filter_by(session_id="s1"))
            sessions = result.scalars().all()
            assert len(sessions) == 1

    @pytest.mark.asyncio
    async def test_no_session_when_session_id_not_provided(self, db: DbSessionFactory) -> None:
        from pydantic_ai.messages import ModelRequest, UserPromptPart

        tracer = _make_tracer(db)
        project_id = await ensure_project_exists(db)
        messages = [ModelRequest(parts=[UserPromptPart(content="hi")])]

        agent_span = create_agent_span(tracer, input_messages=messages)
        llm_span = create_llm_span(tracer, parent_span=agent_span, input_messages=messages)
        finalize_llm_span(llm_span, output_content="hello!")
        finalize_agent_span(agent_span, output_content="hello!")

        event_queue = _FakeEventQueue()
        db_traces = await persist_traces(
            tracer, db=db, project_id=project_id, event_queue=event_queue
        )

        assert len(db_traces) == 1
        # No session should be linked.
        async with db() as session:
            trace = await session.get(models.Trace, db_traces[0].id)
            assert trace is not None
            assert trace.project_session_rowid is None

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_spans(self, db: DbSessionFactory) -> None:
        tracer = _make_tracer(db)
        project_id = await ensure_project_exists(db)
        event_queue = _FakeEventQueue()
        db_traces = await persist_traces(
            tracer, db=db, project_id=project_id, event_queue=event_queue
        )
        assert db_traces == []
        assert len(event_queue.events) == 0

    @pytest.mark.asyncio
    async def test_concurrent_persist_creates_one_session(self, db: DbSessionFactory) -> None:
        if db.dialect.value == "sqlite":
            pytest.skip("SQLite test fixture serializes nested transactions")

        project_id = await ensure_project_exists(db)

        first, second = await asyncio.gather(
            self._persist_trace(db, project_id=project_id, session_id="concurrent-session"),
            self._persist_trace(db, project_id=project_id, session_id="concurrent-session"),
        )

        assert len(first) == 1
        assert len(second) == 1

        async with db() as session:
            sessions = (
                (
                    await session.execute(
                        select(models.ProjectSession).filter_by(session_id="concurrent-session")
                    )
                )
                .scalars()
                .all()
            )
            assert len(sessions) == 1

            traces = (
                (
                    await session.execute(
                        select(models.Trace).where(models.Trace.id.in_([first[0].id, second[0].id]))
                    )
                )
                .scalars()
                .all()
            )
            assert len(traces) == 2
            assert all(trace.project_session_rowid == sessions[0].id for trace in traces)
