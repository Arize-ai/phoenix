import json
from datetime import datetime, timezone
from typing import Any, Awaitable, Protocol
from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.capabilities.tools.internal.bash import BashToolResult, BashToolset
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


def _assert_execution_metadata(result: dict[str, Any], command: str) -> None:
    """Validate the invariants every bash tool result must satisfy."""
    assert set(result) == set(BashToolResult.__annotations__)
    assert result["command"] == command
    started_at = datetime.fromisoformat(result["startedAt"])
    completed_at = datetime.fromisoformat(result["completedAt"])
    assert started_at.tzinfo == timezone.utc
    assert completed_at.tzinfo == timezone.utc
    assert started_at <= completed_at
    assert isinstance(result["durationMs"], int)
    assert result["durationMs"] >= 0
    assert result["stdoutBytes"] == len(result["stdout"].encode("utf-8"))
    assert result["stderrBytes"] == len(result["stderr"].encode("utf-8"))
    assert isinstance(result["stdoutTruncated"], bool)
    assert isinstance(result["stderrTruncated"], bool)


def _build_run_bash(*, allow_mutations: bool) -> RunBash:
    toolset = BashToolset(
        schema=strawberry.Schema(query=Query, mutation=Mutation),
        build_graphql_context=lambda: Mock(spec=Context),
        allow_mutations=allow_mutations,
    )
    ctx: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())

    async def run(command: str) -> dict[str, Any]:
        tools = await toolset.get_tools(ctx)
        result: dict[str, Any] = await toolset.call_tool(
            "bash", {"summary": "Run shell command", "command": command}, ctx, tools["bash"]
        )
        _assert_execution_metadata(result, command)
        return result

    return run


@pytest.fixture
def run_bash() -> RunBash:
    return _build_run_bash(allow_mutations=False)


@pytest.fixture
def run_bash_with_mutations() -> RunBash:
    return _build_run_bash(allow_mutations=True)


async def test_result_reports_execution_metadata(run_bash: RunBash) -> None:
    command = "printf 'héllo'; printf 'wörld' >&2"
    result = await run_bash(command)

    assert result["command"] == command
    assert result["exitCode"] == 0
    assert result["stdout"] == "héllo"
    assert result["stderr"] == "wörld"
    # Byte counts measure encoded UTF-8, not characters: é and ö are two bytes each.
    assert result["stdoutBytes"] == 6
    assert result["stderrBytes"] == 6
    assert result["stdoutTruncated"] is False
    assert result["stderrTruncated"] is False
    started_at = datetime.fromisoformat(result["startedAt"])
    completed_at = datetime.fromisoformat(result["completedAt"])
    assert started_at.tzinfo == timezone.utc
    assert completed_at.tzinfo == timezone.utc
    assert started_at <= completed_at
    assert result["durationMs"] >= 0


async def test_query_returns_data_payload(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }'")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}
    assert result["stderr"] == ""


async def test_data_only_flag_unwraps_the_data_field(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql --data-only '{ hello }'")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"hello": "world"}
    assert result["stderr"] == ""


async def test_variables_are_passed_to_query(run_bash: RunBash) -> None:
    result = await run_bash(
        "phoenix-gql 'query($text: String!) { echo(text: $text) }' --vars '{\"text\": \"hi\"}'"
    )

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"echo": "hi"}}
    assert result["stderr"] == ""


async def test_variables_flag_is_accepted_as_alias_for_vars(run_bash: RunBash) -> None:
    result = await run_bash(
        "phoenix-gql 'query($text: String!) { echo(text: $text) }' "
        '--variables \'{"text": "aliased"}\''
    )

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"echo": "aliased"}}
    assert result["stderr"] == ""


async def test_non_object_variables_are_rejected(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }' --vars '[1, 2]'")

    assert result["exitCode"] == 1
    assert result["stdout"] == ""
    assert "must be a JSON object" in result["stderr"]


async def test_query_from_stdin(run_bash: RunBash) -> None:
    result = await run_bash("echo '{ hello }' | phoenix-gql")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}
    assert result["stderr"] == ""


async def test_query_from_file(run_bash: RunBash) -> None:
    await run_bash("mkdir -p /home/user/workspace")
    await run_bash("printf '{ hello }' > /home/user/workspace/q.graphql")

    result = await run_bash("phoenix-gql /home/user/workspace/q.graphql")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"hello": "world"}}
    assert result["stderr"] == ""


async def test_mutation_rejected_when_disabled(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql 'mutation { deleteEverything }'")

    assert result["exitCode"] == 1
    assert result["stdout"] == ""
    assert "Mutations are not permitted" in result["stderr"]


async def test_mutation_allowed_when_enabled(run_bash_with_mutations: RunBash) -> None:
    result = await run_bash_with_mutations("phoenix-gql 'mutation { deleteEverything }'")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"deleteEverything": "deleted"}}
    assert result["stderr"] == ""


async def test_subscription_rejected_even_when_mutations_enabled(
    run_bash_with_mutations: RunBash,
) -> None:
    result = await run_bash_with_mutations("phoenix-gql 'subscription { hello }'")

    assert result["exitCode"] == 1
    assert result["stdout"] == ""
    assert "Subscriptions are not supported" in result["stderr"]


async def test_resolver_errors_are_reported(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ boom }'")

    assert result["exitCode"] == 1
    assert "GraphQL errors:" in result["stderr"]
    assert "kaboom" in result["stderr"]
    payload = json.loads(result["stdout"])
    assert payload["data"] is None
    assert payload["errors"][0]["message"] == "kaboom"


async def test_unknown_option_errors(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql --bogus")

    assert result["exitCode"] == 1
    assert result["stdout"] == ""
    assert "Unknown option: --bogus" in result["stderr"]


async def test_help_reflects_permissions(
    run_bash: RunBash, run_bash_with_mutations: RunBash
) -> None:
    queries_only = await run_bash("phoenix-gql --help")
    with_mutations = await run_bash_with_mutations("phoenix-gql --help")

    assert queries_only["exitCode"] == 0
    assert "Usage: phoenix-gql" in queries_only["stdout"]
    assert "queries only (mutations are disabled)" in queries_only["stdout"]
    assert queries_only["stderr"] == ""
    assert with_mutations["exitCode"] == 0
    assert "queries and mutations are ENABLED" in with_mutations["stdout"]
    assert with_mutations["stderr"] == ""


async def test_output_path_writes_file(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ hello }' --output /home/user/workspace/out.json")

    assert result["exitCode"] == 0
    assert result["stderr"] == ""
    output_path = result["stdout"].strip()
    assert output_path == "/home/user/workspace/out.json"

    read_back = await run_bash(f"cat {output_path}")
    assert json.loads(read_back["stdout"]) == {"data": {"hello": "world"}}
    assert read_back["stderr"] == ""


async def test_large_response_returned_inline(run_bash: RunBash) -> None:
    result = await run_bash("phoenix-gql '{ big(size: 200000) }'")

    assert result["exitCode"] == 0
    assert json.loads(result["stdout"]) == {"data": {"big": "x" * 200000}}
    assert result["stderr"] == ""
    assert result["stdoutTruncated"] is False
    assert result["stderrTruncated"] is False


async def test_oversized_response_truncated(run_bash: RunBash) -> None:
    # A payload large enough to exceed bashkit's internal per-stream output cap.
    oversized_payload_chars = 2_000_000
    result = await run_bash(f"phoenix-gql '{{ big(size: {oversized_payload_chars}) }}'")

    assert result["exitCode"] == 0
    # bashkit caps the stream, so the agent sees less than the full payload.
    assert len(result["stdout"]) < oversized_payload_chars
    assert result["stdout"].endswith("x")
    assert result["stdoutTruncated"] is True
    assert result["stderr"] == ""
    assert result["stderrTruncated"] is False


async def test_output_to_disk_is_not_truncated(run_bash: RunBash) -> None:
    # A payload large enough to exceed bashkit's internal per-stream output cap.
    oversized_payload_chars = 2_000_000
    await run_bash("mkdir -p /home/user/workspace")
    write = await run_bash(
        f"phoenix-gql '{{ big(size: {oversized_payload_chars}) }}' "
        "--output /home/user/workspace/big.json"
    )

    assert write["exitCode"] == 0
    assert write["stdout"].strip() == "/home/user/workspace/big.json"
    assert write["stdoutTruncated"] is False
    assert write["stderrTruncated"] is False

    # The on-disk file keeps the full payload even though it exceeds the inline
    # stream cap; only the streams returned to the agent are truncated.
    size = await run_bash("wc -c < /home/user/workspace/big.json")
    assert int(size["stdout"]) >= oversized_payload_chars


@pytest.mark.parametrize(
    "command",
    [
        "curl -s --max-time 1 http://example.com/",
        "wget -q -O- --timeout=1 http://example.com/",
        "http GET http://example.com/",
    ],
    ids=["curl", "wget", "http"],
)
async def test_web_commands_cannot_reach_internet(run_bash: RunBash, command: str) -> None:
    result = await run_bash(command)

    # Network is disabled, so the built-in refuses before sending the request and no
    # page body is fetched.
    assert "network access not configured" in result["stdout"] + result["stderr"]
    assert "Example Domain" not in result["stdout"]


@pytest.mark.parametrize(
    "command",
    [
        "curl -s --max-time 1 http://127.0.0.1:1/",
        "wget -q -O- --timeout=1 http://127.0.0.1:1/",
        "http GET http://127.0.0.1:1/",
    ],
    ids=["curl", "wget", "http"],
)
async def test_web_commands_cannot_reach_loopback(run_bash: RunBash, command: str) -> None:
    result = await run_bash(command)

    # Loopback/private addresses are unreachable too: the built-in never connects to
    # the host the server runs on.
    assert "network access not configured" in result["stdout"] + result["stderr"]
