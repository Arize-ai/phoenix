"""Runs one question through one arm and records what it cost.

Two numbers carry most of the argument, and they are measured separately:

- **Catalog tax** — tokens spent before the agent has done anything. Measured as
  the input tokens on the *first* model request, which is the only request whose
  prompt is just system + tools + question. Subtracting ``no_tools_baseline``
  from it leaves the tool definitions alone.
- **Data-shuttle tax** — tokens spent moving intermediate results. Measured as
  total input tokens across the run minus that first request, since every
  subsequent request re-sends the growing transcript of tool results.

Cache tokens are tracked separately and never folded into the headline numbers.
Anthropic prompt caching can make an arm with a large static catalog look
cheaper on a rerun without its context window being any smaller, and context
window pressure is what this benchmark is about.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from pydantic_ai import Agent
from pydantic_ai.messages import ModelRequest, ModelResponse, RetryPromptPart, ToolCallPart
from pydantic_ai.settings import ModelSettings
from pydantic_ai.usage import UsageLimits

from evals.mcp.harness.arms import SYSTEM_PROMPT, Arm
from evals.mcp.questions import Question

#: Hard stop per run. Generous enough that a healthy arm never reaches it, low
#: enough that an arm stuck in a paging loop fails instead of burning the budget.
DEFAULT_REQUEST_LIMIT = 30

#: Wall-clock ceiling per run, in seconds.
DEFAULT_TIMEOUT_S = 300.0

#: Output token ceiling per model request.
#:
#: Set explicitly because the Anthropic provider default of 4096 is low enough
#: to decide the benchmark on its own: an arm holding thousands of raw spans in
#: context reasons at length before answering, and exhausting the output budget
#: mid-thought aborts the run with no answer at all. That failure would be an
#: artifact of this harness, not a property of the MCP surface. Applied
#: identically everywhere, including the judge.
MAX_OUTPUT_TOKENS = 16384

#: Shared by every agent in the benchmark so no arm is advantaged by settings.
MODEL_SETTINGS = ModelSettings(max_tokens=MAX_OUTPUT_TOKENS)


@dataclass
class RunResult:
    """Everything one (arm, question) run produced."""

    arm: str
    question_id: str
    shape: str
    #: 0-based index when a cell is run more than once. Part of the identity of
    #: a run: without it, repeated runs of the same cell collide and only the
    #: last one's grade survives the join back to its judgement.
    repeat: int = 0
    answer: str = ""
    error: Optional[str] = None

    turns: int = 0
    tool_calls: int = 0
    tool_call_sequence: list[str] = field(default_factory=list)
    #: Times a tool call came back as an error the model had to correct. For
    #: code mode this is mostly the sandbox script guessing a response shape
    #: wrong on the first attempt, which is a normal part of how it works.
    tool_retries: int = 0

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    first_request_input_tokens: int = 0
    #: Largest single request's input tokens. ``input_tokens`` sums every
    #: request, and since each one re-sends the whole transcript that number
    #: measures spend, not occupancy. This one is how close the run came to
    #: filling the context window — the difference between "expensive" and
    #: "does not fit".
    peak_context_tokens: int = 0

    wall_clock_s: float = 0.0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def data_shuttle_tokens(self) -> int:
        """Input tokens beyond the opening request — the cost of moving results."""
        return max(0, self.input_tokens - self.first_request_input_tokens)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["total_tokens"] = self.total_tokens
        payload["data_shuttle_tokens"] = self.data_shuttle_tokens
        return payload


def _first_request_input_tokens(messages: list[Any]) -> int:
    """Input tokens billed on the opening request.

    That request's prompt is system + tool definitions + the question and
    nothing else, so it isolates the catalog tax before any tool result has
    entered the transcript.
    """
    for message in messages:
        if isinstance(message, ModelResponse) and message.usage is not None:
            usage = message.usage
            # A cached catalog is still a catalog occupying the window; count it.
            return usage.input_tokens + usage.cache_read_tokens + usage.cache_write_tokens
    return 0


async def run_question(
    *,
    arm: Arm,
    question: Question,
    model: str,
    repeat: int = 0,
    request_limit: int = DEFAULT_REQUEST_LIMIT,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> RunResult:
    """Run one question through one arm, capturing usage even on failure."""
    result = RunResult(arm=arm.name, question_id=question.id, shape=question.shape, repeat=repeat)
    agent = Agent(
        model,
        system_prompt=SYSTEM_PROMPT,
        toolsets=[arm.build_toolset()],
        model_settings=MODEL_SETTINGS,
    )

    started = time.monotonic()
    try:
        async with agent:
            run = await agent.run(
                question.prompt,
                usage_limits=UsageLimits(request_limit=request_limit),
            )
    except Exception as exc:  # noqa: BLE001 — a broken arm is a datapoint, not a crash
        result.error = f"{type(exc).__name__}: {exc}"
        result.wall_clock_s = round(time.monotonic() - started, 2)
        return result

    result.wall_clock_s = round(time.monotonic() - started, 2)

    usage = run.usage
    messages = run.all_messages()
    result.answer = str(run.output)
    result.turns = usage.requests
    result.tool_calls = usage.tool_calls
    result.input_tokens = usage.input_tokens
    result.output_tokens = usage.output_tokens
    result.cache_read_tokens = usage.cache_read_tokens
    result.cache_write_tokens = usage.cache_write_tokens
    result.first_request_input_tokens = _first_request_input_tokens(messages)
    result.peak_context_tokens = max(
        (
            m.usage.input_tokens + m.usage.cache_read_tokens + m.usage.cache_write_tokens
            for m in messages
            if isinstance(m, ModelResponse) and m.usage is not None
        ),
        default=0,
    )
    result.tool_call_sequence = [
        part.tool_name
        for message in messages
        if isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, ToolCallPart)
    ]
    result.tool_retries = sum(
        1
        for message in messages
        if isinstance(message, ModelRequest)
        for part in message.parts
        if isinstance(part, RetryPromptPart)
    )
    return result


@dataclass
class CatalogProbe:
    """What an arm advertises on connect, before any question is asked."""

    arm: str
    tool_count: int
    tool_names: list[str]
    schema_chars: int
    error: Optional[str] = None


async def probe_catalog(arm: Arm) -> CatalogProbe:
    """Count the tools an arm advertises, via a bare MCP client.

    Independent of any agent run: this is the raw catalog the server offers a
    client on connect, which is what a conventional integration pays for up
    front. ``schema_chars`` is the serialized size of every advertised name,
    description, and input schema.
    """
    import json

    try:
        async with arm.build_client() as client:
            tools = await client.list_tools()
    except Exception as exc:  # noqa: BLE001
        return CatalogProbe(
            arm=arm.name, tool_count=0, tool_names=[], schema_chars=0, error=str(exc)
        )

    schema_chars = sum(
        len(tool.name)
        + len(tool.description or "")
        + len(json.dumps(tool.inputSchema or {}, separators=(",", ":")))
        for tool in tools
    )
    return CatalogProbe(
        arm=arm.name,
        tool_count=len(tools),
        tool_names=sorted(tool.name for tool in tools),
        schema_chars=schema_chars,
    )


async def measure_no_tools_baseline(model: str) -> int:
    """Input tokens for the system prompt and a question, with no tools attached.

    Subtracting this from an arm's first-request input tokens leaves the cost of
    the tool definitions alone.
    """
    agent = Agent(model, system_prompt=SYSTEM_PROMPT, model_settings=MODEL_SETTINGS)
    run = await agent.run(
        "How many projects exist in this Phoenix instance? Answer with the number and nothing else.",
        usage_limits=UsageLimits(request_limit=1),
    )
    usage = run.usage
    return usage.input_tokens + usage.cache_read_tokens + usage.cache_write_tokens
