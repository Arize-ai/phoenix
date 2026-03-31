# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ATIF trajectory to spans conversion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import pytest

from phoenix.client.helpers.atif._convert import (
    _build_subagent_ref_map,
    _convert_atif_trajectory_to_spans,
    _has_multimodal_content,
    _sha256_span_id,
    _sha256_trace_id,
    _stringify_message,
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


@pytest.fixture()
def multimodal_trajectory() -> Dict[str, Any]:
    return _load_fixture("multimodal_trajectory.json")


@pytest.fixture()
def parallel_mixed_trajectory() -> Dict[str, Any]:
    return _load_fixture("parallel_tools_mixed_results.json")


@pytest.fixture()
def subagent_fixture() -> Dict[str, Any]:
    return _load_fixture("subagent_trajectories.json")


class TestDeterministicIds:
    def test_trace_id_is_32_hex(self) -> None:
        tid = _sha256_trace_id("test-seed")
        assert len(tid) == 32
        int(tid, 16)  # should not raise

    def test_span_id_is_16_hex(self) -> None:
        sid = _sha256_span_id("test-seed")
        assert len(sid) == 16
        int(sid, 16)  # should not raise

    def test_same_input_same_output(self) -> None:
        assert _sha256_trace_id("abc") == _sha256_trace_id("abc")
        assert _sha256_span_id("abc") == _sha256_span_id("abc")

    def test_different_input_different_output(self) -> None:
        assert _sha256_trace_id("a") != _sha256_trace_id("b")
        assert _sha256_span_id("a") != _sha256_span_id("b")


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

    def test_cost_usd_on_llm_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.cost.total") == 0.00045

    def test_total_cost_usd_on_root_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        attrs = root.get("attributes", {})
        assert attrs.get("llm.cost.total") == 0.00078


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


class TestMultimodalContent:
    """Tests for multimodal (v1.6+) content part handling."""

    def test_stringify_message_with_image_parts(self) -> None:
        message: List[Any] = [
            {"type": "text", "text": "What is in this image?"},
            {
                "type": "image",
                "source": {"media_type": "image/png", "path": "images/screenshot.png"},
            },
        ]
        result = _stringify_message(message)
        assert "What is in this image?" in result
        assert "[image: images/screenshot.png]" in result

    def test_has_multimodal_content_with_image(self) -> None:
        message: List[Any] = [
            {"type": "text", "text": "hello"},
            {"type": "image", "source": {"path": "img.png"}},
        ]
        assert _has_multimodal_content(message) is True

    def test_has_multimodal_content_text_only_list(self) -> None:
        message: List[Any] = [
            {"type": "text", "text": "hello"},
            {"type": "text", "text": "world"},
        ]
        assert _has_multimodal_content(message) is False

    def test_has_multimodal_content_plain_string(self) -> None:
        assert _has_multimodal_content("hello") is False

    def test_has_multimodal_content_none(self) -> None:
        assert _has_multimodal_content(None) is False

    def test_multimodal_input_uses_message_contents(
        self, multimodal_trajectory: Dict[str, Any]
    ) -> None:
        """User message with image parts should produce message.contents attributes."""
        spans = _convert_atif_trajectory_to_spans(multimodal_trajectory)
        # spans[2] is the first LLM span (step 2), which should have input from step 1 (user)
        llm_span = spans[2]
        attrs = llm_span.get("attributes", {})
        # Should have content parts, not plain message.content
        prefix = "llm.input_messages.0"
        assert attrs.get(f"{prefix}.message.role") == "user"
        assert attrs.get(f"{prefix}.message.contents.0.message_content.type") == "text"
        assert (
            attrs.get(f"{prefix}.message.contents.0.message_content.text")
            == "What is in this image?"
        )
        assert attrs.get(f"{prefix}.message.contents.1.message_content.type") == "image"
        assert (
            attrs.get(f"{prefix}.message.contents.1.message_content.image.image.url")
            == "images/screenshot.png"
        )

    def test_multimodal_span_count(self, multimodal_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multimodal_trajectory)
        # 1 root + 1 user CHAIN + 1 agent LLM + 1 TOOL + 1 agent LLM = 5
        assert len(spans) == 5

    def test_multimodal_flag_not_set_on_text_only(self, simple_trajectory: Dict[str, Any]) -> None:
        """Text-only messages should not have the multimodal flag."""
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        for span in spans:
            attrs = span.get("attributes", {})
            meta = attrs.get("metadata", {})
            assert "has_multimodal_content" not in meta


class TestParallelToolsMixedResults:
    """Tests for parallel tool calls with success, error, and empty results."""

    def test_all_three_tool_spans_created(self, parallel_mixed_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        tool_spans = [s for s in spans if s["span_kind"] == "TOOL"]
        assert len(tool_spans) == 3
        names = {s["name"] for s in tool_spans}
        assert names == {"get_weather", "get_stock", "get_news"}

    def test_successful_tool_has_output(self, parallel_mixed_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        weather_span = [s for s in spans if s["name"] == "get_weather"][0]
        attrs = weather_span.get("attributes", {})
        assert "42°F" in attrs.get("output.value", "")

    def test_error_tool_has_error_string_as_output(
        self, parallel_mixed_trajectory: Dict[str, Any]
    ) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        stock_span = [s for s in spans if s["name"] == "get_stock"][0]
        attrs = stock_span.get("attributes", {})
        assert "rate limit" in attrs.get("output.value", "").lower()

    def test_empty_tool_has_no_output(self, parallel_mixed_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        news_span = [s for s in spans if s["name"] == "get_news"][0]
        attrs = news_span.get("attributes", {})
        assert "output.value" not in attrs

    def test_span_count(self, parallel_mixed_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        # 1 root + 1 user CHAIN + 1 agent LLM + 3 TOOL + 1 agent LLM = 7
        assert len(spans) == 7


class TestSubagentLinking:
    """Tests for cross-trajectory subagent linking."""

    def test_build_subagent_ref_map(self, subagent_fixture: Dict[str, Any]) -> None:
        parent = subagent_fixture["parent"]
        ref_map = _build_subagent_ref_map([parent])
        assert "sess-child-summary-001" in ref_map
        parent_tool_span_id, parent_trace_id = ref_map["sess-child-summary-001"]
        # Should match the deterministic ID for the parent's tool span
        expected_tool_span_id = _sha256_span_id("sess-parent-001:step:2:tool:call_summarize")
        expected_trace_id = _sha256_trace_id("sess-parent-001:trace")
        assert parent_tool_span_id == expected_tool_span_id
        assert parent_trace_id == expected_trace_id

    def test_child_uses_parent_trace_id(self, subagent_fixture: Dict[str, Any]) -> None:
        parent = subagent_fixture["parent"]
        child = subagent_fixture["child"]
        ref_map = _build_subagent_ref_map([parent, child])
        parent_ctx = ref_map.get(child["session_id"])
        assert parent_ctx is not None
        child_spans = _convert_atif_trajectory_to_spans(child, parent_span_context=parent_ctx)
        parent_trace_id = _sha256_trace_id("sess-parent-001:trace")
        for span in child_spans:
            assert span["context"]["trace_id"] == parent_trace_id

    def test_child_root_has_parent_id(self, subagent_fixture: Dict[str, Any]) -> None:
        parent = subagent_fixture["parent"]
        child = subagent_fixture["child"]
        ref_map = _build_subagent_ref_map([parent, child])
        parent_ctx = ref_map.get(child["session_id"])
        assert parent_ctx is not None
        child_spans = _convert_atif_trajectory_to_spans(child, parent_span_context=parent_ctx)
        child_root = child_spans[0]
        expected_parent_tool_id = _sha256_span_id("sess-parent-001:step:2:tool:call_summarize")
        assert child_root.get("parent_id") == expected_parent_tool_id

    def test_independent_trajectories_get_own_trace_ids(self) -> None:
        """Multiple trajectories without subagent refs should each get their own trace_id."""
        traj_a: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "independent-a",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "hello"},
                {"step_id": 2, "source": "agent", "message": "hi"},
            ],
        }
        traj_b: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "independent-b",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "hey"},
                {"step_id": 2, "source": "agent", "message": "yo"},
            ],
        }
        ref_map = _build_subagent_ref_map([traj_a, traj_b])
        assert len(ref_map) == 0
        spans_a = _convert_atif_trajectory_to_spans(traj_a)
        spans_b = _convert_atif_trajectory_to_spans(traj_b)
        trace_a = spans_a[0]["context"]["trace_id"]
        trace_b = spans_b[0]["context"]["trace_id"]
        assert trace_a != trace_b

    def test_unlinked_trajectory_has_no_parent_id_on_root(self) -> None:
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "no-parent",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "hello"},
                {"step_id": 2, "source": "agent", "message": "hi"},
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        root = spans[0]
        assert "parent_id" not in root


class TestSystemStepWithObservation:
    """Tests for system steps that have observations but no tool_calls."""

    def test_system_step_observation_converts_without_error(self) -> None:
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "sys-obs",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "system",
                    "message": "Context injection.",
                    "observation": {
                        "results": [{"content": "Injected context data"}],
                    },
                },
                {"step_id": 2, "source": "agent", "message": "Got it."},
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 1 root + 1 system CHAIN + 1 agent LLM = 3
        assert len(spans) == 3
        system_span = spans[1]
        assert system_span["span_kind"] == "CHAIN"
        assert system_span["name"] == "system_message"


class TestHarborGoldenFiles:
    """Tests against real Harbor golden trajectory files from the harbor-framework/harbor repo."""

    # -- OpenHands v1.5 --

    def test_openhands_converts_without_error(self) -> None:
        trajectory = _load_fixture("harbor_openhands.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 6 steps: 3 system, 1 user → CHAIN; 2 agent → LLM; 2 tool calls → TOOL
        assert len(spans) == 9
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 1
        assert kinds["CHAIN"] == 4
        assert kinds["LLM"] == 2
        assert kinds["TOOL"] == 2

    def test_openhands_has_tool_definitions(self) -> None:
        trajectory = _load_fixture("harbor_openhands.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        assert len(llm_spans) > 0
        attrs = llm_spans[0].get("attributes", {})
        # Should have flattened tool definitions from agent.tool_definitions
        tool_def_keys = [k for k in attrs if k.startswith("llm.tools.")]
        assert len(tool_def_keys) > 0

    def test_openhands_root_is_agent(self) -> None:
        trajectory = _load_fixture("harbor_openhands.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        root = spans[0]
        assert root["span_kind"] == "AGENT"
        assert root["name"] == "openhands"
        assert "parent_id" not in root

    # -- Terminus-2: summarization (10 steps, subagent refs) --

    def test_terminus2_summarization_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_summarization.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 18
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 1
        assert kinds["LLM"] == 7
        assert kinds["TOOL"] == 7
        assert kinds["CHAIN"] == 3

    def test_terminus2_summarization_subagent_refs_detected(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_summarization.json")
        ref_map = _build_subagent_ref_map([trajectory])
        # Should detect child session IDs from subagent_trajectory_ref
        assert len(ref_map) > 0

    def test_terminus2_summarization_batch_links_subagents(self) -> None:
        """Batch convert parent + 3 subagent trajectories; children should link."""
        parent = _load_fixture("harbor_terminus2_summarization.json")
        children = [
            _load_fixture("harbor_terminus2_sub_summary.json"),
            _load_fixture("harbor_terminus2_sub_answers.json"),
            _load_fixture("harbor_terminus2_sub_questions.json"),
        ]
        all_trajs = [parent] + children
        ref_map = _build_subagent_ref_map(all_trajs)

        parent_trace_id = _sha256_trace_id(f"{parent['session_id']}:trace")
        for child in children:
            child_sid = child["session_id"]
            if child_sid in ref_map:
                ctx = ref_map[child_sid]
                child_spans = _convert_atif_trajectory_to_spans(child, parent_span_context=ctx)
                # All child spans should use parent's trace_id
                for span in child_spans:
                    assert span["context"]["trace_id"] == parent_trace_id
                # Child root should have parent_id
                assert "parent_id" in child_spans[0]

    # -- Terminus-2: continuation (continued_trajectory_ref + is_copied_context) --

    def test_terminus2_continuation_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_continuation.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 6
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 1

    def test_terminus2_continuation_has_continued_ref(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_continuation.json")
        assert "continued_trajectory_ref" in trajectory

    def test_terminus2_cont1_is_copied_context_flagged(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_continuation_cont1.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        chain_spans = [s for s in spans if s["span_kind"] == "CHAIN"]
        # Some CHAIN spans should have is_copied_context metadata
        flagged = [
            s
            for s in chain_spans
            if s.get("attributes", {}).get("metadata", {}).get("is_copied_context")
        ]
        assert len(flagged) > 0

    # -- Terminus-2: invalid JSON (error recovery, reasoning_content) --

    def test_terminus2_invalid_json_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_invalid_json.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 9
        kinds = _span_kind_counts(spans)
        assert kinds["TOOL"] == 3

    def test_terminus2_invalid_json_has_reasoning(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_invalid_json.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        # At least some LLM spans should have reasoning_content in metadata
        reasoning_spans = [
            s
            for s in llm_spans
            if s.get("attributes", {}).get("metadata", {}).get("reasoning_content")
        ]
        assert len(reasoning_spans) > 0

    # -- Terminus-2: timeout --

    def test_terminus2_timeout_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_timeout.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 8
        kinds = _span_kind_counts(spans)
        assert kinds["TOOL"] == 3

    # -- Subagent child trajectories --

    def test_terminus2_sub_summary_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_summary.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 8

    def test_terminus2_sub_answers_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_answers.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 10

    def test_terminus2_sub_questions_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_questions.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        assert len(spans) == 3


def _span_kind_counts(spans: List[Any]) -> Dict[str, int]:
    """Count spans by span_kind."""
    counts: Dict[str, int] = {}
    for s in spans:
        k = s["span_kind"]
        counts[k] = counts.get(k, 0) + 1
    return counts


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
