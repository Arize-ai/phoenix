# mypy: ignore-errors
"""
LangGraph agent for TRAJECT-Bench tasks.

Builds a StateGraph per task with dynamically created mock tools.
Single-turn: the agent receives one query and produces a final answer,
potentially calling multiple tools along the way.

Architecture:
    StateGraph(MessagesState)
      - "agent" node: ChatOpenAI with bound tools
      - "tools" node: ToolNode for automatic tool execution
      - Conditional edge: if tool_calls → "tools", else → END
      - Edge: "tools" → "agent"
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from .tasks import TrajectTask
from .tools import create_mock_tools, get_expected_tool_calls


@dataclass
class TaskResult:
    """Result of running a single TRAJECT-Bench task."""

    task_label: str
    config: str
    trajectory_type: str
    query: str
    final_answer_expected: str
    final_answer_actual: str = ""
    tool_calls_made: list[dict] = field(default_factory=list)
    tool_calls_expected: list[dict] = field(default_factory=list)
    error: str | None = None


def _build_system_prompt(task: TrajectTask) -> str:
    """Build the system prompt for a task.

    Includes the task description and tool listing so the agent
    understands the available tools and what it should accomplish.
    """
    parts = [
        "You are a helpful assistant that answers user queries by calling the available tools.",
        "Use the tools provided to gather information, then synthesize a complete answer.",
        "",
        f"Task: {task.task_description}",
        "",
        "Available tools and their purposes:",
    ]

    for tool_def in task.tools:
        name = tool_def.get("tool name", "Unknown")
        desc = tool_def.get("tool description", "No description")
        required = tool_def.get("required parameters", [])
        optional = tool_def.get("optional parameters", [])

        parts.append(f"\n- {name}: {desc}")
        if required:
            req_names = [p["name"] for p in required]
            parts.append(f"  Required params: {', '.join(req_names)}")
        if optional:
            opt_names = [p["name"] for p in optional]
            parts.append(f"  Optional params: {', '.join(opt_names)}")

    if task.trajectory_type == "parallel":
        parts.append(
            "\nThese tools are independent — you can call them all at once "
            "without waiting for results from one before calling another."
        )
    else:
        parts.append(
            "\nThese tools form a sequence — each step may depend on the "
            "output of the previous step. Call them in order."
        )

    parts.append(
        "\nAfter gathering all tool results, provide a comprehensive answer to the user's query."
    )

    return "\n".join(parts)


def create_agent_graph(task: TrajectTask, model: str = "gpt-4o") -> tuple:
    """Create a LangGraph StateGraph for a TRAJECT-Bench task.

    Builds the graph fresh per task since each task has different tools.
    No checkpointer needed — single-turn execution only.

    Args:
        task: The TRAJECT-Bench task with tool definitions.
        model: OpenAI model name. Defaults to gpt-4o.

    Returns:
        Tuple of (compiled graph, list of mock tools, system prompt).
    """
    # Create mock tools from task definitions
    mock_tools = create_mock_tools(task.tools)

    # Set up the LLM with bound tools
    parallel = task.trajectory_type == "parallel"
    llm = ChatOpenAI(
        model=model,
        temperature=0,
    ).bind_tools(mock_tools, parallel_tool_calls=parallel)

    # Build the system prompt
    system_prompt = _build_system_prompt(task)

    # Define the agent node
    def call_model(state: MessagesState) -> dict:
        messages = state["messages"]
        response = llm.invoke(messages)
        return {"messages": [response]}

    # Define routing logic
    def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
        messages = state["messages"]
        last_message = messages[-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return END

    # Build the graph
    workflow = StateGraph(MessagesState)

    tool_node = ToolNode(mock_tools)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue)
    workflow.add_edge("tools", "agent")

    # Compile without checkpointer (single-turn, no conversation state)
    graph = workflow.compile()

    return graph, mock_tools, system_prompt


def run_task(task: TrajectTask, model: str = "gpt-4o") -> TaskResult:
    """Run a single TRAJECT-Bench task through the LangGraph agent.

    Creates the agent graph, invokes it with the task query, and
    collects results including tool calls made and final answer.

    Args:
        task: The TRAJECT-Bench task to run.
        model: OpenAI model name. Defaults to gpt-4o.

    Returns:
        TaskResult with tool calls made, final answer, and ground truth comparison.
    """
    result = TaskResult(
        task_label=task.label,
        config=task.config,
        trajectory_type=task.trajectory_type,
        query=task.query,
        final_answer_expected=task.final_answer,
        tool_calls_expected=get_expected_tool_calls(task.tools),
    )

    try:
        graph, mock_tools, system_prompt = create_agent_graph(task, model=model)

        # Invoke the graph with the task query
        initial_messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=task.query),
        ]

        final_state = graph.invoke({"messages": initial_messages})

        # Extract results from final state
        messages = final_state["messages"]

        # Collect tool calls from all AI messages
        for msg in messages:
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    result.tool_calls_made.append(
                        {
                            "name": tc["name"],
                            "args": tc["args"],
                        }
                    )

        # Final answer is the last AI message content
        last_ai = None
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not msg.tool_calls:
                last_ai = msg
                break

        result.final_answer_actual = last_ai.content if last_ai else ""

    except Exception as e:
        result.error = str(e)

    return result
