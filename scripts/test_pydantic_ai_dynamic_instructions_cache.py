"""Verify that Pydantic AI dynamic instructions sit OUTSIDE Anthropic's prompt cache.

Run 1 sends a long static instruction (cached) plus a small user message plus a
dynamic instruction (NOT cached). We assert a non-zero cache write.

Run 2 reuses the same static instructions and message history (with run 1's
response appended) but changes the deps so the dynamic instruction renders a
DIFFERENT string. If the dynamic instruction is genuinely outside the cache
boundary, run 2's cache_read_tokens must equal run 1's cache_write_tokens — the
cached prefix is bit-identical regardless of the new dynamic text.

Usage:
    ANTHROPIC_API_KEY=... uv run python scripts/test_pydantic_ai_dynamic_instructions_cache.py
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter
from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.usage import RunUsage


def _build_static_instructions() -> str:
    """Generate ~6k tokens of static instructions, unique per execution.

    Anthropic's Sonnet cache write threshold is 1024 tokens; we go well above so
    the prefix is reliably cacheable. A per-execution nonce prefix ensures the
    cache prefix doesn't collide with a prior run of this script — otherwise run
    1 could open with a cache_read from leftover cache state.
    """
    nonce = uuid.uuid4().hex
    sections: list[str] = [
        f"Session nonce (ignore, ensures cache uniqueness across runs): {nonce}.",
        "You are a meticulous research assistant who answers questions about "
        "physics, chemistry, and engineering. Always cite the underlying "
        "principle, name any relevant equation, and explain the reasoning step "
        "by step before stating the final answer.",
    ]
    topics = [
        "thermodynamics",
        "electromagnetism",
        "quantum mechanics",
        "fluid dynamics",
        "statistical mechanics",
        "solid-state physics",
        "organic chemistry",
        "inorganic chemistry",
        "biochemistry",
        "materials science",
        "control theory",
        "information theory",
        "signal processing",
        "optics",
        "acoustics",
        "plasma physics",
        "relativity",
        "nuclear physics",
        "particle physics",
        "cosmology",
    ]
    for i in range(200):
        topic = topics[i % len(topics)]
        sections.append(
            f"Reference note {i:03d} — domain: {topic}. When the user asks "
            f"about {topic}, recall first principles, identify the relevant "
            f"conserved quantities, write the governing equation in standard "
            f"form, then solve symbolically before substituting numbers. "
            f"Avoid hand-waving. Prefer SI units. Note assumptions explicitly."
        )
    return "\n\n".join(sections)


STATIC_INSTRUCTIONS = _build_static_instructions()


@dataclass
class Deps:
    """Run-time deps that drive the dynamic instruction text."""

    tone: str


agent = Agent(
    "anthropic:claude-sonnet-4-5",
    deps_type=Deps,
    instructions=STATIC_INSTRUCTIONS,
    model_settings=AnthropicModelSettings(
        anthropic_cache_instructions=True,
        anthropic_cache=True,
    ),
)


@agent.instructions
def tone_instruction(ctx: RunContext[Deps]) -> str:
    return f"Respond in a {ctx.deps.tone} tone."


def _cache_tokens(usage: RunUsage) -> tuple[int, int]:
    return usage.cache_write_tokens, usage.cache_read_tokens


_CAPTURED_ANTHROPIC_REQUESTS: list[dict[str, Any]] = []


def _install_anthropic_request_capture() -> None:
    """Wrap `client.beta.messages.create` to record the raw kwargs of each call.

    Pydantic AI's `AnthropicModel` calls `self.client.beta.messages.create(...)`
    with the fully rendered request — system blocks, messages, tools, cache
    breakpoints, the lot. Capturing the kwargs there gives us the exact JSON
    payload that will hit the Anthropic API.
    """
    model = agent.model
    assert isinstance(model, AnthropicModel), f"Unexpected model: {type(model)}"
    messages_api: Any = model.client.beta.messages
    original_create = messages_api.create

    def wrapper(**kwargs: Any) -> Any:
        _CAPTURED_ANTHROPIC_REQUESTS.append(kwargs)
        return original_create(**kwargs)

    messages_api.create = wrapper


def _truncate_strings(obj: Any, max_len: int = 240) -> Any:
    """Recursively shorten long strings so dumps stay readable."""
    if isinstance(obj, str):
        if len(obj) <= max_len:
            return obj
        head, tail = obj[: max_len // 2], obj[-max_len // 4 :]
        return f"{head}… [+{len(obj) - len(head) - len(tail)} chars] …{tail}"
    if isinstance(obj, dict):
        return {k: _truncate_strings(v, max_len) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_truncate_strings(v, max_len) for v in obj]
    return obj


def _dump_pydantic_history(history: list[ModelMessage]) -> str:
    raw = ModelMessagesTypeAdapter.dump_python(history, mode="json")
    return json.dumps(_truncate_strings(raw), indent=2, default=str)


def _dump_anthropic_request(kwargs: dict[str, Any]) -> str:
    cleaned: dict[str, Any] = {}
    for key, value in kwargs.items():
        if value is None:
            continue
        if type(value).__name__ in {"NotGiven", "Omit"}:
            continue
        cleaned[key] = value
    return json.dumps(_truncate_strings(cleaned), indent=2, default=str)


def _print_turn(label: str, history: list[ModelMessage], request_kwargs: dict[str, Any]) -> None:
    banner = "=" * 78
    print(f"\n{banner}\n{label} — pydantic message history\n{banner}")
    print(_dump_pydantic_history(history))
    print(f"\n{banner}\n{label} — rendered Anthropic request\n{banner}")
    print(_dump_anthropic_request(request_kwargs))


def main() -> None:
    _install_anthropic_request_capture()

    user_msg_1 = "Briefly explain why ice floats on water. " + ("Be thorough. " * 400)

    result1 = agent.run_sync(user_msg_1, deps=Deps(tone="formal"))
    write1, read1 = _cache_tokens(result1.usage)
    print(
        f"Run 1 — input={result1.usage.input_tokens} "
        f"cache_write={write1} cache_read={read1} "
        f"output={result1.usage.output_tokens}"
    )
    _print_turn("RUN 1", result1.all_messages(), _CAPTURED_ANTHROPIC_REQUESTS[0])

    assert write1 > 0, (
        f"Expected a non-zero cache write on run 1, got cache_write_tokens={write1}. "
        f"Full usage: {result1.usage}"
    )

    result2 = agent.run_sync(
        "Now answer the same question one more time.",
        message_history=result1.all_messages(),
        deps=Deps(tone="playful"),
    )
    write2, read2 = _cache_tokens(result2.usage)
    print(
        f"\nRun 2 — input={result2.usage.input_tokens} "
        f"cache_write={write2} cache_read={read2} "
        f"output={result2.usage.output_tokens}"
    )
    _print_turn("RUN 2", result2.all_messages(), _CAPTURED_ANTHROPIC_REQUESTS[1])

    assert read2 == write1, (
        f"Cache read on run 2 ({read2}) does not match cache write on run 1 ({write1}). "
        f"This means the dynamic instruction text changed the cached prefix, "
        f"i.e. it is INSIDE the cache boundary."
    )

    print("\nPASS: dynamic instructions are outside the cache boundary.")
    print(f"  run 1 cache_write_tokens = {write1}")
    print(f"  run 2 cache_read_tokens  = {read2}")


if __name__ == "__main__":
    main()
