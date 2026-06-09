from typing import Any, Awaitable, Protocol
from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

# The networkless bash tool depends on just-bash, which requires Python >= 3.11.
# Skip the whole module on interpreters where it is not installed (e.g. 3.10).
pytest.importorskip("just_bash")

from phoenix.server.agents.capabilities.tools.internal.bash import (  # noqa: E402
    BashToolset,
    _build_runtime,
    bash_tool_available,
)
from phoenix.server.api.context import Context  # noqa: E402


@strawberry.type
class Project:
    name: str


@strawberry.type
class Query:
    @strawberry.field
    def projects(self) -> list[Project]:
        return [Project(name="alpha"), Project(name="beta")]

    @strawberry.field
    def boom(self) -> str:
        raise ValueError("kaboom")


@strawberry.type
class Mutation:
    @strawberry.mutation
    def delete_everything(self) -> str:
        return "deleted"


def _schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query, mutation=Mutation)


class _Runtime(Protocol):
    def exec(self, command: str) -> Awaitable[Any]: ...


@pytest.fixture
def runtime() -> _Runtime:
    return _build_runtime(
        schema=_schema(),
        build_graphql_context=lambda: Mock(spec=Context),
    )


def test_bash_tool_available() -> None:
    assert bash_tool_available() is True


async def test_phoenix_gql_returns_data(runtime: _Runtime) -> None:
    result = await runtime.exec("phoenix-gql '{ projects { name } }'")

    assert result.exit_code == 0
    assert '"name": "alpha"' in result.stdout
    assert result.stdout.strip().startswith('{\n  "data"')


async def test_phoenix_gql_piped_through_jq(runtime: _Runtime) -> None:
    result = await runtime.exec(
        "phoenix-gql '{ projects { name } }' | jq -r '.data.projects[].name'"
    )

    assert result.exit_code == 0
    assert result.stdout == "alpha\nbeta\n"


async def test_phoenix_gql_data_only(runtime: _Runtime) -> None:
    result = await runtime.exec(
        "phoenix-gql '{ projects { name } }' --data-only | jq '.projects | length'"
    )

    assert result.exit_code == 0
    assert result.stdout.strip() == "2"


async def test_phoenix_gql_reads_query_from_file_and_stdin(runtime: _Runtime) -> None:
    await runtime.exec("echo '{ projects { name } }' > /home/user/workspace/q.graphql")

    from_file = await runtime.exec("phoenix-gql q.graphql | jq '.data.projects | length'")
    assert from_file.stdout.strip() == "2"

    from_stdin = await runtime.exec("cat q.graphql | phoenix-gql | jq '.data.projects | length'")
    assert from_stdin.stdout.strip() == "2"


async def test_phoenix_gql_vars_file(runtime: _Runtime) -> None:
    # introspection query that takes a variable, proving --vars-file is wired up
    await runtime.exec('echo \'{"n":"Project"}\' > /home/user/workspace/vars.json')
    query = "query($n: String!) { __type(name: $n) { name } }"
    result = await runtime.exec(
        f"phoenix-gql '{query}' --vars-file vars.json --data-only | jq -r '.__type.name'"
    )

    assert result.exit_code == 0
    assert result.stdout.strip() == "Project"


async def test_phoenix_gql_output_to_file(runtime: _Runtime) -> None:
    result = await runtime.exec(
        "phoenix-gql '{ projects { name } }' --output /home/user/workspace/out.json"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "/home/user/workspace/out.json"

    contents = await runtime.exec("jq -r '.data.projects[0].name' /home/user/workspace/out.json")
    assert contents.stdout.strip() == "alpha"


async def test_phoenix_gql_rejects_mutation(runtime: _Runtime) -> None:
    result = await runtime.exec("phoenix-gql 'mutation { deleteEverything }'")

    assert result.exit_code == 1
    assert "read-only" in result.stderr


async def test_phoenix_gql_rejects_subscription(runtime: _Runtime) -> None:
    result = await runtime.exec("phoenix-gql 'subscription { projects { name } }'")

    assert result.exit_code == 1
    assert "subscription" in result.stderr.lower()


async def test_phoenix_gql_execution_error_reported(runtime: _Runtime) -> None:
    result = await runtime.exec("phoenix-gql '{ boom }'")

    assert result.exit_code == 1
    assert "kaboom" in result.stderr


async def test_phoenix_gql_help(runtime: _Runtime) -> None:
    result = await runtime.exec("phoenix-gql --help")

    assert result.exit_code == 0
    assert "Usage: phoenix-gql" in result.stdout


async def test_bash_toolset_runs_builtin_command() -> None:
    toolset = BashToolset(
        schema=_schema(),
        build_graphql_context=lambda: Mock(spec=Context),
    )
    ctx: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())
    tools = await toolset.get_tools(ctx)
    result = await toolset.call_tool(
        "bash",
        {"command": "echo hello | tr a-z A-Z", "summary": "shout hello"},
        ctx,
        tools["bash"],
    )

    assert result == "HELLO\n"
