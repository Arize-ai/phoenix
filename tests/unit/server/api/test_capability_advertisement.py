"""Tests for capability advertisement via sandboxBackends and env_vars config round-trip."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
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
      dependenciesLanguage
    }
  }
"""

_LOCAL_BACKEND_TYPES = {"WASM", "DENO"}

_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
            config
        }
    }
}
"""

_QUERY_PROVIDER_CONFIGS = """
query SandboxProviders {
    sandboxProviders {
        id
        backendType
        configs {
            id
            config
        }
    }
}
"""


def _provider_global_id(provider_id: int) -> str:
    return str(GlobalID("SandboxProvider", str(provider_id)))


async def test_sandbox_backends_full_ui_query_shape(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    """UI-style query with all capability fields resolves without errors."""
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}

    assert set(backends.keys()) == set(SANDBOX_ADAPTER_METADATA.keys())

    for bt, backend in backends.items():
        assert "supportsEnvVars" in backend, bt
        assert "internetAccess" in backend, bt
        assert "dependenciesLanguage" in backend, bt
        expected_hosting = "LOCAL" if bt in _LOCAL_BACKEND_TYPES else "HOSTED"
        assert backend["hostingType"] == expected_hosting, bt


@pytest.mark.parametrize("backend_type", list(SANDBOX_ADAPTER_METADATA.keys()))
async def test_sandbox_backends_capability_flags_per_adapter(
    backend_type: str,
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    """Each adapter advertises capability flags consistent with SANDBOX_ADAPTER_METADATA."""
    meta = SANDBOX_ADAPTER_METADATA[backend_type]
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}
    assert backend_type in backends, f"{backend_type} not found in sandboxBackends response"
    backend = backends[backend_type]

    assert backend["supportsEnvVars"] is meta.supports_env_vars, backend_type
    assert backend["internetAccess"] == meta.internet_access_capability.upper(), backend_type
    expected_deps_lang = meta.dependencies_language
    assert backend["dependenciesLanguage"] == expected_deps_lang, backend_type


async def test_sandbox_config_with_env_vars_persists_through_mutation(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    seed_sandbox_providers: None,
) -> None:
    """A SandboxConfig with env_vars in config persists unredacted in the DB
    but exposes redacted literal values + a digest at the GraphQL boundary."""
    async with db() as session:
        provider = await session.scalar(
            select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
        )
    assert provider is not None

    env_vars_payload = [
        {"kind": "literal", "name": "MY_VAR", "value": "hello"},
    ]
    result = await gql_client.execute(
        _CREATE,
        variables={
            "input": {
                "sandboxProviderId": _provider_global_id(provider.id),
                "name": "e2b-with-env-vars",
                "config": {"env_vars": env_vars_payload},
            }
        },
    )
    assert result.data and not result.errors
    cfg = result.data["createSandboxConfig"]["sandboxConfig"]
    persisted_env_vars = cfg["config"]["env_vars"]
    assert len(persisted_env_vars) == 1
    assert persisted_env_vars[0]["kind"] == "literal"
    assert persisted_env_vars[0]["name"] == "MY_VAR"
    assert persisted_env_vars[0]["value"] == "<redacted>"
    assert "value_digest" in persisted_env_vars[0]

    reload_result = await gql_client.execute(query=_QUERY_PROVIDER_CONFIGS)
    assert reload_result.data and not reload_result.errors
    e2b_provider = next(
        p for p in reload_result.data["sandboxProviders"] if p["backendType"] == "E2B"
    )
    reloaded_config = next(
        c
        for c in e2b_provider["configs"]
        if any(entry.get("name") == "MY_VAR" for entry in (c["config"].get("env_vars") or []))
    )
    reloaded_env_vars = reloaded_config["config"]["env_vars"]
    assert reloaded_env_vars[0]["value"] == "<redacted>"
    assert reloaded_env_vars[0]["name"] == "MY_VAR"

    # The DB row keeps the plaintext so runtime can read the real value.
    config_id = int(GlobalID.from_id(cfg["id"]).node_id)
    async with db() as session:
        row = await session.get(models.SandboxConfig, config_id)
    assert row is not None
    assert row.config["env_vars"] == [
        {"kind": "literal", "name": "MY_VAR", "value": "hello"},
    ]


async def test_sandbox_config_secret_ref_env_var_round_trips(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    seed_sandbox_providers: None,
) -> None:
    """A secret_ref env var entry persists through create without leaking the secret value."""
    async with db() as session:
        provider = await session.scalar(
            select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
        )
    assert provider is not None

    secret_ref_payload = [
        {"kind": "secret_ref", "name": "API_TOKEN", "secret_key": "my_secret_key"},
    ]
    result = await gql_client.execute(
        _CREATE,
        variables={
            "input": {
                "sandboxProviderId": _provider_global_id(provider.id),
                "name": "e2b-with-secret-ref",
                "config": {"env_vars": secret_ref_payload},
            }
        },
    )
    assert result.data and not result.errors
    cfg = result.data["createSandboxConfig"]["sandboxConfig"]
    persisted_env_vars = cfg["config"]["env_vars"]
    assert persisted_env_vars == secret_ref_payload
    for entry in persisted_env_vars:
        assert "value" not in entry or entry.get("kind") != "literal"


async def test_internet_access_advertisement_matches_adapter_capability(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    """Each adapter's advertised internetAccess matches its declared capability.

    E2B / Daytona / Modal SDKs expose a deny-network knob, so those adapters
    advertise BOOLEAN. WASM / Vercel / Deno do not (yet) expose a verifiable
    network-policy API, so they advertise NONE and the frontend hides the
    internet-access editor for them. The source of truth is
    ``AdapterMetadata.internet_access_capability`` in
    ``phoenix.server.sandbox.SANDBOX_ADAPTER_METADATA``.
    """
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    expected = {
        backend_type: meta.internet_access_capability.upper()
        for backend_type, meta in SANDBOX_ADAPTER_METADATA.items()
    }
    advertised = {
        backend["backendType"]: backend["internetAccess"]
        for backend in response.data["sandboxBackends"]
    }
    assert advertised == expected, (
        f"Advertised internet_access does not match adapter capability metadata. "
        f"Expected {expected}, got {advertised}"
    )


async def test_dependencies_language_only_set_for_daytona(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
) -> None:
    """Only DAYTONA_PYTHON advertises dependenciesLanguage — the only adapter with runtime install.

    All other adapters advertise dependenciesLanguage=None, meaning the frontend
    should hide the dependencies editor for them until Phase 5 ships verified support.
    """
    response = await gql_client.execute(query=_SANDBOX_BACKENDS_QUERY)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}

    for bt, meta in SANDBOX_ADAPTER_METADATA.items():
        expected = meta.dependencies_language
        assert backends[bt]["dependenciesLanguage"] == expected, (
            f"{bt}: expected dependenciesLanguage={expected!r}"
        )
