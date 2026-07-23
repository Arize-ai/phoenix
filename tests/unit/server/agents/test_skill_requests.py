from __future__ import annotations

from pathlib import Path

from pydantic import TypeAdapter
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import UIMessage as PydanticAIUIMessage

from phoenix.db.types.data_stream_protocol import (
    UIMessage,
    UITextPart,
    UIToolPart,
)
from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.prompts.templating import get_template
from phoenix.server.agents.skill_requests import (
    LOAD_SKILL_TOOL_NAME,
    inject_requested_skills,
    iter_requested_skill_response_chunks,
    resolve_requested_skills,
)

_LOAD_SKILL_TEMPLATE = get_template("skills/LOAD_SKILL.xml.j2")


def _make_skill(name: str) -> Skill:
    return Skill(
        name=name,
        description=f"{name} description",
        summary=f"{name} summary",
        content=f"# {name}\n\nbody for {name}",
        path=Path("/tmp/unused"),
    )


def _user_message(text: str) -> UIMessage:
    return UIMessage(id="u1", role="user", parts=[UITextPart(type="text", text=text)])


def _load_skill_part(message: UIMessage) -> UIToolPart:
    """Return the synthetic load-skill part, narrowing the part union for mypy."""
    part = message.parts[0]
    assert isinstance(part, UIToolPart)
    return part


def _inject(
    messages: list[UIMessage],
    requested: list[str],
    available: list[Skill],
) -> list[UIMessage]:
    return inject_requested_skills(
        messages=messages,
        requested_skill_names=requested,
        available_skills=available,
        load_skill_template=_LOAD_SKILL_TEMPLATE,
        message_factory=UIMessage,
    )


class TestInjectRequestedSkills:
    def test_no_requested_skills_returns_unchanged_copy(self) -> None:
        messages = [_user_message("hello")]
        result = _inject(messages, [], [_make_skill("debug-trace")])
        assert result == messages
        assert result is not messages  # new list, original untouched

    def test_appends_synthetic_load_at_tail(self) -> None:
        messages = [_user_message("/debug-trace help")]
        result = _inject(messages, ["debug-trace"], [_make_skill("debug-trace")])
        assert len(result) == 2
        # prefix is byte-identical (cache preservation)
        assert result[0] is messages[0]
        synthetic = result[1]
        assert synthetic.role == "assistant"
        assert len(synthetic.parts) == 1
        part = _load_skill_part(synthetic)
        assert part.type == f"tool-{LOAD_SKILL_TOOL_NAME}"
        assert part.input == {"skill_name": "debug-trace"}
        assert isinstance(part.output, str)
        assert "body for debug-trace" in part.output

    def test_unknown_skill_is_ignored(self) -> None:
        messages = [_user_message("hi")]
        result = _inject(messages, ["does-not-exist"], [_make_skill("debug-trace")])
        assert len(result) == 1

    def test_unavailable_skill_is_ignored(self) -> None:
        # requested skill exists conceptually but is not in the available set
        messages = [_user_message("hi")]
        result = _inject(messages, ["playground"], [_make_skill("debug-trace")])
        assert len(result) == 1

    def test_dedupes_within_request(self) -> None:
        messages = [_user_message("hi")]
        result = _inject(
            messages,
            ["annotate-spans", "annotate-spans"],
            [_make_skill("annotate-spans")],
        )
        assert len(result) == 2

    def test_dedupes_against_already_loaded_history(self) -> None:
        messages = [_user_message("/debug-trace")]
        available = [_make_skill("debug-trace")]
        once = _inject(messages, ["debug-trace"], available)
        assert len(once) == 2
        twice = _inject(once, ["debug-trace"], available)
        assert len(twice) == 2  # no second synthetic load

    def test_preserves_request_order_for_multiple_skills(self) -> None:
        messages = [_user_message("hi")]
        available = [_make_skill("debug-trace"), _make_skill("annotate-spans")]
        result = _inject(messages, ["annotate-spans", "debug-trace"], available)
        injected_names = []
        for message in result[1:]:
            part = _load_skill_part(message)
            assert isinstance(part.input, dict)
            injected_names.append(part.input["skill_name"])
        assert injected_names == ["annotate-spans", "debug-trace"]

    def test_synthetic_pair_adapts_to_pydantic_ai_messages(self) -> None:
        messages = [_user_message("/debug-trace help")]
        result = _inject(messages, ["debug-trace"], [_make_skill("debug-trace")])
        pydantic_ai_messages = TypeAdapter(list[PydanticAIUIMessage]).validate_python(
            [
                message.model_dump(mode="json", by_alias=True, exclude_none=True)
                for message in result
            ]
        )
        history = VercelAIAdapter.load_messages(pydantic_ai_messages)
        part_types = [type(part).__name__ for message in history for part in message.parts]
        assert "ToolCallPart" in part_types
        assert "ToolReturnPart" in part_types


class TestResolveRequestedSkills:
    def test_resolves_available_in_request_order(self) -> None:
        available = [_make_skill("debug-trace"), _make_skill("annotate-spans")]
        resolved = resolve_requested_skills(
            messages=[_user_message("hi")],
            requested_skill_names=["annotate-spans", "debug-trace"],
            available_skills=available,
        )
        assert [skill.name for skill in resolved] == ["annotate-spans", "debug-trace"]

    def test_drops_unavailable_and_dedupes(self) -> None:
        resolved = resolve_requested_skills(
            messages=[_user_message("hi")],
            requested_skill_names=["debug-trace", "nope", "debug-trace"],
            available_skills=[_make_skill("debug-trace")],
        )
        assert [skill.name for skill in resolved] == ["debug-trace"]

    def test_empty_when_no_requested(self) -> None:
        resolved = resolve_requested_skills(
            messages=[_user_message("hi")],
            requested_skill_names=[],
            available_skills=[_make_skill("debug-trace")],
        )
        assert resolved == []


class TestIterRequestedSkillResponseChunks:
    def test_emits_step_framed_tool_chunks_per_skill(self) -> None:
        skills = [_make_skill("debug-trace"), _make_skill("annotate-spans")]
        chunks = list(
            iter_requested_skill_response_chunks(
                skills=skills,
                load_skill_template=_LOAD_SKILL_TEMPLATE,
            )
        )
        types = [chunk.model_dump(by_alias=True)["type"] for chunk in chunks]
        # one start-step / tool-input / tool-output / finish-step per skill
        assert types == [
            "start-step",
            "tool-input-available",
            "tool-output-available",
            "finish-step",
            "start-step",
            "tool-input-available",
            "tool-output-available",
            "finish-step",
        ]

    def test_tool_chunks_share_call_id_and_carry_skill(self) -> None:
        chunks = [
            chunk.model_dump(by_alias=True)
            for chunk in iter_requested_skill_response_chunks(
                skills=[_make_skill("debug-trace")],
                load_skill_template=_LOAD_SKILL_TEMPLATE,
            )
        ]
        input_chunk = next(c for c in chunks if c["type"] == "tool-input-available")
        output_chunk = next(c for c in chunks if c["type"] == "tool-output-available")
        assert input_chunk["toolName"] == LOAD_SKILL_TOOL_NAME
        assert input_chunk["input"] == {"skill_name": "debug-trace"}
        # the call id ties the input and output together for one rendered card
        assert input_chunk["toolCallId"] == output_chunk["toolCallId"]
        assert "body for debug-trace" in output_chunk["output"]

    def test_no_skills_emits_nothing(self) -> None:
        chunks = list(
            iter_requested_skill_response_chunks(
                skills=[],
                load_skill_template=_LOAD_SKILL_TEMPLATE,
            )
        )
        assert chunks == []
