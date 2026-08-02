from __future__ import annotations

from pathlib import Path
from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.capabilities.tools.internal.bash import SKILLS_ROOT
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.api.context import Context
from phoenix.server.types import DbSessionFactory


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


async def test_call_subagent_toolset_advertised_when_enabled(
    model: TestModel,
    schema: strawberry.Schema,
    db: DbSessionFactory,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        db=db,
        event_queue=Mock(),
        enable_subagents=True,
    )
    await agent.run("hi")

    assert model.last_model_request_parameters is not None
    tool_names = {tool.name for tool in model.last_model_request_parameters.function_tools}
    assert "call_subagent" in tool_names


async def test_skill_catalog_rendered_into_instructions(
    model: TestModel,
    schema: strawberry.Schema,
    db: DbSessionFactory,
) -> None:
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        db=db,
        event_queue=Mock(),
    )
    result = await agent.run("hi")

    instructions = result.all_messages()[0].instructions  # type: ignore[union-attr]
    assert instructions is not None
    assert "<available_skills>" in instructions
    assert "phoenix-graphql" in instructions
    assert "span-coding" in instructions
    assert f"{SKILLS_ROOT}/phoenix-graphql/" in instructions
    assert f"{SKILLS_ROOT}/span-coding/" in instructions
    assert "load_skill" not in instructions
    assert "read_skill_resource" not in instructions


async def test_external_skills_are_mounted_and_tagged_third_party(
    model: TestModel,
    schema: strawberry.Schema,
    db: DbSessionFactory,
    tmp_path: Path,
) -> None:
    """External skills reach the model, but flagged as untrusted reference data."""
    skill_dir = tmp_path / "vendor-skill"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: vendor-skill\ndescription: A vendor skill.\n---\n\nVendor body.\n",
        encoding="utf-8",
    )
    external = Skill.from_file(skill_dir / "SKILL.md")

    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        db=db,
        event_queue=Mock(),
        external_skills=[external],
    )
    result = await agent.run("hi")

    instructions = result.all_messages()[0].instructions  # type: ignore[union-attr]
    assert instructions is not None
    assert f"{SKILLS_ROOT}/vendor-skill/" in instructions
    assert "<provenance>third-party</provenance>" in instructions
    assert "untrusted reference data" in instructions
    # Built-in skills stay marked built-in, so the distinction is visible.
    assert "<provenance>built-in</provenance>" in instructions


async def test_no_third_party_warning_without_external_skills(
    model: TestModel,
    schema: strawberry.Schema,
    db: DbSessionFactory,
) -> None:
    """The default deployment must not carry warnings about skills it does not have."""
    agent = build_server_agent(
        model=model,
        schema=schema,
        build_graphql_context=lambda: Mock(spec=Context),
        db=db,
        event_queue=Mock(),
    )
    result = await agent.run("hi")

    instructions = result.all_messages()[0].instructions  # type: ignore[union-attr]
    assert instructions is not None
    assert "third-party" not in instructions
    assert "untrusted reference data" not in instructions
