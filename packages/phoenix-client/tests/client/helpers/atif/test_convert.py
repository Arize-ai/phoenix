# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ATIF trajectory to spans conversion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import pytest

from phoenix.client.helpers.atif._convert import (
    _base_session_id,
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


def _span_kind_counts(spans: List[Any]) -> Dict[str, int]:
    """Count spans by span_kind."""
    counts: Dict[str, int] = {}
    for s in spans:
        k = s["span_kind"]
        counts[k] = counts.get(k, 0) + 1
    return counts


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
    """simple_trajectory.json: 3 steps (1 user, 2 agent) -> 1 turn.
    1 root AGENT + 2 LLM + 1 TOOL = 4 spans.
    """

    def test_span_count(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        assert len(spans) == 4

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

    def test_no_chain_spans(self, simple_trajectory: Dict[str, Any]) -> None:
        """User/system messages are no longer separate CHAIN spans."""
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        kinds = _span_kind_counts(spans)
        assert "CHAIN" not in kinds

    def test_agent_step_becomes_llm(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        assert len(llm_spans) == 2
        # All LLM spans are children of root
        root_id = spans[0]["context"]["span_id"]
        for llm_span in llm_spans:
            assert llm_span.get("parent_id") == root_id

    def test_tool_call_becomes_tool_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        tool_spans = [s for s in spans if s["span_kind"] == "TOOL"]
        assert len(tool_spans) == 1
        assert tool_spans[0]["name"] == "financial_search"
        # Tool is a sibling of the LLM span (both children of the AGENT)
        root_id = spans[0]["context"]["span_id"]
        assert tool_spans[0].get("parent_id") == root_id

    def test_tool_span_has_observation(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        tool_span = [s for s in spans if s["span_kind"] == "TOOL"][0]
        attrs = tool_span.get("attributes", {})
        assert "GOOGL" in attrs.get("output.value", "")

    def test_llm_token_counts(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.token_count.prompt") == 520
        assert attrs.get("llm.token_count.completion") == 80
        assert attrs.get("llm.token_count.total") == 600

    def test_model_name_on_llm_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.model_name") == "gpt-4"

    def test_root_span_has_input_output(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        attrs = root.get("attributes", {})
        # Input is the user message for this turn
        assert "GOOGL" in attrs.get("input.value", "")
        # Output is the last agent message in this turn
        assert "185.35" in attrs.get("output.value", "")

    def test_cost_usd_on_llm_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.cost.total") == 0.00045

    def test_total_cost_usd_on_root_span(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        attrs = root.get("attributes", {})
        assert attrs.get("llm.cost.total") == 0.00078


class TestMultiToolTrajectoryConversion:
    """multi_tool_trajectory.json: 5 steps (1 user, 1 system, 3 agent) -> 1 turn.
    1 root AGENT + 3 LLM + 4 TOOL = 8 spans.
    """

    def test_span_count(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        assert len(spans) == 8

    def test_no_chain_spans(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        kinds = _span_kind_counts(spans)
        assert "CHAIN" not in kinds

    def test_parallel_tool_calls(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        tool_spans = [s for s in spans if s["span_kind"] == "TOOL"]
        assert len(tool_spans) == 4
        tool_names = {s["name"] for s in tool_spans}
        assert "financial_search" in tool_names
        assert "news_search" in tool_names
        assert "analyst_estimates" in tool_names

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

    def test_user_message_appears_as_llm_input(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        """User message should appear as llm.input_messages on the first LLM span."""
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.input_messages.0.message.role") == "user"

    def test_system_message_appears_as_llm_input(
        self, multi_tool_trajectory: Dict[str, Any]
    ) -> None:
        """System message should appear in llm.input_messages on a subsequent LLM span."""
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        # The system step (step 3) precedes agent step 4, so LLM span for step 4
        # should have system in its input messages
        # Find an LLM span that has a system message in its inputs
        found_system = False
        for llm_span in llm_spans:
            attrs = llm_span.get("attributes", {})
            for key, val in attrs.items():
                if key.endswith(".message.role") and val == "system":
                    found_system = True
                    break
        assert found_system, "Expected system message in llm.input_messages on an LLM span"


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
        # 1 root + 1 LLM = 2 spans (no CHAIN for user)
        assert len(spans) == 2
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
        # 1 root + 1 LLM = 2 spans
        assert len(spans) == 2
        llm_span = [s for s in spans if s["span_kind"] == "LLM"][0]
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
        tool_span = [s for s in spans if s["span_kind"] == "TOOL"][0]
        attrs = tool_span.get("attributes", {})
        assert "output.value" not in attrs


class TestMessageAttributes:
    def test_llm_input_messages_from_user(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.input_messages.0.message.role") == "user"
        assert "GOOGL" in attrs.get("llm.input_messages.0.message.content", "")

    def test_llm_output_message(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        assert attrs.get("llm.output_messages.0.message.role") == "assistant"

    def test_tool_calls_in_output_messages(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
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
        llm_span = [s for s in spans if s["span_kind"] == "LLM"][0]
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
        # First LLM span should have input from user step with image parts
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})
        prefix = "llm.input_messages.0"
        assert attrs.get(f"{prefix}.message.role") == "user"
        assert attrs.get(f"{prefix}.message.contents.0.message_content.type") == "text"
        assert (
            attrs.get(f"{prefix}.message.contents.0.message_content.text")
            == "What is in this image?"
        )
        assert attrs.get(f"{prefix}.message.contents.1.message_content.type") == "image"
        image_url = attrs.get(f"{prefix}.message.contents.1.message_content.image.image.url")
        assert image_url is not None
        assert "PNG_transparency_demonstration" in image_url

    def test_multimodal_span_count(self, multimodal_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multimodal_trajectory)
        # 1 root + 2 LLM + 1 TOOL = 4 spans
        assert len(spans) == 4

    def test_multimodal_input_value_uses_serializable_content(
        self, multimodal_trajectory: Dict[str, Any]
    ) -> None:
        """input.value should contain message content, not converter-private fields."""
        spans = _convert_atif_trajectory_to_spans(multimodal_trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        attrs = llm_spans[0].get("attributes", {})

        input_messages = json.loads(attrs["input.value"])
        assert "_raw_parts" not in attrs["input.value"]
        assert input_messages[0]["role"] == "user"
        assert isinstance(input_messages[0]["content"], list)
        assert input_messages[0]["content"][0]["type"] == "text"
        assert input_messages[0]["content"][1]["type"] == "image"

    def test_multimodal_flag_not_set_on_text_only(self, simple_trajectory: Dict[str, Any]) -> None:
        """Text-only messages should not have the multimodal flag."""
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        for span in spans:
            attrs = span.get("attributes", {})
            meta = attrs.get("metadata", {})
            assert "has_multimodal_content" not in meta


class TestParallelToolsMixedResults:
    """Tests for parallel tool calls with success, error, and empty results.
    parallel_tools_mixed_results.json: 3 steps (1 user, 2 agent) -> 1 turn.
    1 root + 2 LLM + 3 TOOL = 6 spans.
    """

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
        # 1 root + 2 LLM + 3 TOOL = 6 spans
        assert len(spans) == 6


class TestSubagentLinking:
    """Tests for cross-trajectory subagent linking."""

    def test_build_subagent_ref_map(self, subagent_fixture: Dict[str, Any]) -> None:
        parent = subagent_fixture["parent"]
        ref_map = _build_subagent_ref_map([parent])
        assert "sess-child-summary-001" in ref_map
        parent_tool_span_id, parent_trace_id = ref_map["sess-child-summary-001"]
        expected_tool_span_id = _sha256_span_id("sess-parent-001:step:2:tool:call_summarize")
        # _build_subagent_ref_map uses the old format: session_id:trace
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


class TestMultiTurnBehavior:
    """Test multi-turn structure: root AGENT -> turn AGENT spans -> LLM/TOOL."""

    @pytest.fixture()
    def multi_turn_trajectory(self) -> Dict[str, Any]:
        return {
            "schema_version": "ATIF-v1.4",
            "session_id": "multi-turn-test",
            "agent": {"name": "assistant", "version": "1.0", "model_name": "gpt-4"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "What is 2+2?",
                    "timestamp": "2025-01-15T10:00:00Z",
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "2+2 is 4.",
                    "timestamp": "2025-01-15T10:00:01Z",
                },
                {
                    "step_id": 3,
                    "source": "user",
                    "message": "And what is 3+3?",
                    "timestamp": "2025-01-15T10:00:02Z",
                },
                {
                    "step_id": 4,
                    "source": "agent",
                    "message": "3+3 is 6.",
                    "timestamp": "2025-01-15T10:00:03Z",
                },
            ],
        }

    def test_span_count(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        # 2 user messages -> 2 turns (multi-turn)
        # 1 root AGENT + 2 turn AGENT + 2 LLM = 5
        assert len(spans) == 5

    def test_root_agent_exists(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        root = spans[0]
        assert root["span_kind"] == "AGENT"
        assert root["name"] == "assistant"
        assert "parent_id" not in root

    def test_turn_agent_spans(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        turn_spans = [s for s in spans if s["name"].startswith("turn_")]
        assert len(turn_spans) == 2
        assert turn_spans[0]["name"] == "turn_1"
        assert turn_spans[1]["name"] == "turn_2"

    def test_turn_spans_are_children_of_root(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        root_id = spans[0]["context"]["span_id"]
        turn_spans = [s for s in spans if s["name"].startswith("turn_")]
        for turn_span in turn_spans:
            assert turn_span.get("parent_id") == root_id
            assert turn_span["span_kind"] == "AGENT"

    def test_llm_spans_are_children_of_turns(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        turn_spans = [s for s in spans if s["name"].startswith("turn_")]
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        assert len(llm_spans) == 2
        # Each LLM span should be a child of its respective turn span
        assert llm_spans[0].get("parent_id") == turn_spans[0]["context"]["span_id"]
        assert llm_spans[1].get("parent_id") == turn_spans[1]["context"]["span_id"]

    def test_turn_input_output(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        turn_spans = [s for s in spans if s["name"].startswith("turn_")]

        # Turn 1: input is first user message, output is first agent reply
        turn1_attrs = turn_spans[0].get("attributes", {})
        assert turn1_attrs.get("input.value") == "What is 2+2?"
        assert turn1_attrs.get("output.value") == "2+2 is 4."

        # Turn 2: input is second user message, output is second agent reply
        turn2_attrs = turn_spans[1].get("attributes", {})
        assert turn2_attrs.get("input.value") == "And what is 3+3?"
        assert turn2_attrs.get("output.value") == "3+3 is 6."

    def test_all_spans_share_trace_id(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        trace_ids = {s["context"]["trace_id"] for s in spans}
        assert len(trace_ids) == 1

    def test_single_turn_skips_turn_agent(self) -> None:
        """When there's only 1 turn, no turn AGENT spans are created."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "single-turn-check",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "hello"},
                {"step_id": 2, "source": "agent", "message": "hi"},
            ],
        }
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 1 root + 1 LLM = 2 (no turn AGENT)
        assert len(spans) == 2
        turn_spans = [s for s in spans if s["name"].startswith("turn_")]
        assert len(turn_spans) == 0
        # LLM parents directly to root
        root_id = spans[0]["context"]["span_id"]
        llm_span = [s for s in spans if s["span_kind"] == "LLM"][0]
        assert llm_span.get("parent_id") == root_id


class TestContinuationMerging:
    """Test that continuation trajectories (session_id ending in -cont-N) share a trace."""

    def test_base_session_id_strips_continuation_suffix(self) -> None:
        assert _base_session_id("abc123") == "abc123"
        assert _base_session_id("abc123-cont-1") == "abc123"
        assert _base_session_id("abc123-cont-2") == "abc123"
        assert _base_session_id("abc123-cont-10") == "abc123"

    def test_base_session_id_preserves_non_continuation(self) -> None:
        assert _base_session_id("my-session-content-1") == "my-session-content-1"
        assert _base_session_id("abc-cont-xyz") == "abc-cont-xyz"
        assert _base_session_id("abc-cont-") == "abc-cont-"

    def test_continuation_shares_trace_id_with_original(self) -> None:
        original = _load_fixture("harbor_terminus2_continuation.json")
        cont1 = _load_fixture("harbor_terminus2_continuation_cont1.json")
        original_spans = _convert_atif_trajectory_to_spans(original)
        cont1_spans = _convert_atif_trajectory_to_spans(cont1)
        assert original_spans[0]["context"]["trace_id"] == cont1_spans[0]["context"]["trace_id"]

    def test_continuation_has_distinct_span_ids(self) -> None:
        original = _load_fixture("harbor_terminus2_continuation.json")
        cont1 = _load_fixture("harbor_terminus2_continuation_cont1.json")
        original_spans = _convert_atif_trajectory_to_spans(original)
        cont1_spans = _convert_atif_trajectory_to_spans(cont1)
        original_ids = {s["context"]["span_id"] for s in original_spans}
        cont1_ids = {s["context"]["span_id"] for s in cont1_spans}
        assert original_ids.isdisjoint(cont1_ids), "Span IDs should not collide"

    def test_continuation_has_distinct_root_span_id(self) -> None:
        original = _load_fixture("harbor_terminus2_continuation.json")
        cont1 = _load_fixture("harbor_terminus2_continuation_cont1.json")
        original_spans = _convert_atif_trajectory_to_spans(original)
        cont1_spans = _convert_atif_trajectory_to_spans(cont1)
        assert original_spans[0]["context"]["span_id"] != cont1_spans[0]["context"]["span_id"]

    def test_non_continuation_gets_own_trace_id(self) -> None:
        """A session_id without -cont-N should not be affected."""
        original = _load_fixture("harbor_terminus2_continuation.json")
        timeout = _load_fixture("harbor_terminus2_timeout.json")
        original_spans = _convert_atif_trajectory_to_spans(original)
        timeout_spans = _convert_atif_trajectory_to_spans(timeout)
        assert original_spans[0]["context"]["trace_id"] != timeout_spans[0]["context"]["trace_id"]

    def test_continuation_root_has_is_continuation_metadata(self) -> None:
        cont1 = _load_fixture("harbor_terminus2_continuation_cont1.json")
        spans = _convert_atif_trajectory_to_spans(cont1)
        root = spans[0]
        attrs = root.get("attributes") or {}
        metadata = attrs.get("metadata", {})
        assert metadata["is_continuation"] is True

    def test_original_root_does_not_have_is_continuation(self) -> None:
        original = _load_fixture("harbor_terminus2_continuation.json")
        spans = _convert_atif_trajectory_to_spans(original)
        root = spans[0]
        attrs = root.get("attributes") or {}
        metadata = attrs.get("metadata", {})
        assert "is_continuation" not in metadata

    def test_continuation_llm_spans_have_copied_context_flag(self) -> None:
        cont1 = _load_fixture("harbor_terminus2_continuation_cont1.json")
        spans = _convert_atif_trajectory_to_spans(cont1)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        # All LLM spans in cont-1 follow is_copied_context steps
        for llm in llm_spans:
            attrs = llm.get("attributes") or {}
            assert attrs.get("metadata", {}).get("has_copied_context") is True

    def test_original_llm_spans_no_copied_context_flag(self) -> None:
        original = _load_fixture("harbor_terminus2_continuation.json")
        spans = _convert_atif_trajectory_to_spans(original)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        for llm in llm_spans:
            attrs = llm.get("attributes") or {}
            assert "has_copied_context" not in attrs.get("metadata", {})


class TestHarborGoldenFiles:
    """Tests against real Harbor golden trajectory files from the harbor-framework/harbor repo."""

    # -- OpenHands v1.5 --

    def test_openhands_converts_without_error(self) -> None:
        trajectory = _load_fixture("harbor_openhands.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 6 steps: 1 system, 1 user, 2 system, 2 agent (with 1 tool call each).
        # Single turn (leading system step + user grouped together).
        # 1 root AGENT + 2 LLM + 2 TOOL = 5
        assert len(spans) == 5
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 1
        assert "CHAIN" not in kinds
        assert kinds["LLM"] == 2
        assert kinds["TOOL"] == 2

    def test_openhands_has_tool_definitions(self) -> None:
        trajectory = _load_fixture("harbor_openhands.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
        assert len(llm_spans) > 0
        attrs = llm_spans[0].get("attributes", {})
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
        # 10 steps (2 user, 1 system, 7 agent, 7 tool calls) -> 2 turns (multi-turn)
        # 1 root AGENT + 2 turn AGENT + 7 LLM + 7 TOOL = 17
        assert len(spans) == 17
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 3
        assert kinds["LLM"] == 7
        assert kinds["TOOL"] == 7
        assert "CHAIN" not in kinds

    def test_terminus2_summarization_subagent_refs_detected(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_summarization.json")
        ref_map = _build_subagent_ref_map([trajectory])
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
                for span in child_spans:
                    assert span["context"]["trace_id"] == parent_trace_id
                assert "parent_id" in child_spans[0]

    # -- Terminus-2: continuation --

    def test_terminus2_continuation_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_continuation.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 5 steps (1 user, 3 agent, 1 system) -> 1 turn -> 1 root + 3 LLM = 4
        assert len(spans) == 4
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 1
        assert "CHAIN" not in kinds

    def test_terminus2_continuation_has_continued_ref(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_continuation.json")
        assert "continued_trajectory_ref" in trajectory

    def test_terminus2_cont1_multi_turn(self) -> None:
        """continuation_cont1 has 3 user messages -> 3 turns (multi-turn)."""
        trajectory = _load_fixture("harbor_terminus2_continuation_cont1.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 8 steps (3 user, 5 agent) -> 3 turns (multi-turn)
        # 1 root AGENT + 3 turn AGENT + 5 LLM = 9
        assert len(spans) == 9
        kinds = _span_kind_counts(spans)
        assert kinds["AGENT"] == 4
        assert kinds["LLM"] == 5
        assert "CHAIN" not in kinds

    # -- Terminus-2: invalid JSON (error recovery, reasoning_content) --

    def test_terminus2_invalid_json_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_invalid_json.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 5 steps (1 user, 4 agent) -> 1 turn -> 1 root + 4 LLM + 3 TOOL = 8
        assert len(spans) == 8
        kinds = _span_kind_counts(spans)
        assert kinds["TOOL"] == 3
        assert "CHAIN" not in kinds

    def test_terminus2_invalid_json_has_reasoning(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_invalid_json.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        llm_spans = [s for s in spans if s["span_kind"] == "LLM"]
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
        # 4 steps (1 user, 3 agent) -> 1 turn -> 1 root + 3 LLM + 3 TOOL = 7
        assert len(spans) == 7
        kinds = _span_kind_counts(spans)
        assert kinds["TOOL"] == 3
        assert "CHAIN" not in kinds

    # -- Subagent child trajectories --

    def test_terminus2_sub_summary_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_summary.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 5 steps (2 user, 3 agent, 2 tool calls) -> 2 turns (multi-turn)
        # 1 root AGENT + 2 turn AGENT + 3 LLM + 2 TOOL = 8
        assert len(spans) == 8

    def test_terminus2_sub_answers_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_answers.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 7 steps (3 user, 4 agent, 2 tool calls) -> 3 turns (multi-turn)
        # 1 root AGENT + 3 turn AGENT + 4 LLM + 2 TOOL = 10
        assert len(spans) == 10

    def test_terminus2_sub_questions_converts(self) -> None:
        trajectory = _load_fixture("harbor_terminus2_sub_questions.json")
        spans = _convert_atif_trajectory_to_spans(trajectory)
        # 2 steps (1 user, 1 agent) -> 1 turn -> 1 root + 1 LLM = 2
        assert len(spans) == 2


class TestRealWorldTrajectories:
    """Tests against real spec-conformant ATIF trajectories from Harbor."""

    def test_harbor_failed_trajectory_conversion(self) -> None:
        """Real Harbor ATIF-v1.2 trajectory from a failed Claude Code run."""
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

        # 1 root + 1 LLM = 2 spans (no CHAIN for user)
        assert len(spans) == 2
        root = spans[0]
        assert root["name"] == "claude-code"
        assert root["span_kind"] == "AGENT"

        llm_span = [s for s in spans if s["span_kind"] == "LLM"][0]
        attrs = llm_span.get("attributes", {})
        assert attrs.get("llm.model_name") == "<synthetic>"
        # 0 tokens - total should not be set
        assert "llm.token_count.total" not in attrs

        # Output should be the error message
        assert attrs.get("output.value") == "Not logged in"
