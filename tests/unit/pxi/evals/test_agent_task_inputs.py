from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from evals.pxi.harness.agent_task import (
    _apply_harness_context_policy,
    _build_contexts,
    _build_run_inputs,
    _materialize_messages,
    _result_usage,
    agent_task_output,
    run_pxi_example,
)


class TestBuildContexts:
    def test_uses_default_project_context_when_contexts_omitted(self) -> None:
        contexts = _build_contexts({"messages": [{"role": "user", "content": "x"}]})
        assert contexts.project is not None
        assert contexts.project.project_node_id == "UHJvamVjdDox"
        assert contexts.project.span_filter == ""
        assert contexts.project.root_spans_only is False

    def test_parses_browser_context_shape(self) -> None:
        contexts = _build_contexts(
            {
                "contexts": [
                    {
                        "type": "app",
                        "currentDateTime": "2026-05-18T14:30:00-07:00",
                        "timeZone": "America/Los_Angeles",
                    },
                    {"type": "graphql", "mutationsEnabled": False},
                    {
                        "type": "project",
                        "projectNodeId": "UHJvamVjdDoxMg==",
                        "spanFilter": "span_kind == 'LLM'",
                        "rootSpansOnly": True,
                    },
                ]
            }
        )
        assert contexts.app is not None
        assert contexts.app.current_date_time == "2026-05-18T14:30:00-07:00"
        assert contexts.app.time_zone == "America/Los_Angeles"
        assert contexts.graphql is not None
        assert contexts.graphql.mutations_enabled is False
        assert contexts.project is not None
        assert contexts.project.project_node_id == "UHJvamVjdDoxMg=="
        assert contexts.project.span_filter == "span_kind == 'LLM'"
        assert contexts.project.root_spans_only is True

    def test_rejects_non_list_contexts(self) -> None:
        with pytest.raises(ValueError, match="input.contexts must be a list"):
            _build_contexts({"contexts": {"type": "project"}})


class TestBuildRunInputs:
    def test_user_only_messages_becomes_user_prompt_with_no_history(self) -> None:
        user_prompt, history = _build_run_inputs(
            {"messages": [{"role": "user", "content": "Show me the latest traces."}]}
        )
        assert user_prompt == "Show me the latest traces."
        assert history is None

    def test_user_terminated_history_pops_last_as_user_prompt(self) -> None:
        user_prompt, history = _build_run_inputs(
            {
                "messages": [
                    {"role": "user", "content": "Show me the latest traces."},
                    {"role": "assistant", "content": "They were on April 3."},
                    {"role": "user", "content": "Filter to that day."},
                ]
            }
        )
        assert user_prompt == "Filter to that day."
        assert history is not None
        assert len(history) == 2
        first, second = history
        assert isinstance(first, ModelRequest)
        assert isinstance(first.parts[0], UserPromptPart)
        assert first.parts[0].content == "Show me the latest traces."
        assert isinstance(second, ModelResponse)
        assert isinstance(second.parts[0], TextPart)
        assert second.parts[0].content == "They were on April 3."

    def test_tool_terminated_history_is_mid_loop_continuation(self) -> None:
        user_prompt, history = _build_run_inputs(
            {
                "messages": [
                    {"role": "user", "content": "When were the latest traces?"},
                    {
                        "role": "assistant",
                        "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "ls"}}],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": "t1",
                        "name": "bash",
                        "content": "a.json\nb.json",
                    },
                ]
            }
        )
        # Mid-loop continuation: user_prompt is None, full history is replayed.
        assert user_prompt is None
        assert history is not None
        assert len(history) == 3
        last = history[-1]
        assert isinstance(last, ModelRequest)
        return_part = last.parts[0]
        assert isinstance(return_part, ToolReturnPart)
        assert return_part.tool_call_id == "t1"
        assert return_part.content == "a.json\nb.json"

    def test_rejects_assistant_terminated_messages(self) -> None:
        with pytest.raises(ValueError, match="user turn .* or a tool return"):
            _build_run_inputs(
                {
                    "messages": [
                        {"role": "user", "content": "hi"},
                        {"role": "assistant", "content": "hello"},
                    ]
                }
            )

    def test_rejects_empty_messages(self) -> None:
        with pytest.raises(ValueError, match="must be a non-empty list"):
            _build_run_inputs({"messages": []})

    def test_rejects_final_user_turn_with_empty_content(self) -> None:
        with pytest.raises(ValueError, match="non-empty string content"):
            _build_run_inputs({"messages": [{"role": "user", "content": ""}]})

    def test_harness_context_policy_preflights_primed_user_history(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _, history = _build_run_inputs(
            {
                "messages": [
                    {
                        "role": "assistant",
                        "tool_calls": [
                            {"id": "t1", "name": "bash", "args": {"command": "cat large"}}
                        ],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": "t1",
                        "name": "bash",
                        "content": "large output " * 100,
                    },
                    {"role": "user", "content": "Remember cohort token cohort-user-text."},
                    {"role": "user", "content": "Filter to the remembered cohort."},
                ]
            }
        )
        assert history is not None
        monkeypatch.setenv(
            "PHOENIX_AGENTS_ASSISTANT_CONTEXT_POLICY",
            "p2:threshold=0,trailing_tokens=2000,max_summary_tokens=100",
        )

        transformed = _apply_harness_context_policy(history)

        assert transformed is not None
        assert all(
            not any(isinstance(part, ToolReturnPart) for part in message.parts)
            for message in transformed
            if isinstance(message, ModelRequest)
        )


class TestMaterializeMessages:
    def test_builds_primed_bash_tool_call_and_return(self) -> None:
        history = _materialize_messages(
            [
                {"role": "user", "content": "When were the latest traces?"},
                {
                    "role": "assistant",
                    "tool_calls": [
                        {"id": "t1", "name": "bash", "args": {"command": "ls /phoenix"}}
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": "t1",
                    "name": "bash",
                    "content": "agent-start.md\npage-context.json\n",
                },
            ]
        )
        assert len(history) == 3
        user_turn, assistant_call_turn, tool_turn = history
        assert isinstance(user_turn, ModelRequest)
        assert isinstance(user_turn.parts[0], UserPromptPart)
        assert isinstance(assistant_call_turn, ModelResponse)
        call_part = assistant_call_turn.parts[0]
        assert isinstance(call_part, ToolCallPart)
        assert call_part.tool_name == "bash"
        assert call_part.tool_call_id == "t1"
        assert call_part.args == {"command": "ls /phoenix"}
        assert isinstance(tool_turn, ModelRequest)
        return_part = tool_turn.parts[0]
        assert isinstance(return_part, ToolReturnPart)
        assert return_part.tool_call_id == "t1"

    def test_assistant_turn_may_include_text_and_tool_calls(self) -> None:
        history = _materialize_messages(
            [
                {
                    "role": "assistant",
                    "content": "Let me check the recent traces.",
                    "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "ls"}}],
                },
                {
                    "role": "tool",
                    "tool_call_id": "t1",
                    "name": "bash",
                    "content": "a.json",
                },
            ]
        )
        assistant_turn = history[0]
        assert isinstance(assistant_turn, ModelResponse)
        kinds = [type(part).__name__ for part in assistant_turn.parts]
        assert kinds == ["TextPart", "ToolCallPart"]

    def test_rejects_tool_return_with_unknown_tool_call_id(self) -> None:
        with pytest.raises(ValueError, match="unknown tool_call_id"):
            _materialize_messages(
                [{"role": "tool", "tool_call_id": "ghost", "name": "bash", "content": "x"}]
            )

    def test_rejects_tool_return_name_mismatch(self) -> None:
        with pytest.raises(ValueError, match="does not match prior tool call name"):
            _materialize_messages(
                [
                    {
                        "role": "assistant",
                        "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "ls"}}],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": "t1",
                        "name": "search_phoenix",
                        "content": "x",
                    },
                ]
            )

    def test_rejects_assistant_tool_call_without_matching_return(self) -> None:
        with pytest.raises(ValueError, match="without matching tool returns"):
            _materialize_messages(
                [
                    {
                        "role": "assistant",
                        "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "ls"}}],
                    }
                ]
            )

    def test_rejects_duplicate_tool_call_ids(self) -> None:
        with pytest.raises(ValueError, match="was already used earlier"):
            _materialize_messages(
                [
                    {
                        "role": "assistant",
                        "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "ls"}}],
                    },
                    {
                        "role": "tool",
                        "tool_call_id": "t1",
                        "name": "bash",
                        "content": "out",
                    },
                    {
                        "role": "assistant",
                        "tool_calls": [{"id": "t1", "name": "bash", "args": {"command": "pwd"}}],
                    },
                ]
            )

    def test_rejects_assistant_turn_with_neither_content_nor_tool_calls(self) -> None:
        with pytest.raises(ValueError, match="must have content or tool_calls"):
            _materialize_messages([{"role": "assistant"}])

    def test_rejects_unknown_roles(self) -> None:
        with pytest.raises(ValueError, match="role must be user, assistant, or tool"):
            _materialize_messages([{"role": "system", "content": "x"}])


class _FakeResult:
    output = "fallback assistant text"

    def __init__(self) -> None:
        self._messages = [
            {
                "parts": [
                    {
                        "part_kind": "text",
                        "content": "assistant text from message",
                    }
                ]
            }
        ]

    def new_messages_json(self) -> str:
        return json.dumps(self._messages)


class TestAgentTaskOutput:
    def test_result_usage_supports_property_and_method_shapes(self) -> None:
        property_usage = SimpleNamespace(input_tokens=1)
        method_usage = SimpleNamespace(input_tokens=2)

        assert _result_usage(SimpleNamespace(usage=property_usage)) is property_usage  # type: ignore[arg-type]
        assert _result_usage(SimpleNamespace(usage=lambda: method_usage)) is method_usage  # type: ignore[arg-type]

    def test_includes_usage_and_latency(self) -> None:
        output = agent_task_output(
            _FakeResult(),  # type: ignore[arg-type]
            usage=SimpleNamespace(
                input_tokens=11,
                output_tokens=7,
                cache_read_tokens=5,
                cache_write_tokens=3,
            ),
            latency_ms=1234,
        )

        assert output["assistant_text"] == "assistant text from message"
        assert output["usage"] == {
            "input_tokens": 11,
            "output_tokens": 7,
            "cache_read_tokens": 5,
            "cache_write_tokens": 3,
        }
        assert output["latency_ms"] == 1234

    @pytest.mark.asyncio
    async def test_error_path_includes_zero_usage_and_latency(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async def fail_build_model() -> object:
            raise RuntimeError("missing key")

        monkeypatch.setattr("evals.pxi.harness.agent_task._build_model", fail_build_model)

        output = await run_pxi_example({"messages": [{"role": "user", "content": "hi"}]})

        assert output["error"] == "RuntimeError: missing key"
        assert output["usage"] == {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        }
        assert output["latency_ms"] == 0
