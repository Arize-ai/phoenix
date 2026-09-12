"""Exercise backend capabilities through the same entry point as live evals."""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from evals.pxi.evaluators.tools import evaluate_tools_called, tool_calls_from_output
from evals.pxi.harness import agent_task
from phoenix.server.agents.agent_factory import build_agent as real_build_agent
from phoenix.server.mcp.skills import PXI_SKILLS_ROOTS, load_skills


@pytest.fixture(autouse=True)
def no_telemetry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(agent_task, "_get_tracer_provider", lambda: None)


async def _run(monkeypatch: pytest.MonkeyPatch, respond: Any) -> dict[str, Any]:
    async def build_model() -> FunctionModel:
        return FunctionModel(respond)

    monkeypatch.setattr(agent_task, "_build_model", build_model)
    return await agent_task.run_pxi_example(
        {"messages": [{"role": "user", "content": "Inspect this experiment."}]},
        stable_example_id="backend-contract",
    )


async def test_skills_and_references_execute_with_production_definitions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    responses: Iterator[ToolCallPart | TextPart] = iter(
        [
            ToolCallPart(
                tool_name="load_skill",
                args={"skill_name": "phoenix-graphql"},
                tool_call_id="skill",
            ),
            ToolCallPart(
                tool_name="load_skill_reference",
                args={
                    "skill_name": "phoenix-graphql",
                    "reference_name": "references/experiments.md",
                },
                tool_call_id="reference",
            ),
            TextPart(content="Loaded the experiment reference."),
        ]
    )

    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        definitions = {tool.name: tool for tool in info.function_tools}
        assert {"bash", "execute", "search", "load_skill", "load_skill_reference"} <= (
            definitions.keys()
        )
        assert info.instructions is not None
        skills = load_skills(PXI_SKILLS_ROOTS)
        for skill in skills:
            assert f"<name>{skill.name}</name>" in info.instructions
        assert set(
            definitions["load_skill"].parameters_json_schema["properties"]["skill_name"]["enum"]
        ) == {skill.name for skill in skills}
        return ModelResponse(parts=[next(responses)])

    output = await _run(monkeypatch, respond)
    assert not output.get("error"), output
    assert output["assistant_text"] == "Loaded the experiment reference."
    assert (
        evaluate_tools_called(
            output, {"tools": {"required": ["load_skill", "load_skill_reference"]}}
        )["score"]
        == 1.0
    )
    returns = [
        part
        for message in output["messages"]
        for part in message["parts"]
        if part["part_kind"] == "tool-return"
    ]
    assert len(returns) == 2
    assert all("isError" not in str(part["content"]) for part in returns)
    assert "ExperimentRun" in str(returns[1]["content"])


@pytest.mark.parametrize(
    ("tool_name", "args"),
    [
        (
            "bash",
            {
                "summary": "Read experiments",
                "command": "phoenix-gql '{ datasets { edges { node { id } } } }'",
            },
        ),
        ("execute", {"code": "return await call_tool('listProjects', {})"}),
    ],
)
async def test_backend_execution_is_deferred_without_accessing_data(
    monkeypatch: pytest.MonkeyPatch, tool_name: str, args: dict[str, Any]
) -> None:
    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[ToolCallPart(tool_name=tool_name, args=args, tool_call_id="backend")]
        )

    output = await _run(monkeypatch, respond)
    assert not output.get("error"), output
    assert output["raw_output_type"] == "DeferredToolRequests"
    assert [call["tool_name"] for call in tool_calls_from_output(output)] == [tool_name]
    assert not any(
        part["part_kind"] == "tool-return"
        for message in output["messages"]
        for part in message["parts"]
    )


async def test_catalog_discovery_is_available(monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        returns = [
            part
            for message in messages
            for part in message.parts
            if isinstance(part, ToolReturnPart)
        ]
        if returns:
            assert "project" in str(returns[-1].content).lower()
            return ModelResponse(parts=[TextPart(content="Found project tools.")])
        return ModelResponse(
            parts=[
                ToolCallPart(tool_name="search", args={"query": "projects"}, tool_call_id="search")
            ]
        )

    output = await _run(monkeypatch, respond)
    assert not output.get("error"), output
    assert output["assistant_text"] == "Found project tools."


@pytest.mark.parametrize("dependency", ["phoenix_mcp_server", "schema"])
async def test_missing_backend_fails_before_model_request(
    monkeypatch: pytest.MonkeyPatch, dependency: str
) -> None:
    def build_agent(**kwargs: Any) -> Any:
        kwargs.pop(dependency)
        return real_build_agent(**kwargs)

    monkeypatch.setattr(agent_task, "build_agent", build_agent)

    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        pytest.fail("A misconfigured harness must not call the model")

    output = await _run(monkeypatch, respond)
    assert "PXI eval backend tools are missing" in output["error"]
    assert output["messages"] == []
    assert output["stable_example_id"] == "backend-contract"


async def test_shared_mcp_server_supports_concurrent_examples(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        if any(isinstance(part, ToolReturnPart) for message in messages for part in message.parts):
            return ModelResponse(parts=[TextPart(content="Loaded.")])
        return ModelResponse(
            parts=[ToolCallPart(tool_name="load_skill", args={"skill_name": "experiments"})]
        )

    async def build_model() -> FunctionModel:
        return FunctionModel(respond)

    monkeypatch.setattr(agent_task, "_build_model", build_model)
    outputs = await asyncio.gather(
        *(
            agent_task.run_pxi_example({"messages": [{"role": "user", "content": "hello"}]})
            for _ in range(3)
        )
    )
    assert all(output.get("assistant_text") == "Loaded." for output in outputs), outputs


async def test_primed_tool_inputs_match_current_agent_schemas(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from pathlib import Path

    import jsonschema
    import yaml

    from evals.pxi.harness.transcript import fixture_messages

    def respond(messages: Any, info: AgentInfo) -> ModelResponse:
        definitions = {tool.name: tool for tool in info.function_tools}
        datasets = Path(__file__).parents[4] / "evals" / "pxi" / "datasets"
        for path in sorted(datasets.glob("*.yaml")):
            for example in yaml.safe_load(path.read_text())["examples"]:
                for message in fixture_messages(example["input"]["messages"]):
                    for part in message.model_dump(by_alias=True)["parts"]:
                        if not part["type"].startswith("tool-"):
                            continue
                        name = part["type"].removeprefix("tool-")
                        assert name in definitions, (path.name, example["id"], name)
                        jsonschema.validate(part["input"], definitions[name].parameters_json_schema)
        return ModelResponse(parts=[TextPart(content="Fixture inputs match tool schemas.")])

    output = await _run(monkeypatch, respond)
    assert not output.get("error"), output
