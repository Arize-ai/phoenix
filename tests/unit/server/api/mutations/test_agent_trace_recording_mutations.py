"""GraphQL tests for agent trace recording mutations."""

from __future__ import annotations

from typing import Any

import pytest

from phoenix.server.settings.registry import AgentTraceRecordingSetting
from tests.unit.graphql import AsyncGraphQLClient

_AGENT_TRACE_QUERY = """
query AgentTraceRecordingQ {
  agentsConfig {
    allowLocalTraces
    allowRemoteExport
  }
}
"""

_SET_AGENT_TRACE_MUTATION = """
mutation SetCap($input: SetAgentTraceRecordingInput!) {
  setAgentTraceRecording(input: $input) {
    allowLocalTraces
    allowRemoteExport
  }
}
"""


@pytest.mark.asyncio
async def test_mutation_persists_and_query_reflects_write(
    gql_client: AsyncGraphQLClient,
) -> None:
    """Full GraphQL round-trip: mutation -> _set UPSERT -> cache -> query.

    Uses (False, True), which flips both flags from their defaults
    (True, False) so a swapped-field bug surfaces as an assertion failure
    instead of slipping through with (True, True) on both sides.
    """
    default = AgentTraceRecordingSetting()

    # Flip the flags to test the update
    allow_local = not default.allow_local_traces
    allow_remote = not default.allow_remote_export

    variables: dict[str, Any] = {
        "input": {
            "allowLocalTraces": allow_local,
            "allowRemoteExport": allow_remote,
        },
    }
    result = await gql_client.execute(_SET_AGENT_TRACE_MUTATION, variables)
    assert not result.errors
    assert result.data is not None
    out = result.data["setAgentTraceRecording"]
    assert out["allowLocalTraces"] is allow_local
    assert out["allowRemoteExport"] is allow_remote

    q = await gql_client.execute(_AGENT_TRACE_QUERY, {})
    assert not q.errors
    assert q.data is not None
    atr = q.data["agentsConfig"]
    assert atr["allowLocalTraces"] is allow_local
    assert atr["allowRemoteExport"] is allow_remote
