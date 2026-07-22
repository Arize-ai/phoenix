from __future__ import annotations

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import SandboxBackendType
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_SANDBOX_BACKENDS_QUERY = """
  query {
    sandboxBackends {
      backendType
      displayName
      hostingType
      supportedLanguages
      status
      dependencyHints
      supportsEnvVars
      internetAccess
      supportsDependencies
      languageDialect
      runtimeNotes
    }
  }
"""

_LOCAL_KINDS = {"WASM", "DENO", "MONTY"}

_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
            config {
                envVars {
                    name
                    secretKey
                }
            }
        }
    }
}
"""


async def test_sandbox_backends_full_ui_query_shape(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}

    assert set(backends.keys()) == set(SANDBOX_ADAPTER_METADATA.keys())

    for kind, backend in backends.items():
        assert "supportsEnvVars" in backend, kind
        assert "internetAccess" in backend, kind
        assert "supportsDependencies" in backend, kind
        assert "languageDialect" in backend, kind
        assert "runtimeNotes" in backend, kind
        expected_hosting = "LOCAL" if kind in _LOCAL_KINDS else "HOSTED"
        assert backend["hostingType"] == expected_hosting, kind


@pytest.mark.parametrize("backend_type", list(SANDBOX_ADAPTER_METADATA.keys()))
async def test_sandbox_backends_capability_flags_per_adapter(
    backend_type: SandboxBackendType,
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    meta = SANDBOX_ADAPTER_METADATA[backend_type]
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}
    assert backend_type in backends, f"{backend_type} not found in sandboxBackends response"
    backend = backends[backend_type]

    assert backend["supportedLanguages"] == sorted(meta.supported_languages)
    assert backend["supportsEnvVars"] is meta.supports_env_vars, backend_type
    assert backend["internetAccess"] == meta.internet_access_capability.upper(), backend_type
    assert backend["supportsDependencies"] is meta.supports_dependencies, backend_type
    assert backend["languageDialect"] == meta.language_dialect.upper(), backend_type
    assert backend["runtimeNotes"] == meta.runtime_notes, backend_type


async def test_monty_advertises_restricted_python(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert response.data and not response.errors
    monty = next(
        backend for backend in response.data["sandboxBackends"] if backend["backendType"] == "MONTY"
    )
    assert monty["languageDialect"] == "RESTRICTED"
    assert monty["runtimeNotes"]


async def test_sandbox_config_secret_ref_env_var_round_trips(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    seed_sandbox_providers: None,
) -> None:
    result = await gql_client.execute(
        _CREATE,
        variables={
            "input": {
                "config": {
                    "e2b": {
                        "language": "PYTHON",
                        "envVars": [
                            {
                                "name": "API_TOKEN",
                                "secretKey": "my_secret_key",
                            }
                        ],
                    }
                },
                "name": "e2b-with-secret-ref",
            }
        },
    )
    assert result.data and not result.errors
    cfg = result.data["createSandboxConfig"]["sandboxConfig"]
    env_vars = cfg["config"]["envVars"]
    assert env_vars == [
        {
            "name": "API_TOKEN",
            "secretKey": "my_secret_key",
        }
    ]

    config_id = int(GlobalID.from_id(cfg["id"]).node_id)
    async with db() as session:
        row = await session.get(models.SandboxConfig, config_id)
    assert row is not None
    assert row.config["env_vars"] == {"API_TOKEN": {"secret_key": "my_secret_key"}}
