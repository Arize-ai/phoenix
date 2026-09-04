# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ATIF trajectory to span conversion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import pytest

from phoenix.client.helpers.atif import _convert_atif_trajectories_to_spans
from phoenix.client.helpers.atif._convert import (
    _base_session_id,
    _convert_atif_trajectory_to_spans,
    _document_hash,
    _has_multimodal_content,
    _sha256_span_id,
    _sha256_trace_id,
    _stringify_message,
)
from phoenix.client.helpers.atif._reparent import _reparent_spans_under_common_parent

FIXTURES_DIR = Path(__file__).parent / "fixtures"
PARENT_TRACE_ID = "0123456789abcdef0123456789abcdef"
PARENT_SPAN_ID = "0123456789abcdef"


def _load_fixture(name: str) -> Dict[str, Any]:
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


def _span_kind_counts(spans: Sequence[Any]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for span in spans:
        counts[span["span_kind"]] = counts.get(span["span_kind"], 0) + 1
    return counts


def of_kind(spans: Sequence[Any], kind: str) -> List[Any]:
    return [span for span in spans if span["span_kind"] == kind]


def named(spans: Sequence[Any], name: str) -> Any:
    return next(span for span in spans if span["name"] == name)


def attrs(span: Any) -> Dict[str, Any]:
    return dict(span.get("attributes", {}))


def metadata(span: Any) -> Dict[str, Any]:
    return dict(attrs(span).get("metadata", {}))


def assert_parents_resolve(spans: Sequence[Any]) -> None:
    span_ids = {span["context"]["span_id"] for span in spans}
    unresolved = [
        (span["name"], span["parent_id"])
        for span in spans
        if "parent_id" in span and span["parent_id"] not in span_ids
    ]
    assert not unresolved, unresolved


def group(
    trajectories: Sequence[Any],
    *,
    trace_id: str = PARENT_TRACE_ID,
    span_id: str = PARENT_SPAN_ID,
) -> List[Any]:
    """Convert trajectories, then hang them beneath a caller-owned span."""
    return _reparent_spans_under_common_parent(
        _convert_atif_trajectories_to_spans(trajectories),
        parent_id=span_id,
        trace_id=trace_id,
    )


def trajectory(
    steps: List[Dict[str, Any]],
    *,
    session_id: Optional[str] = "run",
    trajectory_id: Optional[str] = "document",
    schema_version: str = "ATIF-v1.7",
    agent_name: str = "worker",
    **extra: Any,
) -> Dict[str, Any]:
    """Build a minimal trajectory around ``steps``."""
    document: Dict[str, Any] = {
        "schema_version": schema_version,
        "agent": {"name": agent_name, "version": "1.0"},
        "steps": steps,
        **extra,
    }
    if session_id is not None:
        document["session_id"] = session_id
    if trajectory_id is not None:
        document["trajectory_id"] = trajectory_id
    return document


def user_then_agent(agent_message: str = "done", **agent_fields: Any) -> List[Dict[str, Any]]:
    return [
        {"step_id": 1, "source": "user", "message": "go"},
        {"step_id": 2, "source": "agent", "message": agent_message, **agent_fields},
    ]


def tool_call(call_id: str, name: str = "bash") -> Dict[str, Any]:
    return {"tool_call_id": call_id, "function_name": name, "arguments": {}}


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


@pytest.fixture()
def v17_embedded_subagents() -> Dict[str, Any]:
    return _load_fixture("v17_embedded_subagents.json")


class TestDeterministicIds:
    def test_ids_are_hex_and_seed_determined(self) -> None:
        trace_id, span_id = _sha256_trace_id("seed"), _sha256_span_id("seed")
        assert (len(trace_id), len(span_id)) == (32, 16)
        int(trace_id, 16)
        int(span_id, 16)
        assert _sha256_trace_id("seed") == trace_id
        assert _sha256_span_id("seed") == span_id
        assert _sha256_trace_id("other") != trace_id
        assert _sha256_span_id("other") != span_id

    def test_conversion_ids_survive_missing_timestamps(
        self, simple_trajectory: Dict[str, Any]
    ) -> None:
        without_timestamps = {
            **simple_trajectory,
            "steps": [
                {key: value for key, value in step.items() if key != "timestamp"}
                for step in simple_trajectory["steps"]
            ],
        }
        first = _convert_atif_trajectories_to_spans([without_timestamps])
        second = _convert_atif_trajectories_to_spans([without_timestamps])
        assert [span["context"] for span in first] == [span["context"] for span in second]

    def test_pre_v17_shared_session_collision_is_avoided_by_trajectory_ids(self) -> None:
        def document(agent_name: str, message: str) -> Dict[str, Any]:
            return trajectory(
                user_then_agent(message),
                session_id="shared-run",
                trajectory_id=None,
                schema_version="ATIF-v1.6",
                agent_name=agent_name,
            )

        a, b = document("agent-a", "first"), document("agent-b", "second")
        colliding = [s["context"]["span_id"] for s in _convert_atif_trajectories_to_spans([a, b])]
        assert len(set(colliding)) < len(colliding)

        distinct = [
            s["context"]["span_id"]
            for s in _convert_atif_trajectories_to_spans(
                [{**a, "trajectory_id": "a"}, {**b, "trajectory_id": "b"}]
            )
        ]
        assert len(set(distinct)) == len(distinct)

    def test_does_not_mutate_caller_input(self, simple_trajectory: Dict[str, Any]) -> None:
        original = json.loads(json.dumps(simple_trajectory))
        _convert_atif_trajectories_to_spans([simple_trajectory])
        assert simple_trajectory == original


class TestConvertThenReparent:
    """Conversion and reparenting composed over real ATIF fixtures."""

    def test_top_level_roots_use_caller_parent(
        self,
        simple_trajectory: Dict[str, Any],
        multi_tool_trajectory: Dict[str, Any],
    ) -> None:
        spans = group([simple_trajectory, multi_tool_trajectory])

        roots = [span for span in spans if span["parent_id"] == PARENT_SPAN_ID]
        assert {span["name"] for span in roots} == {
            "finance-assistant",
            "research-analyst",
        }
        assert {span["context"]["trace_id"] for span in spans} == {PARENT_TRACE_ID}

    @pytest.mark.parametrize("embedded", [True, False], ids=["embedded-v17", "cross-document"])
    def test_subagent_relationship_precedes_caller_parent(
        self,
        embedded: bool,
        v17_embedded_subagents: Dict[str, Any],
        subagent_fixture: Dict[str, Any],
    ) -> None:
        if embedded:
            spans = group([v17_embedded_subagents])
            child, tool = "researcher", "delegate_research"
        else:
            spans = group([subagent_fixture["parent"], subagent_fixture["child"]])
            child, tool = "summarizer", "delegate_summary"

        assert named(spans, "orchestrator")["parent_id"] == PARENT_SPAN_ID
        assert named(spans, child)["parent_id"] == named(spans, tool)["context"]["span_id"]
        assert named(spans, child)["context"]["trace_id"] == PARENT_TRACE_ID

    def test_reparenting_preserves_span_ids_and_tree_shape(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        converted = _convert_atif_trajectories_to_spans([v17_embedded_subagents])
        grouped = _reparent_spans_under_common_parent(
            converted, parent_id=PARENT_SPAN_ID, trace_id=PARENT_TRACE_ID
        )

        def shape(spans: Sequence[Any]) -> set[tuple[str, str]]:
            names = {span["context"]["span_id"]: span["name"] for span in spans}
            return {
                (names[span["context"]["span_id"]], names.get(span.get("parent_id", ""), "<root>"))
                for span in spans
            }

        assert [s["context"]["span_id"] for s in grouped] == [
            s["context"]["span_id"] for s in converted
        ]
        assert shape(grouped) == shape(converted)


class TestSimpleTrajectory:
    """simple_trajectory.json: one user request, an agent tool step, an agent reply."""

    def test_span_tree(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        root = spans[0]
        chains = of_kind(spans, "CHAIN")
        llms = of_kind(spans, "LLM")
        tools = of_kind(spans, "TOOL")

        assert (root["span_kind"], root["name"], root["status_code"]) == (
            "AGENT",
            "finance-assistant",
            "OK",
        )
        assert "parent_id" not in root
        assert len({s["context"]["trace_id"] for s in spans}) == 1
        assert [c["name"] for c in chains] == ["iteration 1", "iteration 2"]
        assert all(c["parent_id"] == root["context"]["span_id"] for c in chains)
        assert [llm["name"] for llm in llms] == ["gpt-4", "gpt-4"]
        assert [llm["parent_id"] for llm in llms] == [c["context"]["span_id"] for c in chains]
        assert [tool["name"] for tool in tools] == ["financial_search"]
        assert tools[0]["parent_id"] == chains[0]["context"]["span_id"]
        assert "GOOGL" in attrs(tools[0])["output.value"]

    def test_root_carries_request_reply_and_final_metrics(
        self, simple_trajectory: Dict[str, Any]
    ) -> None:
        root = _convert_atif_trajectory_to_spans(simple_trajectory)[0]
        assert "GOOGL" in attrs(root)["input.value"]
        assert "185.35" in attrs(root)["output.value"]
        assert metadata(root)["final_metrics"] == simple_trajectory["final_metrics"]
        assert not [key for key in attrs(root) if key.startswith("llm.")]

    def test_llm_attributes(self, simple_trajectory: Dict[str, Any]) -> None:
        llm = of_kind(_convert_atif_trajectory_to_spans(simple_trajectory), "LLM")[0]
        a = attrs(llm)
        assert a["llm.model_name"] == "gpt-4"
        assert (a["llm.token_count.prompt"], a["llm.token_count.completion"]) == (520, 80)
        assert a["llm.token_count.total"] == 600
        assert a["llm.cost.total"] == 0.00045
        assert a["llm.input_messages.0.message.role"] == "user"
        assert "GOOGL" in a["llm.input_messages.0.message.content"]
        assert a["llm.output_messages.0.message.role"] == "assistant"
        assert (
            a["llm.output_messages.0.message.tool_calls.0.tool_call.function.name"]
            == "financial_search"
        )

    def test_agent_steps_carry_input_and_output(self, simple_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        first, second = of_kind(spans, "CHAIN")
        assert attrs(first)["input.value"] == simple_trajectory["steps"][0]["message"]
        assert attrs(first)["output.value"]
        assert "GOOGL" in attrs(second)["input.value"]
        assert attrs(second)["output.value"] == simple_trajectory["steps"][2]["message"]


class TestMultiToolTrajectory:
    """multi_tool_trajectory.json: user, agent with three tools, system, agent, agent."""

    def test_span_tree(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_tool_trajectory)
        assert _span_kind_counts(spans) == {"AGENT": 1, "CHAIN": 3, "LLM": 3, "TOOL": 4}
        assert {tool["name"] for tool in of_kind(spans, "TOOL")} == {
            "financial_search",
            "news_search",
            "analyst_estimates",
        }
        assert_parents_resolve(spans)

    def test_vendor_metric_is_not_interpreted_as_llm_timing(
        self, multi_tool_trajectory: Dict[str, Any]
    ) -> None:
        llms = of_kind(_convert_atif_trajectory_to_spans(multi_tool_trajectory), "LLM")
        assert [(span["start_time"], span["end_time"]) for span in llms] == [
            ("2025-01-15T14:00:03+00:00", "2025-01-15T14:00:03+00:00"),
            ("2025-01-15T14:00:09+00:00", "2025-01-15T14:00:09+00:00"),
            ("2025-01-15T14:00:14+00:00", "2025-01-15T14:00:14+00:00"),
        ]
        assert all(metadata(span)["atif.timing"] == "event" for span in llms)

    def test_prompt_reconstruction_includes_user_and_system_messages(
        self, multi_tool_trajectory: Dict[str, Any]
    ) -> None:
        llms = of_kind(_convert_atif_trajectory_to_spans(multi_tool_trajectory), "LLM")
        assert attrs(llms[0])["llm.input_messages.0.message.role"] == "user"
        roles = {
            value
            for span in llms
            for key, value in attrs(span).items()
            if key.endswith(".message.role")
        }
        assert {"user", "system", "assistant", "tool"} <= roles


class TestOptionalFields:
    def test_missing_timestamps_still_convert(self) -> None:
        spans = _convert_atif_trajectory_to_spans(
            trajectory(user_then_agent("hi"), schema_version="ATIF-v1.4", trajectory_id=None)
        )
        assert len(spans) == 3
        assert all(span["start_time"] and span["end_time"] for span in spans)
        assert spans[0]["end_time"] == spans[-1]["end_time"]

    def test_root_covers_children_when_last_step_has_no_timestamp(self) -> None:
        steps = user_then_agent("hi")
        steps[0]["timestamp"] = "2025-01-15T10:00:00Z"
        spans = _convert_atif_trajectory_to_spans(trajectory(steps))
        assert spans[0]["end_time"] == spans[-1]["end_time"]

    def test_missing_model_name_yields_bare_chat_span(self) -> None:
        llm = of_kind(_convert_atif_trajectory_to_spans(trajectory(user_then_agent())), "LLM")[0]
        assert llm["name"] == "LLM"
        assert "llm.model_name" not in attrs(llm)

    def test_producer_cache_write_and_reasoning_tokens_are_mapped(self) -> None:
        """Claude Code and Codex record these only under ``metrics.extra``."""

        def llm_attrs(extra: Dict[str, Any]) -> Dict[str, Any]:
            steps = user_then_agent("hi")
            steps[1]["metrics"] = {"prompt_tokens": 10, "completion_tokens": 5, "extra": extra}
            return attrs(of_kind(_convert_atif_trajectory_to_spans(trajectory(steps)), "LLM")[0])

        claude = llm_attrs(
            {"cache_creation_input_tokens": 944, "output_tokens_details": {"thinking_tokens": 208}}
        )
        assert claude["llm.token_count.prompt_details.cache_write"] == 944
        assert claude["llm.token_count.completion_details.reasoning"] == 208

        codex = llm_attrs({"cache_write_input_tokens": 12, "reasoning_output_tokens": 34})
        assert codex["llm.token_count.prompt_details.cache_write"] == 12
        assert codex["llm.token_count.completion_details.reasoning"] == 34

        absent = llm_attrs({"reasoning_output_tokens": None, "total_tokens": 15})
        assert "llm.token_count.prompt_details.cache_write" not in absent
        assert "llm.token_count.completion_details.reasoning" not in absent

    def test_single_unmatched_result_pairs_with_the_only_tool_call(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 1,
                    "source": "agent",
                    "message": "checking",
                    "tool_calls": [tool_call("tc1", "check")],
                    "observation": {"results": [{"content": "result without source_call_id"}]},
                }
            ]
        )
        tool = of_kind(_convert_atif_trajectory_to_spans(document), "TOOL")[0]
        assert attrs(tool)["output.value"] == "result without source_call_id"

    def test_non_monotonic_and_missing_timestamps_do_not_create_negative_durations(
        self,
    ) -> None:
        document = trajectory(
            [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "start",
                    "timestamp": "2025-01-15T10:00:05Z",
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "back",
                    "timestamp": "2025-01-15T10:00:04Z",
                },
                {"step_id": 3, "source": "agent", "message": "no clock"},
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        timed = of_kind(spans, "CHAIN") + of_kind(spans, "LLM")
        assert all(span["start_time"] == span["end_time"] for span in timed)

    def test_leading_missing_timestamp_collapses_to_first_known_event(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "start"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "finished",
                    "timestamp": "2025-01-15T10:00:05Z",
                },
            ],
            _phoenix_fallback_timestamp="2025-01-15T10:00:10Z",
        )
        spans = _convert_atif_trajectory_to_spans(document)
        assert (spans[0]["start_time"], spans[0]["end_time"]) == (
            "2025-01-15T10:00:05+00:00",
            "2025-01-15T10:00:05+00:00",
        )
        chain = of_kind(spans, "CHAIN")[0]
        assert chain["start_time"] == chain["end_time"]

    def test_all_copied_document_emits_context_root_only(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "old input", "is_copied_context": True},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "old output",
                    "is_copied_context": True,
                },
            ],
            _phoenix_fallback_timestamp="2025-01-15T10:00:00Z",
        )
        spans = _convert_atif_trajectory_to_spans(document)
        assert len(spans) == 1
        assert spans[0]["start_time"] == spans[0]["end_time"] == "2025-01-15T10:00:00+00:00"
        assert attrs(spans[0])["input.value"] == "old input"
        assert attrs(spans[0])["output.value"] == ""


class TestMessageAttributes:
    def test_tool_definitions_are_flattened(self) -> None:
        definition = {
            "type": "function",
            "function": {"name": "lookup", "parameters": {"type": "object"}},
        }
        document = trajectory([{"step_id": 1, "source": "agent", "message": "checking"}])
        document["agent"]["tool_definitions"] = [definition]
        llm = of_kind(_convert_atif_trajectory_to_spans(document), "LLM")[0]
        assert "llm.tools" not in attrs(llm)
        assert json.loads(attrs(llm)["llm.tools.0.tool.json_schema"]) == definition

    def test_tool_only_step_still_has_an_assistant_output_message(self) -> None:
        document = trajectory(
            [{"step_id": 1, "source": "agent", "message": "", "tool_calls": [tool_call("c1")]}]
        )
        llm = of_kind(_convert_atif_trajectory_to_spans(document), "LLM")[0]
        assert attrs(llm)["llm.output_messages.0.message.role"] == "assistant"
        assert attrs(llm)["llm.output_messages.0.message.tool_calls.0.tool_call.id"] == "c1"
        assert "output.value" not in attrs(llm)


class TestMultimodalContent:
    """Multimodal (v1.6+) content part handling."""

    def test_stringify_message_with_image_parts(self) -> None:
        result = _stringify_message(
            [
                {"type": "text", "text": "What is in this image?"},
                {"type": "image", "source": {"media_type": "image/png", "path": "img.png"}},
            ]
        )
        assert result == "What is in this image?\n[image: img.png]"

    @pytest.mark.parametrize(
        ("message", "expected"),
        [
            ([{"type": "text", "text": "hello"}, {"type": "image", "source": {"path": "i"}}], True),
            ([{"type": "text", "text": "hello"}, {"type": "text", "text": "world"}], False),
            ("hello", False),
            (None, False),
        ],
        ids=["image", "text-parts", "string", "none"],
    )
    def test_has_multimodal_content(self, message: Any, expected: bool) -> None:
        assert _has_multimodal_content(message) is expected

    def test_multimodal_input_uses_message_contents(
        self, multimodal_trajectory: Dict[str, Any]
    ) -> None:
        llm = of_kind(_convert_atif_trajectory_to_spans(multimodal_trajectory), "LLM")[0]
        a = attrs(llm)
        prefix = "llm.input_messages.0"
        assert a[f"{prefix}.message.role"] == "user"
        assert a[f"{prefix}.message.contents.0.message_content.type"] == "text"
        assert a[f"{prefix}.message.contents.0.message_content.text"] == "What is in this image?"
        assert a[f"{prefix}.message.contents.1.message_content.type"] == "image"
        assert (
            "PNG_transparency_demonstration"
            in (a[f"{prefix}.message.contents.1.message_content.image.image.url"])
        )

        input_messages = json.loads(a["input.value"])
        assert "_raw_parts" not in a["input.value"]
        assert input_messages[0]["role"] == "user"
        assert [part["type"] for part in input_messages[0]["content"]] == ["text", "image"]

    def test_multimodal_flag_only_on_multimodal_steps(
        self, simple_trajectory: Dict[str, Any], multimodal_trajectory: Dict[str, Any]
    ) -> None:
        text_spans = _convert_atif_trajectory_to_spans(simple_trajectory)
        assert all("has_multimodal_content" not in metadata(span) for span in text_spans)


class TestParallelToolsMixedResults:
    def test_each_tool_span_reflects_its_own_result(
        self, parallel_mixed_trajectory: Dict[str, Any]
    ) -> None:
        spans = _convert_atif_trajectory_to_spans(parallel_mixed_trajectory)
        tools = of_kind(spans, "TOOL")
        assert {tool["name"] for tool in tools} == {
            "get_weather",
            "get_stock",
            "get_news",
        }
        assert "42°F" in attrs(named(spans, "get_weather"))["output.value"]
        assert "rate limit" in attrs(named(spans, "get_stock"))["output.value"].lower()
        assert "output.value" not in attrs(named(spans, "get_news"))


class TestSubagentLinking:
    """Cross-trajectory subagent linking through pre-v1.7 session-keyed refs."""

    def test_child_joins_parent_trace_under_the_referencing_tool(
        self, subagent_fixture: Dict[str, Any]
    ) -> None:
        parent, child = subagent_fixture["parent"], subagent_fixture["child"]
        spans = _convert_atif_trajectories_to_spans([parent, child])
        child_root = named(spans, "summarizer")
        parent_trace_id = _sha256_trace_id("sess-parent-001:trace")

        assert child_root["parent_id"] == _sha256_span_id(
            "sess-parent-001:step:2:tool:call_summarize"
        )
        assert child_root["parent_id"] == named(spans, "delegate_summary")["context"]["span_id"]
        assert {span["context"]["trace_id"] for span in spans} == {parent_trace_id}

    def test_independent_trajectories_get_own_traces_without_parents(self) -> None:
        a = trajectory(user_then_agent(), session_id="independent-a", trajectory_id=None)
        b = trajectory(user_then_agent(), session_id="independent-b", trajectory_id=None)
        spans = _convert_atif_trajectories_to_spans([a, b])
        roots = of_kind(spans, "AGENT")
        assert len({root["context"]["trace_id"] for root in roots}) == 2
        assert all("parent_id" not in root for root in roots)

    def test_all_subagent_parents_are_emitted(self) -> None:
        unmatched_parent = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "summarize"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "delegating",
                    "observation": {
                        "results": [{"subagent_trajectory_ref": [{"session_id": "child-run"}]}]
                    },
                },
            ],
            session_id="parent-run",
            trajectory_id=None,
            schema_version="ATIF-v1.4",
        )
        unmatched_child = trajectory(
            user_then_agent(),
            session_id="child-run",
            trajectory_id=None,
            schema_version="ATIF-v1.4",
            agent_name="child",
        )
        harbor_batch = [
            _load_fixture("harbor_terminus2_summarization.json"),
            _load_fixture("harbor_terminus2_sub_summary.json"),
            _load_fixture("harbor_terminus2_sub_answers.json"),
            _load_fixture("harbor_terminus2_sub_questions.json"),
        ]
        for batch in (
            harbor_batch,
            [unmatched_parent, unmatched_child],
            [_load_fixture("v17_embedded_subagents.json")],
        ):
            assert_parents_resolve(_convert_atif_trajectories_to_spans(batch))


class TestATIFV17Conversion:
    def test_embedded_child_links_to_parent_tool_and_inherits_session(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        spans = _convert_atif_trajectories_to_spans([v17_embedded_subagents])
        child_root = named(spans, "researcher")
        trace_id = _sha256_trace_id("run-v17-001:trace")

        assert child_root["context"]["trace_id"] == trace_id
        assert child_root["parent_id"] == _sha256_span_id(
            f"{trace_id}:parent-doc:step:2:tool:call_delegate"
        )
        assert child_root["parent_id"] == (named(spans, "delegate_research")["context"]["span_id"])
        assert attrs(child_root)["session.id"] == "run-v17-001"
        assert metadata(child_root)["trajectory_id"] == "child-doc"

    def test_same_embedded_subagent_in_two_traces_does_not_collide(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        """Byte-identical embedded documents under different parents get distinct span IDs."""
        second_parent = {
            **json.loads(json.dumps(v17_embedded_subagents)),
            "trajectory_id": "other-parent-doc",
            "session_id": "run-v17-002",
        }
        spans = _convert_atif_trajectories_to_spans([v17_embedded_subagents, second_parent])

        span_ids = [span["context"]["span_id"] for span in spans]
        assert len(set(span_ids)) == len(span_ids)
        child_roots = [s for s in spans if s["name"] == "researcher"]
        assert len(child_roots) == 2
        assert len({s["context"]["trace_id"] for s in child_roots}) == 2

    def test_deterministic_dispatch_skips_llm_span(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        spans = _convert_atif_trajectory_to_spans(v17_embedded_subagents)
        assert _span_kind_counts(spans) == {"AGENT": 1, "CHAIN": 3, "LLM": 1, "TOOL": 1}
        tool_metadata = metadata(of_kind(spans, "TOOL")[0])
        assert tool_metadata["llm_call_count"] == 0
        assert tool_metadata["tool_call_extra"] == {"runtime": "graph-dispatch"}
        assert tool_metadata["observation_extra"] == {"confidence": 0.91}

    def test_context_management_replace_reconstructs_llm_input(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        llm = of_kind(_convert_atif_trajectory_to_spans(v17_embedded_subagents), "LLM")[0]
        assert attrs(llm)["llm.input_messages.0.message.role"] == "system"
        assert "Compacted context" in attrs(llm)["llm.input_messages.0.message.content"]
        assert "Research current ATIF" not in attrs(llm)["input.value"]

    def test_context_management_replace_preserves_empty_context(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "old context"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "",
                    "llm_call_count": 0,
                    "tool_calls": [tool_call("call_compact", "compact")],
                    "observation": {"results": [{"source_call_id": "call_compact", "content": ""}]},
                    "extra": {"context_management": {"boundary": "replace"}},
                },
                {"step_id": 3, "source": "user", "message": "new context"},
                {"step_id": 4, "source": "agent", "message": "answer"},
            ]
        )
        llm = of_kind(_convert_atif_trajectory_to_spans(document), "LLM")[-1]
        assert attrs(llm)["llm.input_messages.0.message.role"] == "system"
        assert attrs(llm)["llm.input_messages.0.message.content"] == ""
        assert "old context" not in attrs(llm)["input.value"]

    def test_same_session_without_trajectory_id_gets_distinct_traces(self) -> None:
        a = trajectory(user_then_agent("hi"), session_id="shared", trajectory_id=None)
        b = trajectory(user_then_agent("bye"), session_id="shared", trajectory_id=None)
        spans_a = _convert_atif_trajectory_to_spans(a)
        spans_b = _convert_atif_trajectory_to_spans(b)
        assert spans_a[0]["context"]["trace_id"] != spans_b[0]["context"]["trace_id"]
        span_ids = {span["context"]["span_id"] for span in spans_a + spans_b}
        assert len(span_ids) == len(spans_a) + len(spans_b)

    def test_same_session_with_trajectory_ids_shares_trace_without_collisions(self) -> None:
        a = trajectory(user_then_agent("hi"), session_id="shared", trajectory_id="doc-a")
        b = trajectory(user_then_agent("bye"), session_id="shared", trajectory_id="doc-b")
        spans_a = _convert_atif_trajectory_to_spans(a)
        spans_b = _convert_atif_trajectory_to_spans(b)
        assert spans_a[0]["context"]["trace_id"] == spans_b[0]["context"]["trace_id"]
        assert spans_a[0]["context"]["trace_id"] == _sha256_trace_id("shared:trace")
        span_ids = {span["context"]["span_id"] for span in spans_a + spans_b}
        assert len(span_ids) == len(spans_a) + len(spans_b)

    def test_document_hash_fallback_ignores_phoenix_private_keys(self) -> None:
        document = trajectory(user_then_agent("hi"), trajectory_id=None)
        first = _convert_atif_trajectory_to_spans(document)
        second = _convert_atif_trajectory_to_spans(dict(document))
        assert [span["context"] for span in first] == [span["context"] for span in second]
        assert _document_hash(document) == _document_hash(
            {**document, "_phoenix_parent_span_context": ("parent-span", "trace")}
        )
        assert _document_hash(document) == _document_hash(
            {**document, "_phoenix_fallback_timestamp": "2025-01-15T10:00:00Z"}
        )

    def test_grandchild_embedded_subagent_links_to_nearest_parent_tool(self) -> None:
        def delegating_step(call_id: str, child_id: str) -> Dict[str, Any]:
            return {
                "step_id": 2,
                "source": "agent",
                "message": "",
                "llm_call_count": 0,
                "tool_calls": [tool_call(call_id, "delegate")],
                "observation": {
                    "results": [
                        {
                            "source_call_id": call_id,
                            "subagent_trajectory_ref": [{"trajectory_id": child_id}],
                        }
                    ]
                },
            }

        grandchild = trajectory(
            user_then_agent(),
            session_id=None,
            trajectory_id="grandchild-doc",
            agent_name="grandchild",
        )
        child = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "deeper"},
                delegating_step("call_gc", "grandchild-doc"),
            ],
            session_id=None,
            trajectory_id="child-doc",
            agent_name="child",
            subagent_trajectories=[grandchild],
        )
        parent = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "delegate"},
                delegating_step("call_c", "child-doc"),
            ],
            session_id="run-grandchild",
            trajectory_id="parent-doc",
            agent_name="parent",
            subagent_trajectories=[child],
        )

        spans = _convert_atif_trajectories_to_spans([parent])
        trace_id = _sha256_trace_id("run-grandchild:trace")
        tools = of_kind(spans, "TOOL")

        assert {span["context"]["trace_id"] for span in spans} == {trace_id}
        assert {attrs(span)["session.id"] for span in spans} == {"run-grandchild"}
        assert named(spans, "child")["parent_id"] == tools[0]["context"]["span_id"]
        assert named(spans, "grandchild")["parent_id"] == (tools[1]["context"]["span_id"])
        assert tools[1]["context"]["span_id"] == _sha256_span_id(
            f"{trace_id}:child-doc:step:2:tool:call_gc"
        )


class TestMultiTurnBehavior:
    """Root AGENT -> turn AGENT -> step CHAIN -> LLM."""

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

    def test_turn_tree(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        root = spans[0]
        turns = [s for s in spans if s["name"].startswith("turn ")]
        steps = of_kind(spans, "CHAIN")
        llms = of_kind(spans, "LLM")

        assert (root["name"], root["span_kind"]) == ("assistant", "AGENT")
        assert "parent_id" not in root
        assert [t["name"] for t in turns] == ["turn 1", "turn 2"]
        assert all(t.get("parent_id") == root["context"]["span_id"] for t in turns)
        assert all(t["span_kind"] == "AGENT" for t in turns)
        assert [s["parent_id"] for s in steps] == [t["context"]["span_id"] for t in turns]
        assert [llm["parent_id"] for llm in llms] == [s["context"]["span_id"] for s in steps]
        assert len({s["context"]["trace_id"] for s in spans}) == 1

    def test_turn_timing_and_io(self, multi_turn_trajectory: Dict[str, Any]) -> None:
        spans = _convert_atif_trajectory_to_spans(multi_turn_trajectory)
        turns = [s for s in spans if s["name"].startswith("turn ")]
        assert [(t["start_time"], t["end_time"]) for t in turns] == [
            ("2025-01-15T10:00:00+00:00", "2025-01-15T10:00:01+00:00"),
            ("2025-01-15T10:00:02+00:00", "2025-01-15T10:00:03+00:00"),
        ]
        assert [(attrs(t)["input.value"], attrs(t)["output.value"]) for t in turns] == [
            ("What is 2+2?", "2+2 is 4."),
            ("And what is 3+3?", "3+3 is 6."),
        ]

    def test_single_turn_skips_turn_agent(self) -> None:
        spans = _convert_atif_trajectory_to_spans(trajectory(user_then_agent("hi")))
        root, step, llm = spans
        assert not [s for s in spans if s["name"].startswith("turn ")]
        assert step.get("parent_id") == root["context"]["span_id"]
        assert llm.get("parent_id") == step["context"]["span_id"]


class TestContinuationMerging:
    """Continuation trajectories (session_id ending in -cont-N) share a trace."""

    @pytest.mark.parametrize(
        ("session_id", "expected"),
        [
            ("abc123", "abc123"),
            ("abc123-cont-1", "abc123"),
            ("abc123-cont-10", "abc123"),
            ("abc123-cont-work-cont-2", "abc123-cont-work"),
            ("my-session-content-1", "my-session-content-1"),
            ("abc-cont-xyz", "abc-cont-xyz"),
            ("abc-cont-", "abc-cont-"),
        ],
    )
    def test_base_session_id(self, session_id: str, expected: str) -> None:
        assert _base_session_id(session_id) == expected

    def test_harbor_continuation_shares_trace_with_distinct_spans(self) -> None:
        original = _convert_atif_trajectory_to_spans(
            _load_fixture("harbor_terminus2_continuation.json")
        )
        cont1 = _convert_atif_trajectory_to_spans(
            _load_fixture("harbor_terminus2_continuation_cont1.json")
        )
        unrelated = _convert_atif_trajectory_to_spans(
            _load_fixture("harbor_terminus2_timeout.json")
        )

        assert original[0]["context"]["trace_id"] == cont1[0]["context"]["trace_id"]
        assert original[0]["context"]["trace_id"] != unrelated[0]["context"]["trace_id"]
        original_ids = {s["context"]["span_id"] for s in original}
        assert original_ids.isdisjoint(s["context"]["span_id"] for s in cont1)

        assert "is_continuation" not in metadata(original[0])
        assert metadata(cont1[0])["is_continuation"] is True
        assert all("has_copied_context" not in metadata(s) for s in of_kind(original, "LLM"))
        assert all(metadata(s)["has_copied_context"] is True for s in of_kind(cont1, "LLM"))

    def test_v17_continuation_shares_base_trace_with_distinct_span_ids(self) -> None:
        original = trajectory(
            user_then_agent("started"), session_id="run-v17-cont", trajectory_id="v17-original"
        )
        continuation = trajectory(
            user_then_agent("continued"),
            session_id="run-v17-cont-cont-1",
            trajectory_id="v17-follow-up",
            continued_trajectory_ref="run-v17-cont",
        )
        original_spans = _convert_atif_trajectory_to_spans(original)
        continuation_spans = _convert_atif_trajectory_to_spans(continuation)

        assert original_spans[0]["context"]["trace_id"] == _sha256_trace_id("run-v17-cont:trace")
        assert (
            original_spans[0]["context"]["trace_id"]
            == (continuation_spans[0]["context"]["trace_id"])
        )
        original_ids = {span["context"]["span_id"] for span in original_spans}
        assert original_ids.isdisjoint(span["context"]["span_id"] for span in continuation_spans)


class TestHarborGoldenFiles:
    """Real Harbor golden trajectory files."""

    @pytest.mark.parametrize(
        ("fixture_name", "expected_kinds"),
        [
            ("harbor_openhands.json", {"AGENT": 1, "CHAIN": 2, "LLM": 2, "TOOL": 2}),
            ("harbor_terminus2_summarization.json", {"AGENT": 3, "CHAIN": 8, "LLM": 7, "TOOL": 7}),
            ("harbor_terminus2_continuation.json", {"AGENT": 1, "CHAIN": 4, "LLM": 3}),
            ("harbor_terminus2_continuation_cont1.json", {"AGENT": 1, "CHAIN": 4, "LLM": 4}),
            ("harbor_terminus2_invalid_json.json", {"AGENT": 1, "CHAIN": 4, "LLM": 4, "TOOL": 3}),
            ("harbor_terminus2_timeout.json", {"AGENT": 1, "CHAIN": 3, "LLM": 3, "TOOL": 3}),
            ("harbor_terminus2_sub_summary.json", {"AGENT": 1, "CHAIN": 1, "LLM": 1}),
            ("harbor_terminus2_sub_answers.json", {"AGENT": 1, "CHAIN": 1, "LLM": 1}),
            ("harbor_terminus2_sub_questions.json", {"AGENT": 1, "CHAIN": 1, "LLM": 1}),
        ],
    )
    def test_golden_trajectory_span_shape(
        self, fixture_name: str, expected_kinds: Dict[str, int]
    ) -> None:
        spans = _convert_atif_trajectory_to_spans(_load_fixture(fixture_name))
        assert _span_kind_counts(spans) == expected_kinds
        assert_parents_resolve(spans)

    def test_openhands_root_and_tool_definitions(self) -> None:
        spans = _convert_atif_trajectory_to_spans(_load_fixture("harbor_openhands.json"))
        assert (spans[0]["name"], spans[0]["span_kind"]) == ("openhands", "AGENT")
        assert "parent_id" not in spans[0]
        assert any(key.startswith("llm.tools.") for key in attrs(of_kind(spans, "LLM")[0]))

    def test_terminus2_summarization_batch_links_subagents(self) -> None:
        parent = _load_fixture("harbor_terminus2_summarization.json")
        children = [
            _load_fixture("harbor_terminus2_sub_summary.json"),
            _load_fixture("harbor_terminus2_sub_answers.json"),
            _load_fixture("harbor_terminus2_sub_questions.json"),
        ]
        spans = _convert_atif_trajectories_to_spans([parent, *children])
        parent_trace_id = _sha256_trace_id(f"{parent['session_id']}:trace")
        child_roots = [named(spans, f"{child['agent']['name']}") for child in children]

        assert {span["context"]["trace_id"] for span in spans} == {parent_trace_id}
        assert all("parent_id" in root for root in child_roots)
        assert_parents_resolve(spans)

    def test_only_llm_spans_carry_llm_attributes(self) -> None:
        spans = _convert_atif_trajectories_to_spans(
            [
                _load_fixture("harbor_terminus2_summarization.json"),
                _load_fixture("harbor_terminus2_sub_summary.json"),
            ]
        )
        offenders = [
            (span["name"], key)
            for span in spans
            if span["span_kind"] != "LLM"
            for key in attrs(span)
            if key.startswith("llm.")
        ]
        assert not offenders

    def test_terminus2_invalid_json_has_reasoning(self) -> None:
        spans = _convert_atif_trajectory_to_spans(
            _load_fixture("harbor_terminus2_invalid_json.json")
        )
        assert any(metadata(span).get("reasoning_content") for span in of_kind(spans, "LLM"))

    def test_claude_code_failed_run_converts(self) -> None:
        """A real ATIF-v1.2 trajectory from a Claude Code run that never logged in."""
        document: Dict[str, Any] = {
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
                    "metrics": {"prompt_tokens": 0, "completion_tokens": 0, "cached_tokens": 0},
                    "extra": {"stop_reason": "stop_sequence"},
                },
            ],
            "final_metrics": {"total_prompt_tokens": 0, "total_completion_tokens": 0},
        }
        spans = _convert_atif_trajectory_to_spans(document)
        assert (spans[0]["name"], spans[0]["span_kind"]) == ("claude-code", "AGENT")
        llm = of_kind(spans, "LLM")[0]
        assert llm["name"] == "<synthetic>"
        assert "llm.token_count.total" not in attrs(llm)
        assert attrs(llm)["output.value"] == "Not logged in"


class TestOperationNamingAndTiming:
    """Visible step names and document timing anchors."""

    def test_action_names_use_per_label_ordinals(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "go"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "working",
                    "timestamp": "2025-01-15T10:00:01Z",
                },
                {
                    "step_id": 3,
                    "source": "system",
                    "message": "Compacted context",
                    "timestamp": "2025-01-15T10:00:02Z",
                    "extra": {"context_management": {"kind": "summarization"}},
                },
                {
                    "step_id": 4,
                    "source": "agent",
                    "message": "done",
                    "timestamp": "2025-01-15T10:00:03Z",
                },
            ]
        )
        chains = of_kind(_convert_atif_trajectory_to_spans(document), "CHAIN")
        assert [s["name"] for s in chains] == ["iteration 1", "compaction 1", "iteration 2"]
        assert [metadata(s)["atif.step_id"] for s in chains] == [2, 3, 4]
        assert metadata(chains[1])["atif.context_management"] is True
        assert "atif.context_management" not in metadata(chains[0])

    def test_copied_context_consumes_no_ordinal(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "agent", "message": "old work", "is_copied_context": True},
                {"step_id": 2, "source": "user", "message": "go"},
                {
                    "step_id": 3,
                    "source": "agent",
                    "message": "fresh work",
                    "timestamp": "2025-01-15T10:00:01Z",
                },
            ]
        )
        chains = of_kind(_convert_atif_trajectory_to_spans(document), "CHAIN")
        assert [s["name"] for s in chains] == ["iteration 1"]

    @pytest.mark.parametrize(
        ("extra", "expected_name", "expected_metadata"),
        [
            (
                {"_phoenix_is_continuation": True, "_phoenix_continuation_index": 2},
                "worker (continuation 2)",
                {"is_continuation": True, "continuation_index": 2},
            ),
            (
                {"session_id": "run-cont-1"},
                "worker (continuation)",
                {"is_continuation": True},
            ),
        ],
        ids=["continuation-index", "continuation-session"],
    )
    def test_root_name_qualifiers(
        self, extra: Dict[str, Any], expected_name: str, expected_metadata: Dict[str, Any]
    ) -> None:
        root = _convert_atif_trajectory_to_spans({**trajectory(user_then_agent()), **extra})[0]
        assert root["name"] == expected_name
        assert expected_metadata.items() <= metadata(root).items()

    def test_first_agent_step_anchors_document_with_measured_latency(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 3,
                    "source": "agent",
                    "message": "fresh work",
                    "timestamp": "2025-01-15T10:00:30Z",
                    "_phoenix_llm_latency_ms": 10000,
                    "_phoenix_llm_latency_source": "test.measurement",
                    "tool_calls": [tool_call("c1")],
                }
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        root, chain, llm, tool = spans
        assert root["start_time"] == chain["start_time"] == "2025-01-15T10:00:20+00:00"
        assert chain["end_time"] == "2025-01-15T10:00:30+00:00"
        assert (llm["start_time"], llm["end_time"]) == (
            "2025-01-15T10:00:20+00:00",
            "2025-01-15T10:00:30+00:00",
        )
        assert metadata(llm)["atif.timing"] == "test.measurement"
        assert tool["start_time"] == tool["end_time"] == "2025-01-15T10:00:30+00:00"

    def test_measured_latency_is_clamped_to_the_step_interval(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "go",
                    "timestamp": "2025-01-15T10:00:00Z",
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "slow",
                    "timestamp": "2025-01-15T10:00:05Z",
                    "_phoenix_llm_latency_ms": 60000,
                },
            ]
        )
        llm = of_kind(_convert_atif_trajectory_to_spans(document), "LLM")[0]
        assert (llm["start_time"], llm["end_time"]) == (
            "2025-01-15T10:00:00+00:00",
            "2025-01-15T10:00:05+00:00",
        )
        assert metadata(llm)["atif.timing"] == "adapter_clamped"
        assert metadata(llm)["atif.measured_latency_ms"] == 60000

    def test_first_step_without_latency_stays_point_event(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 3,
                    "source": "agent",
                    "message": "fresh",
                    "timestamp": "2025-01-15T10:00:30Z",
                }
            ]
        )
        root = _convert_atif_trajectory_to_spans(document)[0]
        assert root["start_time"] == root["end_time"] == "2025-01-15T10:00:30+00:00"


class TestStepLevelObservations:
    """The step span keeps observations that no tool call claims."""

    def test_combined_observation_lands_on_step_span(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 1,
                    "source": "agent",
                    "message": "running commands",
                    "tool_calls": [tool_call("a"), tool_call("b")],
                    "observation": {"results": [{"content": "combined terminal output"}]},
                }
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        step = of_kind(spans, "CHAIN")[0]
        assert all("output.value" not in attrs(s) for s in of_kind(spans, "TOOL"))
        assert json.loads(attrs(step)["output.value"]) == {
            "message": "running commands",
            "observation": "combined terminal output",
        }
        assert attrs(step)["output.mime_type"] == "application/json"

    def test_matched_results_pair_to_tools(self) -> None:
        document = trajectory(
            [
                {
                    "step_id": 1,
                    "source": "agent",
                    "message": "running",
                    "tool_calls": [tool_call("a"), tool_call("b")],
                    "observation": {
                        "results": [
                            {"source_call_id": "a", "content": "out-a"},
                            {"source_call_id": "b", "content": "out-b"},
                        ]
                    },
                }
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        step = of_kind(spans, "CHAIN")[0]
        assert [attrs(s)["output.value"] for s in of_kind(spans, "TOOL")] == ["out-a", "out-b"]
        assert (attrs(step)["output.value"], attrs(step)["output.mime_type"]) == (
            "running",
            "text/plain",
        )

    def test_step_input_is_the_preceding_context(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "request"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "looking",
                    "tool_calls": [tool_call("a")],
                    "observation": {"results": [{"source_call_id": "a", "content": "tool output"}]},
                },
                {
                    "step_id": 3,
                    "source": "system",
                    "message": "note",
                    "extra": {"context_management": {"kind": "summarization"}},
                },
                {"step_id": 4, "source": "agent", "message": "answer"},
            ]
        )
        chains = of_kind(_convert_atif_trajectory_to_spans(document), "CHAIN")
        assert [s["name"] for s in chains] == ["iteration 1", "compaction 1", "iteration 2"]
        assert attrs(chains[0])["input.value"] == "request"
        assert attrs(chains[0])["output.value"]
        assert attrs(chains[1])["input.value"] == "note"
        assert attrs(chains[2])["input.value"] == "note"
        assert attrs(chains[2])["output.value"] == "answer"

    def test_tool_only_step_reports_tool_results_as_output(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "request"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "",
                    "tool_calls": [tool_call("a"), tool_call("b")],
                    "observation": {
                        "results": [
                            {"source_call_id": "a", "content": "first"},
                            {"source_call_id": "b", "content": "second"},
                        ]
                    },
                },
            ]
        )
        step = named(_convert_atif_trajectory_to_spans(document), "iteration 1")
        assert attrs(step)["input.value"] == "request"
        assert attrs(step)["output.value"] == "first\nsecond"


class TestTurnGrouping:
    def test_consecutive_context_messages_do_not_create_turns(self) -> None:
        """Codex-style leading system and doubled user context stays one turn."""
        document = trajectory(
            [
                {"step_id": 1, "source": "system", "message": "skills"},
                {"step_id": 2, "source": "user", "message": "<environment_context/>"},
                {"step_id": 3, "source": "user", "message": "do the task"},
                {
                    "step_id": 4,
                    "source": "agent",
                    "message": "done",
                    "timestamp": "2025-01-15T10:00:05Z",
                },
            ],
            agent_name="codex",
        )
        spans = _convert_atif_trajectory_to_spans(document)
        assert [s["name"] for s in of_kind(spans, "AGENT")] == ["codex"]
        assert [s["name"] for s in of_kind(spans, "CHAIN")] == ["iteration 1"]
        assert attrs(spans[0])["input.value"] == "do the task"

    def test_follow_up_user_message_after_agent_activity_starts_turn(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "first"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "one",
                    "timestamp": "2025-01-15T10:00:05Z",
                },
                {"step_id": 3, "source": "user", "message": "second"},
                {
                    "step_id": 4,
                    "source": "agent",
                    "message": "two",
                    "timestamp": "2025-01-15T10:00:10Z",
                },
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        assert [s["name"] for s in spans if s["name"].startswith("turn ")] == ["turn 1", "turn 2"]

    def test_continuation_input_falls_back_to_copied_request(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "original", "is_copied_context": True},
                {
                    "step_id": 2,
                    "source": "user",
                    "message": "handoff answers",
                    "is_copied_context": True,
                },
                {
                    "step_id": 3,
                    "source": "agent",
                    "message": "continuing",
                    "timestamp": "2025-01-15T10:00:05Z",
                },
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        assert attrs(spans[0])["input.value"] == "handoff answers"
        iteration = named(spans, "iteration 1")
        assert attrs(iteration)["input.value"] == "handoff answers"
        assert attrs(iteration)["output.value"] == "continuing"


class TestEqualTimeEvents:
    def test_events_keep_exact_timestamp_and_declared_tool_order(self) -> None:
        document = trajectory(
            [
                {"step_id": 1, "source": "user", "message": "go"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "running",
                    "timestamp": "2025-01-15T10:00:10Z",
                    "tool_calls": [tool_call("a"), tool_call("b"), tool_call("c", "done")],
                },
            ]
        )
        spans = _convert_atif_trajectory_to_spans(document)
        llm = of_kind(spans, "LLM")[0]
        tools = of_kind(spans, "TOOL")
        assert [llm["start_time"], *(t["start_time"] for t in tools)] == [
            "2025-01-15T10:00:10+00:00"
        ] * 4
        assert all(t["start_time"] == t["end_time"] for t in tools)
        assert [t["name"] for t in tools] == [
            "bash",
            "bash",
            "done",
        ]
        assert [metadata(t)["atif.tool_call_index"] for t in tools] == [0, 1, 2]
