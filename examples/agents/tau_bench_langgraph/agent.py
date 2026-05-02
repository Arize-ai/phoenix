# mypy: ignore-errors
"""
Customer service agent using LangGraph.

Defines the agent graph and the multi-turn conversation loop. The agent
is a StateGraph(MessagesState) with:
  - "agent" node: ChatOpenAI with bound tools
  - "tools" node: ToolNode for automatic tool execution
  - Conditional edge: if tool_calls → "tools", else → END
  - Edge: "tools" → "agent"

The conversation loop passes messages between the agent graph and the
simulated user until termination (user stop, transfer to human, or max turns).

Architecture notes:
  - The graph is compiled once and reused across turns.
  - Each user turn appends a HumanMessage and invokes the graph.
  - The graph handles the internal agent→tool→agent loop within a single turn.
  - Between turns, we carry forward the full message history.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import Literal
from uuid import uuid4

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from openinference.instrumentation import using_attributes
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import trace as trace_api

from .db import load_data
from .tools import ALL_TOOLS, TERMINATE_TOOLS, set_data

# Add vendor path for tau-bench imports
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.types import Task

# Re-import user_sim from the shared location (same SimulatedUser logic)
from .user_sim import SimulatedUser

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


def create_agent_graph(model: str = "gpt-4o"):
    """Create the retail customer service agent as a LangGraph StateGraph.

    Uses the retail wiki policy as the system prompt and registers
    all 16 tau-bench retail tools. Temperature is set to 0 for
    reproducibility, and parallel_tool_calls is disabled to match
    tau-bench's single-tool-per-turn convention.

    Args:
        model: OpenAI model name. Defaults to gpt-4o.

    Returns:
        Compiled LangGraph graph.
    """
    llm = ChatOpenAI(
        model=model,
        temperature=0,
    ).bind_tools(ALL_TOOLS, parallel_tool_calls=False)

    def call_model(state: MessagesState) -> dict:
        messages = state["messages"]
        response = llm.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
        messages = state["messages"]
        last_message = messages[-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return END

    workflow = StateGraph(MessagesState)

    tool_node = ToolNode(ALL_TOOLS)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue)
    workflow.add_edge("tools", "agent")

    return workflow.compile()


def run_conversation(
    graph,
    task_id: str,
    task: Task,
    user_model: str = "gpt-4o",
    max_turns: int = 30,
) -> ConversationResult:
    """Run a multi-turn conversation between the LangGraph agent and simulated user.

    This is the outer loop that is NOT part of the instrumented framework.
    Only the agent's work (LLM calls + tool executions inside graph.invoke)
    produces traces. The simulated user is external, just like a real user.

    Args:
        graph: The compiled LangGraph agent graph.
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

    # Build conversation state: start with system prompt + first user message
    messages: list[BaseMessage] = [
        SystemMessage(content=RETAIL_POLICY),
        HumanMessage(content=user_message),
    ]

    for turn in range(max_turns):
        # Run agent turn — this is the instrumented part.
        # The LangGraph graph handles: LLM call → tool calls (if any) → final text response.
        # LangChainInstrumentor auto-instruments all of these as OTel spans.
        turn_input = str(user_message)
        with using_attributes(
            session_id=session_id,
            user_id=user_id,
            metadata={"task_id": task_id, "turn_index": turn},
            tags=["tau-bench", "langgraph"],
        ):
            with _TRACER.start_as_current_span("conversation.turn") as turn_span:
                turn_span.set_attribute(
                    SpanAttributes.OPENINFERENCE_SPAN_KIND,
                    OpenInferenceSpanKindValues.AGENT.value,
                )
                turn_span.set_attribute(SpanAttributes.SESSION_ID, session_id)
                turn_span.set_attribute(SpanAttributes.USER_ID, user_id)
                turn_span.set_attribute(SpanAttributes.INPUT_VALUE, turn_input)

                final_state = graph.invoke({"messages": messages})

                # Extract the final AI text response
                result_messages = final_state["messages"]
                agent_response = ""
                last_ai = None
                for msg in reversed(result_messages):
                    if isinstance(msg, AIMessage) and not msg.tool_calls:
                        last_ai = msg
                        break
                agent_response = last_ai.content if last_ai else ""

                turn_span.set_attribute(SpanAttributes.OUTPUT_VALUE, agent_response)

        # Track tool calls from this turn's messages (only new ones since input)
        input_len = len(messages)
        new_messages = result_messages[input_len:]
        for msg in new_messages:
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    result.tool_calls_made.append(
                        {
                            "name": tc["name"],
                            "args": tc["args"],
                        }
                    )

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

        # Update messages for next turn: use the full state from the graph
        # plus the new user message
        messages = result_messages + [HumanMessage(content=user_message)]
    else:
        result.terminated_by = "max_turns"

    return result
