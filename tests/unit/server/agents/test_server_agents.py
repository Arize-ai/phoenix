from __future__ import annotations

from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel

from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.server_agents import build_delegated_server_agent, build_server_agent
from phoenix.server.agents.types import AgentDependencies
from phoenix.server.api.context import Context


@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"


@pytest.fixture
def schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query)


@pytest.fixture
def model() -> TestModel:
    """Model that advertises tools without calling any of them."""
    return TestModel(call_tools=[])


@pytest.fixture
def deps() -> AgentDependencies:
    return AgentDependencies(contexts=ResolvedContexts())


async def test_skills_toolset_advertised(
    model: TestModel,
    schema: strawberry.Schema,
    deps: AgentDependencies,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
    )
    await agent.run("hi", deps=deps)

    assert model.last_model_request_parameters is not None
    tool_names = {tool.name for tool in model.last_model_request_parameters.function_tools}
    assert "bash" in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names
    assert "call_subagent" not in tool_names


async def test_call_subagent_toolset_advertised_when_delegate_provided(
    model: TestModel,
    schema: strawberry.Schema,
    deps: AgentDependencies,
) -> None:
    delegated_agent = build_delegated_server_agent(
        model=TestModel(call_tools=[]),
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
    )
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        server_agent=delegated_agent,
    )
    await agent.run("hi", deps=deps)

    assert model.last_model_request_parameters is not None
    tool_names = {tool.name for tool in model.last_model_request_parameters.function_tools}
    assert "call_subagent" in tool_names


async def test_skill_catalog_rendered_into_instructions(
    model: TestModel,
    schema: strawberry.Schema,
    deps: AgentDependencies,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
    )
    result = await agent.run("hi", deps=deps)

    instructions = result.all_messages()[0].instructions  # type: ignore[union-attr]
    assert instructions is not None
    assert "<available_skills>" in instructions
    assert "phoenix-graphql" in instructions
