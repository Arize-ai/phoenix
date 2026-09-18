import inspect
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Optional, cast

import pytest
import strawberry
from fastmcp import FastMCP
from mcp_types import TextContent
from strawberry.schema.exceptions import InvalidOperationTypeError

import phoenix.server.app
import phoenix.server.mcp_server
from phoenix.server.api import graphql_execute
from phoenix.server.api.context import Context
from phoenix.server.api.graphql_execute import (
    MAX_QUERY_BYTES,
    GraphQLRefusal,
    GraphQLRefusalCode,
    admit,
    execute_operation,
    validate_document,
)
from phoenix.server.mcp.graphql.tools import register_graphql_tools


@strawberry.type
class Dataset:
    id: strawberry.ID
    name: str


@strawberry.type
class Query:
    @strawberry.field
    async def datasets(self) -> list[Dataset]:
        return [Dataset(id=strawberry.ID("1"), name="rag-eval")]

    @strawberry.field
    async def dataset(self, id: strawberry.ID) -> Optional[Dataset]:
        return Dataset(id=id, name="rag-eval")

    @strawberry.field
    async def boom(self) -> Optional[str]:
        """Nullable, so its failure nulls this field and not the whole response."""
        raise ValueError("resolver failed")


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def delete_dataset(self, dataset_id: strawberry.ID) -> bool:
        return True


@pytest.fixture
def schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query, mutation=Mutation)


@pytest.fixture
def app(schema: strawberry.Schema) -> Any:
    """An application stub carrying only what the tools read from it."""
    return SimpleNamespace(
        state=SimpleNamespace(
            graphql_schema=schema,
            build_graphql_context=lambda user: None,
        )
    )


@pytest.fixture
def graphql_mcp(app: Any) -> FastMCP:
    mcp = FastMCP("test")
    register_graphql_tools(mcp, app=app)
    return mcp


def _text(result: Any) -> str:
    return "".join(block.text for block in result.content if isinstance(block, TextContent))


async def test_no_arguments_returns_the_query_root(graphql_mcp: FastMCP) -> None:
    """The entry point, so a caller with no idea where to start still gets one."""
    text = _text(await graphql_mcp.call_tool("describeGraphqlSchema", {}))
    assert "type Query" in text
    assert "datasets" in text


async def test_names_and_search_answer_in_one_call(graphql_mcp: FastMCP) -> None:
    text = _text(
        await graphql_mcp.call_tool(
            "describeGraphqlSchema", {"names": ["Dataset", "Query.datasets"], "search": "name"}
        )
    )
    blocks = text.split("\n\n")
    assert blocks[0].startswith("type Dataset")
    assert blocks[1].startswith("Query.datasets")
    assert "  name: String!" in "\n\n".join(blocks[2:])
    # An exact name given as free text is still a lookup.
    assert _text(
        await graphql_mcp.call_tool("describeGraphqlSchema", {"search": "Dataset"})
    ).startswith("type Dataset")


async def test_search_and_names_take_lists_or_strings(graphql_mcp: FastMCP) -> None:
    text = _text(
        await graphql_mcp.call_tool(
            "describeGraphqlSchema",
            {"search": ["name", "boom"], "names": "Dataset, Query.datasets"},
        )
    )
    blocks = text.split("\n\n")
    assert blocks[0].startswith("type Dataset")
    assert blocks[1].startswith("Query.datasets")
    searched = "\n\n".join(blocks[2:])
    assert "  name: String!" in searched
    assert "  boom: String" in searched
    assert searched.count("# Query.boom in full:") == 1


async def test_query_tool_states_the_size_limit(graphql_mcp: FastMCP) -> None:
    """The description spells the limit out, so it must match the one enforced."""
    tools = {tool.name: tool for tool in await graphql_mcp.list_tools()}
    assert f"{MAX_QUERY_BYTES // 1024} KiB" in (tools["executeGraphqlQuery"].description or "")


async def test_query_returns_data(graphql_mcp: FastMCP) -> None:
    result = await graphql_mcp.call_tool("executeGraphqlQuery", {"query": "{ datasets { name } }"})
    assert result.structured_content == {
        "data": {"datasets": [{"name": "rag-eval"}]},
        "errors": [],
    }


async def test_a_failing_field_reports_errors_beside_the_data(graphql_mcp: FastMCP) -> None:
    """A partial failure keeps the fields that succeeded, so `errors` must be read too."""
    result = await graphql_mcp.call_tool(
        "executeGraphqlQuery", {"query": "{ datasets { name } boom }"}
    )
    content = result.structured_content
    assert content is not None
    assert content["data"] == {"datasets": [{"name": "rag-eval"}], "boom": None}
    assert [error["message"] for error in content["errors"]] == ["resolver failed"]


async def test_refusal_is_distinguishable_from_execution_errors(graphql_mcp: FastMCP) -> None:
    """The two outcomes must not be conflated: one ran, the other did not."""
    refused = await graphql_mcp.call_tool(
        "executeGraphqlQuery", {"query": 'mutation { deleteDataset(datasetId: "1") }'}
    )
    errored = await graphql_mcp.call_tool("executeGraphqlQuery", {"query": "{ boom }"})
    assert refused.structured_content is not None and errored.structured_content is not None
    assert "error" in refused.structured_content
    assert "error" not in errored.structured_content
    assert errored.structured_content["errors"]


async def test_oversized_query_is_refused_unexecuted(graphql_mcp: FastMCP) -> None:
    oversized = "{ datasets { name " + "# padding\n" * MAX_QUERY_BYTES + " } }"
    result = await graphql_mcp.call_tool("executeGraphqlQuery", {"query": oversized})
    content = result.structured_content
    assert content is not None
    assert content["error"]["code"] == GraphQLRefusalCode.QUERY_TOO_LARGE.value


async def test_variable_values_do_not_count_toward_the_size_limit(graphql_mcp: FastMCP) -> None:
    result = await graphql_mcp.call_tool(
        "executeGraphqlQuery",
        {
            "query": "query Q($id: ID!) { dataset(id: $id) { name } }",
            "variables": {"id": "x" * (2 * MAX_QUERY_BYTES)},
        },
    )
    assert result.structured_content == {"data": {"dataset": {"name": "rag-eval"}}, "errors": []}


async def test_an_invalid_document_reports_errors_without_running(graphql_mcp: FastMCP) -> None:
    result = await graphql_mcp.call_tool("executeGraphqlQuery", {"query": "{ noSuchField }"})
    content = result.structured_content
    assert content is not None
    assert content["data"] is None
    assert "noSuchField" in content["errors"][0]["message"]


def test_validate_does_not_check_variable_values(schema: strawberry.Schema) -> None:
    """The docstring's boundary, pinned: a clean validation is not a promise of success.

    The document declares a required variable and supplies no value for it, which
    is exactly what validation does not look at.
    """
    validate_document(schema, "query Q($id: ID!) { dataset(id: $id) { name } }")


def test_subscriptions_are_refused() -> None:
    with pytest.raises(GraphQLRefusal) as caught:
        admit("subscription { anything }", allow_mutations=True)
    assert caught.value.code is GraphQLRefusalCode.SUBSCRIPTION_NOT_SUPPORTED


async def test_mutation_gate_is_enforced_by_the_schema_too(
    schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With admission bypassed, the schema alone still refuses the mutation."""
    monkeypatch.setattr(graphql_execute, "admit", lambda query, *, allow_mutations: set())
    with pytest.raises(InvalidOperationTypeError):
        await execute_operation(
            schema,
            query='mutation { deleteDataset(datasetId: "1") }',
            variables=None,
            context=cast(Context, None),
            allow_mutations=False,
        )


def test_the_size_limit_counts_utf8_bytes() -> None:
    """At the limit is admitted; the same length in characters, one byte over, is not."""
    head = "{ datasets { name } } #"
    at_limit = head + "x" * (MAX_QUERY_BYTES - len(head))
    admit(at_limit, allow_mutations=False)
    with pytest.raises(GraphQLRefusal) as caught:
        admit(at_limit[:-1] + "é", allow_mutations=False)
    assert caught.value.code is GraphQLRefusalCode.QUERY_TOO_LARGE


@pytest.mark.parametrize(
    "query,expected",
    [
        ("{ datasets { name } }", None),
        ("query Q { datasets { name } }", None),
        ('mutation { deleteDataset(datasetId: "1") }', GraphQLRefusalCode.MUTATION_NOT_ALLOWED),
    ],
)
def test_admission_classifies_operations(
    query: str, expected: Optional[GraphQLRefusalCode]
) -> None:
    if expected is None:
        admit(query, allow_mutations=False)
        return
    with pytest.raises(GraphQLRefusal) as caught:
        admit(query, allow_mutations=False)
    assert caught.value.code is expected


class TestRegistration:
    """Which consumer carries these tools.

    PXI reaches GraphQL through the `phoenix-gql` shell builtin, which carries
    the mutation policy and the approval gate. These tools register for PXI
    only where that builtin is off, so PXI never has an ungated second path.
    """

    def test_off_by_default(self) -> None:
        """A consumer that does not ask gets no second path to GraphQL."""
        from phoenix.server.mcp_server import build_phoenix_mcp_server

        parameter = inspect.signature(build_phoenix_mcp_server).parameters["graphql_tools"]
        assert parameter.default is False

    def test_pxi_registers_them_only_when_its_shell_builtin_is_gone(self) -> None:
        """The PXI call site is bound to the same switch that removes `phoenix-gql`."""
        source = Path(phoenix.server.app.__file__).read_text()
        assert "graphql_tools=get_env_phoenix_agents_disable_bash()," in source

    def test_the_mounted_server_always_registers_them(self) -> None:
        """The mounted server is the surface external clients reach; it has no builtin."""
        source = Path(phoenix.server.mcp_server.__file__).read_text()
        assert "graphql_tools=True," in source

    async def test_registered_when_asked(self, app: Any) -> None:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app)
        names = {tool.name for tool in await mcp.list_tools()}
        assert {"describeGraphqlSchema", "executeGraphqlQuery"} <= names

    async def test_read_tools_never_admit_a_mutation_even_when_mutations_are_allowed(
        self, app: Any
    ) -> None:
        """`allow_mutations` widens what the schema tool describes, never what the query tool runs."""
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app, allow_mutations=True)
        result = await mcp.call_tool(
            "executeGraphqlQuery", {"query": 'mutation { deleteDataset(datasetId: "1") }'}
        )
        content = result.structured_content
        assert content is not None
        assert content["error"]["code"] == GraphQLRefusalCode.MUTATION_NOT_ALLOWED.value

    async def test_allow_mutations_lets_the_schema_tool_describe_them(self, app: Any) -> None:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app, allow_mutations=True)
        text = _text(await mcp.call_tool("describeGraphqlSchema", {"names": ["deleteDataset"]}))
        assert "deleteDataset" in text

    async def test_mutations_are_hidden_from_the_schema_tool_by_default(self, app: Any) -> None:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app)
        text = _text(await mcp.call_tool("describeGraphqlSchema", {"names": ["deleteDataset"]}))
        assert "Mutations are disabled" in text
