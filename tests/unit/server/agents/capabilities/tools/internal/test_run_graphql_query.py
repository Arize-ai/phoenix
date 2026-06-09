from typing import Any, Awaitable, Callable, Optional
from unittest.mock import Mock

import pytest
import strawberry
from pydantic_ai import ModelRetry
from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.capabilities.tools.internal.run_graphql_query import (
    RunGraphQLQueryToolset,
)
from phoenix.server.api.context import Context

CallRunGraphQLQuery = Callable[[str, Optional[dict[str, Any]]], Awaitable[Any]]


@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"

    @strawberry.field
    def boom(self) -> str:
        raise ValueError("kaboom")


@strawberry.type
class Mutation:
    @strawberry.mutation
    def delete_everything(self) -> str:
        return "deleted"


@pytest.fixture
def toolset() -> RunGraphQLQueryToolset:
    return RunGraphQLQueryToolset(
        schema=strawberry.Schema(query=Query, mutation=Mutation),
        build_graphql_context=lambda: Mock(spec=Context),
    )


@pytest.fixture
def call_run_graphql_query(
    toolset: RunGraphQLQueryToolset,
) -> CallRunGraphQLQuery:
    ctx: RunContext[None] = RunContext(deps=None, model=TestModel(), usage=RunUsage())

    async def call(query: str, variable_values: Optional[dict[str, Any]] = None) -> Any:
        tools = await toolset.get_tools(ctx)
        return await toolset.call_tool(
            "run_graphql_query",
            {"query": query, "variable_values": variable_values},
            ctx,
            tools["run_graphql_query"],
        )

    return call


async def test_query_operation_returns_data(
    call_run_graphql_query: CallRunGraphQLQuery,
) -> None:
    """A plain read-only query executes and returns its ``data`` payload."""
    result = await call_run_graphql_query("{ hello }")

    assert result == {"data": {"hello": "world"}}


async def test_mutation_operation_is_rejected_as_read_only(
    call_run_graphql_query: CallRunGraphQLQuery,
) -> None:
    with pytest.raises(ModelRetry) as exc_info:
        await call_run_graphql_query("mutation { deleteEverything }")

    assert "read-only" in str(exc_info.value)


async def test_subscription_operation_is_rejected_as_read_only(
    call_run_graphql_query: CallRunGraphQLQuery,
) -> None:
    with pytest.raises(ModelRetry) as exc_info:
        await call_run_graphql_query("subscription { hello }")

    assert "read-only" in str(exc_info.value)


async def test_graphql_execution_errors_raise_model_retry(
    call_run_graphql_query: CallRunGraphQLQuery,
) -> None:
    with pytest.raises(ModelRetry) as exc_info:
        await call_run_graphql_query("{ boom }")

    assert "kaboom" in str(exc_info.value)
