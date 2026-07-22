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
        "input": {"maxIdleDays": 7, "maxCountPerUser": 200},
    }
    result = await gql_client.execute(_SET_RETENTION_MUTATION, variables)
    assert not result.errors
    assert result.data is not None
    out = result.data["setAgentSessionRetention"]
    assert out["maxIdleDays"] == 7
    assert out["maxCountPerUser"] == 200

    q = await gql_client.execute(_RETENTION_QUERY, {})
    assert not q.errors
    assert q.data is not None
    config = q.data["agentsConfig"]
    assert config["sessionRetentionMaxIdleDays"] == 7
    assert config["sessionRetentionMaxCountPerUser"] == 200


@pytest.mark.asyncio
async def test_query_returns_defaults_when_setting_is_unset(
    gql_client: AsyncGraphQLClient,
) -> None:
    q = await gql_client.execute(_RETENTION_QUERY, {})
    assert not q.errors
    assert q.data is not None
    config = q.data["agentsConfig"]
    assert config["sessionRetentionMaxIdleDays"] is None
    assert config["sessionRetentionMaxCountPerUser"] is None


@pytest.mark.asyncio
async def test_mutation_keeps_omitted_retention_dimensions_unchanged(
    gql_client: AsyncGraphQLClient,
) -> None:
    """Omission is "leave as is", so single-field updates can't clobber the other rule."""
    initial = await gql_client.execute(
        _SET_RETENTION_MUTATION,
        {"input": {"maxIdleDays": 7, "maxCountPerUser": 200}},
    )
    assert not initial.errors

    result = await gql_client.execute(
        _SET_RETENTION_MUTATION,
        {"input": {"maxIdleDays": 14}},
    )

    assert not result.errors
    assert result.data is not None
    assert result.data["setAgentSessionRetention"] == {
        "maxIdleDays": 14,
        "maxCountPerUser": 200,
    }

    empty_input = await gql_client.execute(_SET_RETENTION_MUTATION, {"input": {}})
    assert not empty_input.errors
    assert empty_input.data is not None
    assert empty_input.data["setAgentSessionRetention"] == {
        "maxIdleDays": 14,
        "maxCountPerUser": 200,
    }


@pytest.mark.asyncio
async def test_mutation_disables_explicitly_null_retention_dimensions(
    gql_client: AsyncGraphQLClient,
) -> None:
    initial = await gql_client.execute(
        _SET_RETENTION_MUTATION,
        {"input": {"maxIdleDays": 7, "maxCountPerUser": 200}},
    )
    assert not initial.errors

    idle_disabled = await gql_client.execute(
        _SET_RETENTION_MUTATION,
        {"input": {"maxIdleDays": None}},
    )
    assert not idle_disabled.errors
    assert idle_disabled.data is not None
    assert idle_disabled.data["setAgentSessionRetention"] == {
        "maxIdleDays": None,
        "maxCountPerUser": 200,
    }

    count_disabled = await gql_client.execute(
        _SET_RETENTION_MUTATION,
        {"input": {"maxCountPerUser": None}},
    )
    assert not count_disabled.errors
    assert count_disabled.data is not None
    assert count_disabled.data["setAgentSessionRetention"] == {
        "maxIdleDays": None,
        "maxCountPerUser": None,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "variables",
    [
        {"input": {"maxIdleDays": -1}},
        {"input": {"maxIdleDays": 0}},
        {"input": {"maxCountPerUser": -1}},
        {"input": {"maxCountPerUser": 0}},
    ],
)
async def test_mutation_rejects_nonpositive_set_values(
    gql_client: AsyncGraphQLClient,
    variables: dict[str, Any],
) -> None:
    result = await gql_client.execute(_SET_RETENTION_MUTATION, variables)
    assert result.errors
    assert "must be greater than 0 when set" in result.errors[0].message
