from __future__ import annotations

from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel

from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.agents.skills import get_server_agent_skills
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


async def test_skills_toolset_advertised_when_skills_provided(
    model: TestModel,
    schema: strawberry.Schema,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        skills=get_server_agent_skills(),
    )
    await agent.run("hi")

    assert model.last_model_request_parameters is not None
    tool_names = {tool.name for tool in model.last_model_request_parameters.function_tools}
    assert "run_graphql_query" in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names


async def test_skill_catalog_rendered_into_instructions(
    model: TestModel,
    schema: strawberry.Schema,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        skills=get_server_agent_skills(),
    )
    result = await agent.run("hi")

    instructions = result.all_messages()[0].instructions  # type: ignore[union-attr]
    assert instructions is not None
    assert "<available_skills>" in instructions
    assert "phoenix-graphql" in instructions


async def test_no_skills_tools_without_skills(
    model: TestModel,
    schema: strawberry.Schema,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
    )
    await agent.run("hi")

    assert model.last_model_request_parameters is not None
    tool_names = {tool.name for tool in model.last_model_request_parameters.function_tools}
    assert "run_graphql_query" in tool_names
    assert "load_skill" not in tool_names
    assert "read_skill_resource" not in tool_names
