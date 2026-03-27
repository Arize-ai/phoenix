# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ATIF trajectory to spans conversion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import pytest

from phoenix.client.helpers.atif._convert import (
    _convert_atif_trajectory_to_spans,
    _md5_span_id,
    _md5_trace_id,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> Dict[str, Any]:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)  # type: ignore[no-any-return]


@pytest.fixture()
def simple_trajectory() -> Dict[str, Any]:
    return _load_fixture("simple_trajectory.json")


@pytest.fixture()
def multi_tool_trajectory() -> Dict[str, Any]:
    return _load_fixture("multi_tool_trajectory.json")


class TestDeterministicIds:
    def test_trace_id_is_32_hex(self) -> None:
        tid = _md5_trace_id("test-seed")
        assert len(tid) == 32
        int(tid, 16)  # should not raise

    def test_span_id_is_16_hex(self) -> None:
        sid = _md5_span_id("test-seed")
        assert len(sid) == 16
        int(sid, 16)  # should not raise

    def test_same_input_same_output(self) -> None:
        assert _md5_trace_id("abc") == _md5_trace_id("abc")
        assert _md5_span_id("abc") == _md5_span_id("abc")

    def test_different_input_different_output(self) -> None:
        assert _md5_trace_id("a") != _md5_trace_id("b")
        assert _md5_span_id("a") != _md5_span_id("b")


class TestSimpleTrajectoryConversion:
    def test_span_count(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        # 1 root AGENT + 1 user CHAIN + 1 agent LLM (with 1 tool call) + 1 TOOL
        # + 1 agent LLM (no tools) = 5 spans
        assert len(spans) == 5

    def test_root_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        assert root["span_kind"] == "AGENT"
        assert root["name"] == "finance-assistant"
        assert "parent_id" not in root
        assert root["status_code"] == "OK"

    def test_all_spans_share_trace_id(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        trace_ids = {s["context"]["trace_id"] for s in spans}
        assert len(trace_ids) == 1

    def test_user_step_becomes_chain(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        user_span = spans[1]
        assert user_span["span_kind"] == "CHAIN"
        assert user_span["name"] == "user_message"
        assert user_span.get("parent_id") == spans[0]["context"]["span_id"]
        attrs = user_span.get("attributes", {})
        assert "What is the current price" in attrs.get("input.value", "")

    def test_agent_step_becomes_llm(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        assert llm_span["span_kind"] == "LLM"
        assert llm_span.get("parent_id") == spans[0]["context"]["span_id"]

    def test_tool_call_becomes_tool_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        tool_span = spans[3]
        assert tool_span["span_kind"] == "TOOL"
        assert tool_span["name"] == "financial_search"
        # Tool is child of the LLM step, not the root
        assert tool_span.get("parent_id") == spans[2]["context"]["span_id"]

    def test_tool_span_has_observation(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        tool_span = spans[3]
        attrs = tool_span.get("attributes", {})
        assert "GOOGL" in attrs.get("output.value", "")

    def test_llm_token_counts(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.token_count.prompt") == 520
        assert attrs.get("llm.token_count.completion") == 80
        assert attrs.get("llm.token_count.total") == 600

    def test_model_name_on_llm_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.model_name") == "gpt-4"

    def test_root_span_has_input_output(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        attrs = root.get("attributes", {})
        assert "GOOGL" in attrs.get("input.value", "")
        assert "185.35" in attrs.get("output.value", "")


class TestMultiToolTrajectoryConversion:
    def test_span_count(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        # 1 root AGENT
        # + 1 user CHAIN (step 1)
        # + 1 agent LLM (step 2) + 3 TOOL spans
        # + 1 system CHAIN (step 3)
        # + 1 agent LLM (step 4) + 1 TOOL span
        # + 1 agent LLM (step 5, no tools)
        # = 10 spans
        assert len(spans) == 10

    def test_parallel_tool_calls(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        tool_spans = [s for s in spans if s["span_kind"] == "TOOL"]
        assert len(tool_spans) == 4
        tool_names = {s["name"] for s in tool_spans}
        assert "financial_search" in tool_names
        assert "news_search" in tool_names
        assert "analyst_estimates" in tool_names

    def test_system_step_becomes_chain(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        system_spans = [s for s in spans if s["name"] == "system_message"]
        assert len(system_spans) == 1
        assert system_spans[0]["span_kind"] == "CHAIN"

    def test_final_metrics_on_root(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        root = spans[0]
        attrs = root.get("attributes", {})
        assert attrs.get("llm.token_count.prompt") == 9150
        assert attrs.get("llm.token_count.completion") == 635

    def test_deterministic_ids_are_stable(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans_a = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        spans_b = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        for a, b in zip(spans_a, spans_b):
            assert a["context"]["span_id"] == b["context"]["span_id"]
            assert a["context"]["trace_id"] == b["context"]["trace_id"]


class TestOptionalFields:
    def test_missing_timestamps_still_converts(self) -> None:
        """Steps without timestamps should still produce valid spans."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "no-timestamps",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "hello"},
                {"step_id": 2, "source": "agent", "message": "hi"},
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 3  # root + user + agent
        # All spans should have start/end times (derived from fallback)
        for span in spans:
            assert span["start_time"]
            assert span["end_time"]
        root = spans[0]
        assert root["end_time"] == spans[-1]["end_time"]

    def test_root_span_covers_children_when_last_step_has_no_timestamp(self) -> None:
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "missing-last-timestamp",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "hello",
                    "timestamp": "2025-01-15T10:00:00Z",
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "hi",
                },
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        root = spans[0]
        agent_step = spans[-1]
        assert root["end_time"] == agent_step["end_time"]

    def test_optional_model_name(self) -> None:
        """Trajectories without agent.model_name should convert."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "no-model",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "hello",
                    "timestamp": "2025-01-15T10:00:00Z",
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "hi",
                    "timestamp": "2025-01-15T10:00:01Z",
                },
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 3
        # LLM span should not have model_name attribute
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert "llm.model_name" not in attrs

    def test_observation_result_without_source_call_id(self) -> None:
        """Observation results can omit source_call_id per the spec."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "no-source-call-id",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "agent",
                    "message": "checking",
                    "timestamp": "2025-01-15T10:00:00Z",
                    "tool_calls": [
                        {
                            "tool_call_id": "tc1",
                            "function_name": "check",
                            "arguments": {},
                        }
                    ],
                    "observation": {"results": [{"content": "result without source_call_id"}]},
                },
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # Tool span should have no output (result has no matching source_call_id)
        tool_span = [s for s in spans if s["span_kind"] == "TOOL"][0]
        attrs = tool_span.get("attributes", {})
        assert "output.value" not in attrs


class TestMessageAttributes:
    def test_llm_input_messages_from_user(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        # First agent step (spans[2]) should have input messages
        # from the preceding user step
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.input_messages.0.message.role") == "user"
        assert "GOOGL" in attrs.get("llm.input_messages.0.message.content", "")

    def test_llm_output_message(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.output_messages.0.message.role") == "assistant"

    def test_tool_calls_in_output_messages(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        key = "llm.output_messages.0.message.tool_calls.0.tool_call.function.name"
        assert attrs.get(key) == "financial_search"

    def test_tool_definitions_are_flattened(self) -> None:
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.5",
            "session_id": "tool-definitions",
            "agent": {
                "name": "agent",
                "version": "1.0",
                "tool_definitions": [
                    {
                        "type": "function",
                        "function": {
                            "name": "lookup",
                            "parameters": {
                                "type": "object",
                                "properties": {"ticker": {"type": "string"}},
                            },
                        },
                    }
                ],
            },
            "steps": [
                {
                    "step_id": 1,
                    "source": "agent",
                    "message": "checking",
                    "timestamp": "2025-01-15T10:00:00Z",
                }
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        llm_span = spans[1]
        attrs = llm_span.get("attributes", {})
        assert "llm.tools" not in attrs
        assert "llm.tools.0.tool.json_schema" in attrs


class TestRealWorldTrajectories:
    """Tests against real spec-conformant ATIF trajectories from Harbor."""

    def test_harbor_failed_trajectory_conversion(self) -> None:
        """Real Harbor ATIF-v1.2 trajectory from a failed Claude Code run.

        These are minimal 2-step trajectories where the agent
        failed to authenticate ("Not logged in").
        """
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.2",
            "session_id": "a232fe2e-4a36-4aaa-a3d0-821ecd662a0f",
            "agent": {
                "name": "claude-code",
                "version": "2.1.75",
                "model_name": "<synthetic>",
                "extra": {"cwds": ["/app"], "git_branches": ["master"]},
            },
            "steps": [
                {
                    "step_id": 1,
                    "timestamp": "2026-03-13T19:46:42.637Z",
                    "source": "user",
                    "message": "Fix the vulnerability in the code.",
                    "extra": {"is_sidechain": False},
                },
                {
                    "step_id": 2,
                    "timestamp": "2026-03-13T19:46:42.657Z",
                    "source": "agent",
                    "model_name": "<synthetic>",
                    "message": "Not logged in",
                    "metrics": {
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "cached_tokens": 0,
                        "extra": {
                            "cache_creation_input_tokens": 0,
                            "cache_read_input_tokens": 0,
                        },
                    },
                    "extra": {"stop_reason": "stop_sequence"},
                },
            ],
            "final_metrics": {
                "total_prompt_tokens": 0,
                "total_completion_tokens": 0,
                "total_cached_tokens": 0,
                "total_steps": 2,
                "extra": {"total_cache_creation_input_tokens": 0},
            },
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)

        # 1 root + 1 user CHAIN + 1 agent LLM = 3 spans
        assert len(spans) == 3
        root = spans[0]
        assert root["name"] == "claude-code"
        assert root["span_kind"] == "AGENT"

        # Agent step with 0 tokens should still have token attributes
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.model_name") == "<synthetic>"
        # 0 tokens — total should not be set
        assert "llm.token_count.total" not in attrs

        # Output should be the error message
        assert attrs.get("output.value") == "Not logged in"
