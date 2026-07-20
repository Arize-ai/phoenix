"""Force-loading user-requested skills into the chat turn.

When the user invokes a skill through the prompt's slash-command affordance, the
browser sends the skill names in ``requestedSkills`` rather than relying on the
model to discover and load them. This module force-loads each requested skill in
two coordinated ways:

1. **Model side** — synthetic ``load_skill`` tool call/result pairs are appended
   to the tail of the message history so the model sees the skill as already
   loaded this turn, identical in shape to a skill it loaded itself. Appending
   at the tail (rather than mutating the prefix) preserves the provider
   prompt-cache prefix; see the per-turn-context guidance for the same principle.
2. **Client side** — matching ``tool-input-available`` / ``tool-output-available``
   response chunks are streamed at the start of the turn so the browser records
   and renders the same ``load_skill`` invocation. This keeps the user-visible
   transcript in sync with what the model received, and the parts flow back in
   the history on the next turn (where dedupe prevents a re-load).
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Iterable, Iterator, Sequence
from typing import Any, TypeVar

from jinja2 import Template
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    FinishStepChunk,
    StartStepChunk,
    ToolInputAvailableChunk,
    ToolOutputAvailableChunk,
)

from phoenix.db.types.data_stream_protocol import UIMessage, UIToolPart
from phoenix.server.agents.capabilities.skills import Skill

logger = logging.getLogger(__name__)

UIMessageT = TypeVar("UIMessageT", bound=UIMessage)

LOAD_SKILL_TOOL_NAME = "load_skill"

# Vercel AI represents a static (non-dynamic) tool part with a type of
# ``tool-<toolName>``. The adapter relies on this prefix to recover the tool
# name when converting the part into a pydantic-ai ``ToolCallPart``.
_LOAD_SKILL_PART_TYPE = f"tool-{LOAD_SKILL_TOOL_NAME}"


def _iter_loaded_skill_names(messages: Iterable[UIMessage]) -> set[str]:
    """Return the set of skill names already loaded anywhere in the history.

    Covers both organically loaded skills (the model called ``load_skill``) and
    previously injected synthetic loads, so a repeated request is a no-op.
    """
    loaded: set[str] = set()
    for message in messages:
        for part in message.parts:
            part_type = getattr(part, "type", None)
            if part_type != _LOAD_SKILL_PART_TYPE:
                continue
            tool_input: Any = getattr(part, "input", None)
            if isinstance(tool_input, dict):
                skill_name = tool_input.get("skill_name")
                if isinstance(skill_name, str):
                    loaded.add(skill_name)
    return loaded


def resolve_requested_skills(
    *,
    messages: Iterable[UIMessage],
    requested_skill_names: Sequence[str],
    available_skills: Sequence[Skill],
) -> list[Skill]:
    """Resolve requested skill names to the skills that should be force-loaded.

    Applies the same gating used by both the history injection and the streamed
    response chunks, so the two stay perfectly in sync: order preserved, request
    duplicates removed, unavailable names dropped, and skills already loaded in
    the history skipped.

    Args:
        messages: The chat message history from the request body.
        requested_skill_names: Skill names the user requested via slash command.
        available_skills: The skills available for this turn's context.

    Returns:
        The ordered list of skills to force-load this turn (possibly empty).
    """
    if not requested_skill_names:
        return []

    skills_by_name = {skill.name: skill for skill in available_skills}
    already_loaded = _iter_loaded_skill_names(messages)

    resolved: list[Skill] = []
    seen_in_request: set[str] = set()
    for name in requested_skill_names:
        if name in seen_in_request:
            continue
        seen_in_request.add(name)
        if name in already_loaded:
            continue
        skill = skills_by_name.get(name)
        if skill is None:
            logger.debug("Ignoring unavailable requested skill %r", name)
            continue
        resolved.append(skill)
    return resolved


def _synthetic_tool_call_id(skill: Skill) -> str:
    """Build a stable-per-turn tool call id shared by the history part and the
    streamed chunks for one forced skill load."""
    return f"requested-skill-{skill.name}-{uuid.uuid4().hex}"


def _build_synthetic_load_skill_message(
    *,
    skill: Skill,
    rendered_content: str,
    tool_call_id: str,
    message_factory: type[UIMessageT],
) -> UIMessageT:
    """Build an assistant message carrying a completed ``load_skill`` call.

    The rendered skill body is identical to what the live ``load_skill`` tool
    would return, so the model cannot distinguish a forced load from an organic
    one. ``message_factory`` keeps the synthetic message the same concrete type
    as the surrounding history, so the homogeneous request list is preserved.
    """
    part = UIToolPart(
        type=_LOAD_SKILL_PART_TYPE,
        toolCallId=tool_call_id,
        state="output-available",
        input={"skill_name": skill.name},
        output=rendered_content,
    )
    return message_factory(id=f"requested-skill-{uuid.uuid4().hex}", role="assistant", parts=[part])


def inject_requested_skills(
    *,
    messages: Sequence[UIMessageT],
    requested_skill_names: Sequence[str],
    available_skills: Sequence[Skill],
    load_skill_template: Template,
    message_factory: type[UIMessageT],
) -> list[UIMessageT]:
    """Append synthetic ``load_skill`` results for user-requested skills.

    Args:
        messages: The chat message history from the request body.
        requested_skill_names: Skill names the user requested via slash command.
            Order is preserved; duplicates within the request are de-duplicated.
        available_skills: The skills available for this turn's context. Names not
            present here are silently ignored (the skill is not loadable now).
        load_skill_template: The template used to render a loaded skill, shared
            with the live skills toolset so forced and organic loads match.
        message_factory: The concrete ``UIMessage`` subclass to construct for
            synthetic messages, matching the request's message type.

    Returns:
        A new message list with synthetic assistant messages appended at the
        tail. The input prefix is left byte-identical so the prompt cache is
        preserved. Returns the messages unchanged (as a new list) when there is
        nothing to inject.
    """
    result = list(messages)
    resolved = resolve_requested_skills(
        messages=messages,
        requested_skill_names=requested_skill_names,
        available_skills=available_skills,
    )
    for skill in resolved:
        result.append(
            _build_synthetic_load_skill_message(
                skill=skill,
                rendered_content=load_skill_template.render(skill=skill),
                tool_call_id=_synthetic_tool_call_id(skill),
                message_factory=message_factory,
            )
        )
    return result


def iter_requested_skill_response_chunks(
    *,
    skills: Sequence[Skill],
    load_skill_template: Template,
) -> Iterator[BaseChunk]:
    """Yield response-stream chunks that render a forced ``load_skill`` call.

    Emits one Vercel AI step per skill — ``start-step``, ``tool-input-available``,
    ``tool-output-available``, ``finish-step`` — matching the chunk sequence an
    organic tool call produces, so the browser records and renders each forced
    load exactly like a model-initiated one.

    The caller is responsible for placing these chunks after the stream's opening
    ``start`` chunk and before the model's own output.

    Args:
        skills: The already-resolved skills to force-load (see
            :func:`resolve_requested_skills`).
        load_skill_template: The template used to render a loaded skill.
    """
    for skill in skills:
        tool_call_id = _synthetic_tool_call_id(skill)
        rendered = load_skill_template.render(skill=skill)
        yield StartStepChunk()
        yield ToolInputAvailableChunk(
            tool_call_id=tool_call_id,
            tool_name=LOAD_SKILL_TOOL_NAME,
            input={"skill_name": skill.name},
        )
        yield ToolOutputAvailableChunk(
            tool_call_id=tool_call_id,
            output=rendered,
        )
        yield FinishStepChunk()
