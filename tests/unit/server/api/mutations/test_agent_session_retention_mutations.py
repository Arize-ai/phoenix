"""GraphQL tests for the agent session retention mutation."""

from __future__ import annotations

from typing import Any

import pytest

from tests.unit.graphql import AsyncGraphQLClient

_RETENTION_QUERY = """
query AgentSessionRetentionQ {
  agentsConfig {
    sessionRetentionMaxIdleDays
    sessionRetentionMaxCountPerUser
  }
}
"""

_SET_RETENTION_MUTATION = """
mutation SetRetention($input: SetAgentSessionRetentionInput!) {
  setAgentSessionRetention(input: $input) {
    maxIdleDays
    maxCountPerUser
  }
}
"""


@pytest.mark.asyncio
async def test_mutation_persists_and_query_reflects_write(
    gql_client: AsyncGraphQLClient,
) -> None:
    """Full GraphQL round-trip: mutation -> _set UPSERT -> cache -> query."""
    variables: dict[str, Any] = {
        "input": {"maxIdleDays": 7.5, "maxCountPerUser": 200},
    }
    result = await gql_client.execute(_SET_RETENTION_MUTATION, variables)
    assert not result.errors
    assert result.data is not None
    out = result.data["setAgentSessionRetention"]
    assert out["maxIdleDays"] == 7.5
    assert out["maxCountPerUser"] == 200

    q = await gql_client.execute(_RETENTION_QUERY, {})
    assert not q.errors
    assert q.data is not None
    config = q.data["agentsConfig"]
    assert config["sessionRetentionMaxIdleDays"] == 7.5
    assert config["sessionRetentionMaxCountPerUser"] == 200


@pytest.mark.asyncio
async def test_query_returns_defaults_when_setting_is_unset(
    gql_client: AsyncGraphQLClient,
) -> None:
    q = await gql_client.execute(_RETENTION_QUERY, {})
    assert not q.errors
    assert q.data is not None
    config = q.data["agentsConfig"]
    assert config["sessionRetentionMaxIdleDays"] == 30
    assert config["sessionRetentionMaxCountPerUser"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "variables",
    [
        {"input": {"maxIdleDays": -1, "maxCountPerUser": 0}},
        {"input": {"maxIdleDays": 0, "maxCountPerUser": -1}},
    ],
)
async def test_mutation_rejects_negative_values(
    gql_client: AsyncGraphQLClient,
    variables: dict[str, Any],
) -> None:
    result = await gql_client.execute(_SET_RETENTION_MUTATION, variables)
    assert result.errors
    assert "greater than or equal to 0" in result.errors[0].message
