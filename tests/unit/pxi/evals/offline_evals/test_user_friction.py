from __future__ import annotations

from typing import Any
from unittest import mock

from phoenix.client.__generated__ import v1

from evals.pxi.offline_evals.conversation import (
    Message,
    messages_from_attributes,
    segment_turns,
    transcript,
)
from evals.pxi.offline_evals.evaluators import user_friction
from evals.pxi.offline_evals.rendering import render_conversation
from phoenix.db.types.annotation_configs import OptimizationDirection


def _span(
    span_id: str,
    *,
    name: str,
    kind: str,
    parent_id: str | None,
    start: int,
    attributes: dict[str, Any] | None = None,
) -> v1.Span:
    span: v1.Span = {
        "name": name,
        "context": {"trace_id": "trace-1", "span_id": span_id},
        "span_kind": kind,
        "start_time": f"2026-07-09T00:00:{start:02d}+00:00",
        "end_time": f"2026-07-09T00:00:{start + 1:02d}+00:00",
        "status_code": "OK",
    }
    if parent_id is not None:
        span["parent_id"] = parent_id
    if attributes is not None:
        span["attributes"] = attributes
    return span


def _flat_messages(prefix: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Flatten messages the way the Phoenix REST API returns span attributes."""
    attributes: dict[str, Any] = {}
    for i, message in enumerate(messages):
        for field, value in message.items():
            if field == "tool_calls":
                for j, call in enumerate(value):
                    for sub, sub_value in call.items():
                        attributes[f"{prefix}.{i}.message.tool_calls.{j}.tool_call.{sub}"] = (
                            sub_value
                        )
            else:
                attributes[f"{prefix}.{i}.message.{field}"] = value
    return attributes


def _two_turn_trace(latest_user_message: str) -> tuple[v1.Span, list[v1.Span]]:
    """A trace whose last LLM span carries a prior turn plus the target message."""
    input_messages = [
        {"role": "user", "content": "show me traces from today"},
        {
            "role": "assistant",
            "content": "Filtering to today.",
            "tool_calls": [
                {
                    "id": "call-1",
                    "function.name": "set_time_range",
                    "function.arguments": '{"range": "today"}',
                }
            ],
        },
        {"role": "tool", "content": "ok", "tool_call_id": "call-1"},
        {"role": "assistant", "content": "Here are today's traces."},
        {"role": "user", "content": latest_user_message},
    ]
    output_messages = [{"role": "assistant", "content": "Sorry — restoring the full range."}]
    root = _span(
        "root",
        name="pxi.turn",
        kind="AGENT",
        parent_id=None,
        start=0,
        attributes={"input.value": latest_user_message},
    )
    llm = _span(
        "llm",
        name="model",
        kind="LLM",
        parent_id="root",
        start=1,
        attributes={
            **_flat_messages("llm.input_messages", input_messages),
            **_flat_messages("llm.output_messages", output_messages),
        },
    )
    return root, [root, llm]


def test_messages_from_flattened_attributes() -> None:
    attributes = _flat_messages(
        "llm.input_messages",
        [
            {"role": "user", "content": "hi"},
            {
                "role": "assistant",
                "tool_calls": [
                    {"id": "c1", "function.name": "bash", "function.arguments": '{"cmd": "ls"}'}
                ],
            },
        ],
    )
    messages = messages_from_attributes(attributes)
    assert messages == [
        Message(role="user", content="hi"),
        Message(
            role="assistant",
            content="",
            tool_calls=[{"id": "c1", "name": "bash", "args": {"cmd": "ls"}}],
        ),
    ]


def test_transcript_uses_last_llm_span_and_appends_output() -> None:
    root, spans = _two_turn_trace("no, I asked for this week")
    messages = transcript(spans)
    assert messages[0].content == "show me traces from today"
    assert messages[-1] == Message(role="assistant", content="Sorry — restoring the full range.")
    turns = segment_turns(messages)
    assert [turn.user_message for turn in turns] == [
        "show me traces from today",
        "no, I asked for this week",
    ]
    assert turns[0].tool_calls[0]["name"] == "set_time_range"


def test_transcript_ignores_later_subagent_llm_span() -> None:
    """A subagent's LLM span starting after the main agent's final call must not
    hijack transcript reconstruction (regression: trace 6e6a106d in pxi_dev)."""
    root, spans = _two_turn_trace("no, I asked for this week")
    subagent = _span("subagent", name="ServerAgent.iter", kind="AGENT", parent_id="root", start=5)
    nested_llm = _span(
        "nested-llm",
        name="model",
        kind="LLM",
        parent_id="subagent",
        start=9,  # later than the top-level LLM span
        attributes=_flat_messages(
            "llm.input_messages",
            [{"role": "user", "content": "internal subagent task prompt"}],
        ),
    )
    messages = transcript([*spans, subagent, nested_llm])
    assert messages[0].content == "show me traces from today"
    assert all("subagent task" not in m.content for m in messages)


def test_render_conversation_details_reacted_to_turn() -> None:
    turns = segment_turns(transcript(_two_turn_trace("looks wrong")[1]))
    rendered = render_conversation(turns, target_index=1)
    assert "### User\nshow me traces from today" in rendered
    assert "> Tool: set_time_range" in rendered  # detailed tier
    assert "looks wrong" not in rendered  # target message excluded from history


def test_applies_to_requires_prior_human_turn() -> None:
    root, spans = _two_turn_trace("no, I asked for this week")
    assert user_friction.applies_to_user_friction(root, spans)

    # First message of a session: only one human turn, nothing to react to.
    first_root = _span(
        "root",
        name="pxi.turn",
        kind="AGENT",
        parent_id=None,
        start=0,
        attributes={"input.value": "hello"},
    )
    first_llm = _span(
        "llm",
        name="model",
        kind="LLM",
        parent_id="root",
        start=1,
        attributes=_flat_messages("llm.input_messages", [{"role": "user", "content": "hello"}]),
    )
    assert not user_friction.applies_to_user_friction(first_root, [first_root, first_llm])

    # No LLM span at all.
    assert not user_friction.applies_to_user_friction(first_root, [first_root])


def test_non_human_latest_message_is_not_applicable() -> None:
    """Injected/non-human final user messages skip — no fallback to earlier turns."""
    non_human_messages = [
        "<phoenix_ui_context>{'page': 'traces'}</phoenix_ui_context>",  # frontend UI context
        '{"parts": [{"tool_return": "ok"}]}',  # agent-loop continuation
        '{"data": null, "errors": [{"message": "boom"}]}',  # tool error payload
    ]
    for message in non_human_messages:
        root, spans = _two_turn_trace(message)
        assert not user_friction.applies_to_user_friction(root, spans), message
        assert user_friction.evaluate_user_friction(root, spans) is None, message


def test_evaluate_maps_judge_score_to_annotation() -> None:
    root, spans = _two_turn_trace("no, I asked for this week")
    score = mock.Mock(score=1.0, label="friction", explanation="user corrects the assistant")
    judge = mock.Mock()
    judge.evaluate.return_value = [score]
    with mock.patch.object(user_friction, "_judge", return_value=judge):
        result = user_friction.evaluate_user_friction(root, spans)
    assert result is not None
    assert result.score == 1.0
    assert result.explanation == "user corrects the assistant"
    assert result.metadata["label"] == "friction"
    judge.evaluate.assert_called_once()
    eval_input = judge.evaluate.call_args.args[0]
    assert eval_input["user_message"] == "no, I asked for this week"
    assert "set_time_range" in eval_input["conversation"]


def test_spec_configuration() -> None:
    spec = user_friction.USER_FRICTION
    assert spec.name == "user_friction"
    assert spec.annotator_kind == "LLM"
    assert spec.optimization_direction is OptimizationDirection.MINIMIZE
    assert spec.root_span_name == "pxi.turn"
    with mock.patch.dict("os.environ", {"PXI_USER_FRICTION_PROVIDER": "openai"}):
        assert spec.required_env_fn() == ("OPENAI_API_KEY",)
