# mypy: ignore-errors
"""
Customer service agent using the OpenAI Agents SDK.

Defines the agent and the multi-turn conversation loop. The agent is
created with the retail policy as its system prompt and all 16 tools
registered. The conversation loop passes messages between the agent
and the simulated user until termination.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from uuid import uuid4

from agents import Agent, ModelSettings, Runner
from openinference.instrumentation import using_attributes
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import trace as trace_api

from .db import load_data
from .tools import ALL_TOOLS, TERMINATE_TOOLS, set_data
from .user_sim import SimulatedUser

# Add vendor path for tau-bench imports
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.types import Task

# Load the retail policy from wiki.md
_WIKI_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "vendor",
    "tau-bench",
    "tau_bench",
    "envs",
    "retail",
    "wiki.md",
)
with open(_WIKI_PATH) as f:
    RETAIL_POLICY = f.read()

_TRACER = trace_api.get_tracer(__name__)


@dataclass
class ConversationResult:
    """Result of running a single task conversation."""

    task_id: str  # e.g. "dev:0", "train:35"
    task: Task
    turns: list[dict[str, str]] = field(default_factory=list)
    terminated_by: str = ""  # "user_stop", "transfer_to_human", "max_turns"
    tool_calls_made: list[dict[str, object]] = field(default_factory=list)


def create_agent() -> Agent[None]:
    """Create the retail customer service agent.

    Uses the retail wiki policy as the system prompt and registers
    all 16 tau-bench retail tools. Temperature is set to 0 for
    reproducibility, and parallel_tool_calls is disabled to match
    tau-bench's single-tool-per-turn convention.
    """
    return Agent(
        name="RetailAgent",
        instructions=RETAIL_POLICY,
        tools=ALL_TOOLS,
        model="gpt-4o",
        model_settings=ModelSettings(
            temperature=0.0,
            parallel_tool_calls=False,
        ),
    )


async def run_conversation(
    agent: Agent[None],
    task_id: str,
    task: Task,
    user_model: str = "gpt-4o",
    max_turns: int = 30,
) -> ConversationResult:
    """Run a multi-turn conversation between the agent and simulated user.

    This is the outer loop that is NOT part of the instrumented framework.
    Only the agent's work (LLM calls + tool executions inside Runner.run)
    produces traces. The simulated user is external, just like a real user.

    Args:
        agent: The OpenAI Agents SDK Agent instance.
        task_id: Task label like "dev:0" or "train:35".
        task: The tau-bench Task with instruction and ground truth.
        user_model: Model for the simulated user. Defaults to gpt-4o.
        max_turns: Maximum conversation turns before forced termination.

    Returns:
        ConversationResult with conversation history and metadata.
    """
    # Fresh database for this task
    data = load_data()
    set_data(data)

    result = ConversationResult(task_id=task_id, task=task)
    # Use a stable OpenInference session id for all turns in this task conversation.
    # Phoenix can group multiple traces into one "Session" via session.id.
    session_id = f"tau-bench-task-{task_id}-{uuid4().hex[:8]}"
    user_id = f"sim-user-task-{task_id}"

    # Initialize simulated user
    user = SimulatedUser(model=user_model, provider="openai")
    user_message = user.reset(task.instruction)
    result.turns.append({"role": "user", "content": user_message})

    # Build initial input for the agent
    agent_input: str | list[object] = user_message

    for turn in range(max_turns):
        # Run agent turn — this is the instrumented part.
        # The SDK handles: LLM call → tool calls (if any) → final text response.
        # Each of these steps produces OTel spans via OpenInference.
        turn_input = str(user_message)
        with using_attributes(
            session_id=session_id,
            user_id=user_id,
            metadata={"task_id": task_id, "turn_index": turn},
            tags=["tau-bench", "openai-agents-sdk"],
        ):
            with _TRACER.start_as_current_span("conversation.turn") as turn_span:
                turn_span.set_attribute(
                    SpanAttributes.OPENINFERENCE_SPAN_KIND,
                    OpenInferenceSpanKindValues.AGENT.value,
                )
                turn_span.set_attribute(SpanAttributes.SESSION_ID, session_id)
                turn_span.set_attribute(SpanAttributes.USER_ID, user_id)
                turn_span.set_attribute(SpanAttributes.INPUT_VALUE, turn_input)
                run_result = await Runner.run(
                    starting_agent=agent,
                    input=agent_input,
                    max_turns=10,  # max tool-call loops within a single agent turn
                )
                # Set plain-text IO on a stable per-turn span so Session timeline
                # can render readable HUMAN/AI bubbles.
                agent_response = str(run_result.final_output or "")
                turn_span.set_attribute(SpanAttributes.OUTPUT_VALUE, agent_response)

        # Track tool calls from this turn
        for item in run_result.new_items:
            # RunItem types include tool call items
            item_type = type(item).__name__
            if "ToolCall" in item_type:
                call_info = {
                    "type": item_type,
                }
                # Try to extract tool call details
                if hasattr(item, "raw_item"):
                    raw = item.raw_item
                    if hasattr(raw, "name"):
                        call_info["name"] = raw.name
                    if hasattr(raw, "arguments"):
                        call_info["arguments"] = raw.arguments
                    if hasattr(raw, "call_id"):
                        call_info["call_id"] = raw.call_id
                result.tool_calls_made.append(call_info)

        result.turns.append({"role": "assistant", "content": str(agent_response)})

        # Check for terminal tool calls (transfer_to_human_agents)
        transfer_called = any(tc.get("name") in TERMINATE_TOOLS for tc in result.tool_calls_made)
        if transfer_called:
            result.terminated_by = "transfer_to_human"
            break

        # Pass agent response to simulated user
        user_message = user.step(str(agent_response))
        result.turns.append({"role": "user", "content": user_message})

        if SimulatedUser.is_stop(user_message):
            result.terminated_by = "user_stop"
            break

        # Continue conversation: build input for next agent turn
        # Use to_input_list() to carry forward the full conversation context
        agent_input = run_result.to_input_list() + [{"role": "user", "content": user_message}]
    else:
        result.terminated_by = "max_turns"

    return result
