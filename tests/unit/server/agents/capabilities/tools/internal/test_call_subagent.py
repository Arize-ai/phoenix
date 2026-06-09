from dataclasses import dataclass
from typing import Any
from unittest.mock import Mock

from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.capabilities.tools.internal.call_subagent import CallSubAgentToolset


@dataclass
class _Result:
    output: str


class _FakeAgent:
    """Minimal stand-in for a server agent that records its single run."""

    def __init__(self, label: str) -> None:
        self.label = label
        self.runs: list[str] = []

    async def run(self, task: str, *, deps: Any = None, usage: Any = None) -> _Result:
        self.runs.append(task)
        return _Result(output=f"{self.label}:{task}")


async def _call(toolset: CallSubAgentToolset, task: str) -> Any:
    ctx: RunContext[Any] = RunContext(deps=Mock(), model=TestModel(), usage=RunUsage())
    tools = await toolset.get_tools(ctx)
    return await toolset.call_tool(
        "call_subagent",
        {"name": "ServerAgent", "task": task},
        ctx,
        tools["call_subagent"],
    )


async def test_builds_a_fresh_server_agent_per_invocation() -> None:
    built: list[_FakeAgent] = []

    def factory() -> Any:
        agent = _FakeAgent(label=f"agent-{len(built)}")
        built.append(agent)
        return agent

    toolset = CallSubAgentToolset(server_agent_factory=factory)

    first = await _call(toolset, "task-one")
    second = await _call(toolset, "task-two")

    # A new agent is constructed for each invocation (isolated bash filesystem).
    assert len(built) == 2
    assert built[0] is not built[1]
    # Each agent ran exactly its own task.
    assert built[0].runs == ["task-one"]
    assert built[1].runs == ["task-two"]
    assert first == "agent-0:task-one"
    assert second == "agent-1:task-two"
