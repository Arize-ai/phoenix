import inspect
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Optional, cast

import pytest
import strawberry
from fastmcp import FastMCP
from mcp_types import TextContent

import phoenix.server.app
import phoenix.server.mcp_server
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


async def test_tools_are_registered(graphql_mcp: FastMCP) -> None:
    tools = await graphql_mcp.list_tools()
    assert {"describeGraphqlSchema", "executeGraphqlQuery"} <= {tool.name for tool in tools}


async def test_no_arguments_returns_the_query_root(graphql_mcp: FastMCP) -> None:
    """The entry point, so a caller with no idea where to start still gets one."""
    text = _text(await graphql_mcp.call_tool("describeGraphqlSchema", {}))
    assert "type Query" in text
    assert "datasets" in text


async def test_search_finds_a_field_by_free_text(graphql_mcp: FastMCP) -> None:
    text = _text(await graphql_mcp.call_tool("describeGraphqlSchema", {"search_terms": "dataset"}))
    assert "datasets" in text


async def test_exact_name_returns_the_whole_type(graphql_mcp: FastMCP) -> None:
    text = _text(await graphql_mcp.call_tool("describeGraphqlSchema", {"search_terms": "Dataset"}))
    assert "type Dataset" in text
    assert "name: String!" in text


async def test_preamble_states_the_invariants_the_answers_do_not(graphql_mcp: FastMCP) -> None:
    """Everything constant is stated once here rather than on every answer."""
    text = _text(await graphql_mcp.call_tool("describeGraphqlSchema", {}))
    assert "Entry point: Query" in text
    assert "errors at execution, not here" in text
    assert f"{MAX_QUERY_BYTES // 1024} KiB" in text


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


async def test_mutation_is_refused_and_never_runs(graphql_mcp: FastMCP) -> None:
    result = await graphql_mcp.call_tool(
        "executeGraphqlQuery",
        {"query": 'mutation { deleteDataset(datasetId: "1") }'},
    )
    content = result.structured_content
    assert content is not None
    assert content["error"]["code"] == GraphQLRefusalCode.MUTATION_NOT_ALLOWED.value
    assert "data" not in content


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


async def test_validate_only_accepts_a_good_document_without_running_it(
    graphql_mcp: FastMCP,
) -> None:
    result = await graphql_mcp.call_tool(
        "executeGraphqlQuery", {"query": "{ boom }", "validate_only": True}
    )
    content = result.structured_content
    assert content is not None
    # `boom` always raises, so data proves nothing executed.
    assert content["data"] is None
    assert content["errors"] == []


async def test_validate_only_rejects_an_unknown_field(graphql_mcp: FastMCP) -> None:
    result = await graphql_mcp.call_tool(
        "executeGraphqlQuery", {"query": "{ noSuchField }", "validate_only": True}
    )
    content = result.structured_content
    assert content is not None
    assert content["error"]["code"] == GraphQLRefusalCode.VALIDATION_FAILED.value
    assert "noSuchField" in content["error"]["message"]


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


@pytest.mark.parametrize("allow_mutations", [True, False])
async def test_mutation_gate_is_enforced_by_the_schema_too(
    schema: strawberry.Schema, allow_mutations: bool
) -> None:
    """Admission and the schema both gate mutations, so misreading a document is not enough."""
    query = 'mutation { deleteDataset(datasetId: "1") }'
    if not allow_mutations:
        with pytest.raises(GraphQLRefusal):
            await execute_operation(
                schema,
                query=query,
                variables=None,
                context=cast(Context, None),
                allow_mutations=False,
            )
        return
    outcome = await execute_operation(
        schema, query=query, variables=None, context=cast(Context, None), allow_mutations=True
    )
    assert outcome.data == {"deleteDataset": True}


@pytest.mark.parametrize(
    "query,expected",
    [
        ("{ datasets { name } }", None),
        ("query Q { datasets { name } }", None),
        ('mutation { deleteDataset(datasetId: "1") }', GraphQLRefusalCode.MUTATION_NOT_ALLOWED),
        ("subscription S { x }", GraphQLRefusalCode.SUBSCRIPTION_NOT_SUPPORTED),
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
    """Which consumer carries these tools, and why.

    PXI reaches GraphQL through the `phoenix-gql` shell builtin, which is where
    the mutation policy and the approval gate live. That builtin ships with the
    bash capability, so registering these tools for PXI as well would give it a
    second path to the same API with neither of those gates on it. They are the
    fallback for exactly the deployments that turn bash off.
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
        text = _text(
            await mcp.call_tool("describeGraphqlSchema", {"search_terms": "deleteDataset"})
        )
        assert "deleteDataset" in text

    async def test_mutations_are_hidden_from_the_schema_tool_by_default(self, app: Any) -> None:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app)
        text = _text(
            await mcp.call_tool("describeGraphqlSchema", {"search_terms": "deleteDataset"})
        )
        assert "Mutations are disabled" in text or "deleteDataset(" not in text


class TestMutationTool:
    """The write surface, and what stands in for approval on it.

    Nothing here can reach a person to ask. The gates are the caller's own
    permissions, enforced by the same resolvers the GraphQL endpoint runs, and a
    destructive annotation that tells the client to confirm. A deployment opts
    in explicitly because neither gate is a substitute for someone deciding.
    """

    @pytest.fixture
    def mutating_mcp(self, app: Any) -> FastMCP:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app, allow_mutations=True)
        return mcp

    async def test_absent_unless_the_deployment_opts_in(self, app: Any) -> None:
        mcp = FastMCP("test")
        register_graphql_tools(mcp, app=app)
        assert "executeGraphqlMutation" not in {tool.name for tool in await mcp.list_tools()}

    async def test_present_when_it_does(self, mutating_mcp: FastMCP) -> None:
        assert "executeGraphqlMutation" in {tool.name for tool in await mutating_mcp.list_tools()}

    async def test_annotated_destructive_so_the_client_confirms(
        self, mutating_mcp: FastMCP
    ) -> None:
        """The only approval available on this transport is the client's own."""
        tool = next(
            tool
            for tool in await mutating_mcp.list_tools()
            if tool.name == "executeGraphqlMutation"
        )
        assert tool.annotations is not None
        assert tool.annotations.destructive_hint is True
        assert tool.annotations.read_only_hint is False

    async def test_read_tool_stays_annotated_read_only(self, mutating_mcp: FastMCP) -> None:
        """Enabling writes must not relax the annotation on the tool that only reads."""
        tool = next(
            tool for tool in await mutating_mcp.list_tools() if tool.name == "executeGraphqlQuery"
        )
        assert tool.annotations is not None
        assert tool.annotations.read_only_hint is True

    async def test_runs_a_mutation(self, mutating_mcp: FastMCP) -> None:
        result = await mutating_mcp.call_tool(
            "executeGraphqlMutation",
            {"mutation": 'mutation { deleteDataset(datasetId: "1") }'},
        )
        assert result.structured_content == {"data": {"deleteDataset": True}, "errors": []}

    async def test_refuses_a_read_only_document(self, mutating_mcp: FastMCP) -> None:
        """A query sent here is a mistake worth naming, not something to silently run."""
        result = await mutating_mcp.call_tool(
            "executeGraphqlMutation", {"mutation": "{ datasets { name } }"}
        )
        content = result.structured_content
        assert content is not None
        assert content["error"]["code"] == GraphQLRefusalCode.NOT_A_MUTATION.value

    async def test_validate_only_does_not_run_the_mutation(self, mutating_mcp: FastMCP) -> None:
        result = await mutating_mcp.call_tool(
            "executeGraphqlMutation",
            {"mutation": 'mutation { deleteDataset(datasetId: "1") }', "validate_only": True},
        )
        content = result.structured_content
        assert content is not None
        assert content["data"] is None

    def test_off_by_default_in_config(self) -> None:
        from phoenix.config import get_env_mcp_graphql_mutations

        assert get_env_mcp_graphql_mutations() is False

    def test_a_read_only_deployment_never_registers_it(self) -> None:
        """Registering it there would advertise a write the resolvers would refuse."""
        source = Path(phoenix.server.mcp_server.__file__).read_text()
        assert "graphql_mutations=get_env_mcp_graphql_mutations() and not read_only," in source

    def test_pxi_never_registers_it(self) -> None:
        """PXI's writes go through `phoenix-gql`, which asks the user first."""
        source = Path(phoenix.server.app.__file__).read_text()
        start = source.index("pxi_mcp_server, pxi_mcp_sandbox = build_phoenix_mcp_server(")
        call_site = source[start : source.index("\n        )", start)]
        assert "graphql_tools=" in call_site
        assert "graphql_mutations=" not in call_site
