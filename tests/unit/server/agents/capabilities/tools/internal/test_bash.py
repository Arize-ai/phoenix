import json
from typing import Any, Awaitable, Protocol
from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.capabilities.tools.internal.bash import BashToolset
from phoenix.server.api.context import Context


@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"

    @strawberry.field
    def echo(self, text: str) -> str:
        return text

    @strawberry.field
    def boom(self) -> str:
        raise ValueError("kaboom")

    @strawberry.field
    def big(self, size: int) -> str:
        return "x" * size


@strawberry.type
class Mutation:
    @strawberry.mutation
    def delete_everything(self) -> str:
        return "deleted"


class RunBash(Protocol):
    def __call__(self, command: str) -> Awaitable[dict[str, Any]]: ...


def _build_run_bash(*, allow_mutations: bool) -> RunBash:
    toolset = BashToolset(
        schema=strawberry.Schema(query=Query, mutation=Mutation),
        build_graphql_context=lambda: Mock(spec=Context),
        allow_mutations=allow_mutations,
    )
    ctx: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())

    async def run(command: str) -> dict[str, Any]:
        tools = await toolset.get_tools(ctx)
        return await toolset.call_tool("bash", {"command": command}, ctx, tools["bash"])

    return run


@pytest.fixture
def run_bash() -> RunBash:
    return _build_run_bash(allow_mutations=False)


@pytest.fixture
def run_bash_with_mutations() -> RunBash:
    return _build_run_bash(allow_mutations=True)


async def test_query_returns_data_payload(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }'")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}
    assert "[permissions: queries only]" in result["stderr"]


async def test_data_only_drops_envelope(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql --data-only '{ hello }'")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"hello": "world"}


async def test_variables_are_passed_to_query(run_bash: RunBash) -> None:
    result = await run_bash(
        "phoenix-gql 'query($text: String!) { echo(text: $text) }' --vars '{\"text\": \"hi\"}'"
    )

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"echo": "hi"}}


async def test_variables_alias_is_normalized(run_bash: RunBash) -> None:
    result = await run_bash(
        "phoenix-gql 'query($text: String!) { echo(text: $text) }' "
        '--variables \'{"text": "aliased"}\''
    )

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"echo": "aliased"}}


async def test_non_object_variables_are_rejected(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }' --vars '[1, 2]'")

    assert result["exit_code"] == 1
    assert "must be a JSON object" in result["stderr"]


async def test_query_from_stdin(run_bash: RunBash) -> None:
    result = await run_bash("echo '{ hello }' | phoenix-gql")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}


async def test_query_from_file(run_bash: RunBash) -> None:
    await run_bash("mkdir -p /home/user/workspace")
    await run_bash("printf '{ hello }' > /home/user/workspace/q.graphql")

    result = await run_bash("phoenix-gql /home/user/workspace/q.graphql")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}


async def test_mutation_rejected_when_disabled(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql 'mutation { deleteEverything }'")

    assert result["exit_code"] == 1
    assert "Mutations are not currently permitted" in result["stderr"]


async def test_mutation_allowed_when_enabled(run_bash_with_mutations: RunBash) -> None:
    result = await run_bash_with_mutations("phoenix-gql 'mutation { deleteEverything }'")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"deleteEverything": "deleted"}}
    assert "[permissions: queries + mutations]" in result["stderr"]


async def test_subscription_rejected_even_when_mutations_enabled(
    run_bash_with_mutations: RunBash,
) -> None:
    result = await run_bash_with_mutations("phoenix-gql 'subscription { hello }'")

    assert result["exit_code"] == 1
    assert "Subscriptions are not supported" in result["stderr"]


async def test_graphql_errors_are_reported(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ boom }'")

    assert result["exit_code"] == 1
    assert "GraphQL errors:" in result["stderr"]
    payload = json.loads(result["stdout"])
    assert payload["data"] is None
    assert payload["errors"]


async def test_unknown_option_errors(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql --bogus")

    assert result["exit_code"] == 1
    assert "Unknown option: --bogus" in result["stderr"]


async def test_help_reflects_permissions(
    run_bash: RunBash, run_bash_with_mutations: RunBash
) -> None:
    queries_only = await run_bash("phoenix-gql --help")
    with_mutations = await run_bash_with_mutations("phoenix-gql --help")

    assert queries_only["exit_code"] == 0
    assert "Usage: phoenix-gql" in queries_only["stdout"]
    assert "queries only (mutations are disabled)" in queries_only["stdout"]
    assert "queries and mutations are ENABLED" in with_mutations["stdout"]


async def test_output_path_writes_file(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }' --output /home/user/workspace/out.json")

    assert result["exit_code"] == 0
    output_path = result["stdout"].strip()
    assert output_path == "/home/user/workspace/out.json"

    read_back = await run_bash(f"cat {output_path}")
    assert json.loads(read_back["stdout"]) == {"data": {"hello": "world"}}


async def test_large_response_spills_to_workspace_file(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ big(size: 200000) }'")

    assert result["exit_code"] == 0
    spill = json.loads(result["stdout"])
    assert spill["spilled"] is True
    assert spill["path"].startswith("/home/user/workspace/phoenix-gql-result-")
    assert "Response exceeded stdout budget" in result["stderr"]


async def test_stdout_flag_disables_spill(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql --stdout '{ big(size: 200000) }'")

    assert result["exit_code"] == 0
    assert json.loads(result["stdout"]) == {"data": {"big": "x" * 200000}}
