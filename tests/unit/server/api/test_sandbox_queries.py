from typing import Any

import pytest
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA, register_sandbox_adapter
from phoenix.server.sandbox.types import E2BConfig, SandboxAdapter, SandboxBackend
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_sandbox_providers_returns_nested_configs(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
    assert provider is not None

    query = """
      query {
        sandboxProviders {
          id
          backendType
          language
          enabled
          config
          configs {
            id
            name
            description
            timeout
            enabled
            config
          }
        }
      }
    """

    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data is not None

    provider_result = next(
        item
        for item in response.data["sandboxProviders"]
        if item["id"] == str(GlobalID("SandboxProvider", str(provider.id)))
    )
    assert provider_result["backendType"] == provider.backend_type
    assert provider_result["language"] == "PYTHON"
    assert provider_result["enabled"] is True
    assert provider_result["config"] == {}
    assert provider_result["configs"] == [
        {
            "id": str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            "name": sandbox_config.name,
            "description": sandbox_config.description,
            "timeout": sandbox_config.timeout,
            "enabled": sandbox_config.enabled,
            "config": sandbox_config.config,
        }
    ]


async def test_sandbox_backends_and_providers_can_be_loaded_together(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    seed_sandbox_providers: None,
) -> None:
    async with db() as session:
        provider_count = await session.scalar(select(func.count(models.SandboxProvider.id)))

    query = """
      query {
        sandboxBackends {
          backendType
          displayName
          supportedLanguages
          status
          dependencyHints
        }
        sandboxProviders {
          id
          backendType
        }
      }
    """

    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data is not None
    assert len(response.data["sandboxBackends"]) >= 1
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}

    assert backends["WASM"]["dependencyHints"] == [
        "Install Phoenix with the `wasm` extra so `wasmtime` is available.",
        "Allow Phoenix to download the CPython WASM binary on first use, "
        "or pre-populate the local WASM cache.",
    ]
    assert backends["E2B"]["dependencyHints"] == [
        "Install Phoenix with the `e2b` extra.",
        "Provide `PHOENIX_SANDBOX_E2B_API_KEY` or `PHOENIX_SANDBOX_API_KEY`.",
    ]
    assert backends["DAYTONA_PYTHON"]["dependencyHints"] == [
        "Install Phoenix with the `daytona` extra.",
        "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY` or `PHOENIX_SANDBOX_TOKEN`.",
    ]
    assert backends["VERCEL_PYTHON"]["dependencyHints"] == [
        "Install Phoenix with the `vercel` extra.",
        "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
        "`VERCEL_TEAM_ID`.",
    ]
    assert backends["DENO"]["dependencyHints"] == [
        "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
    ]
    assert len(response.data["sandboxProviders"]) == provider_count


@pytest.fixture
def register_e2b_adapter() -> Any:
    """Register a minimal E2BAdapter so config_field_specs are derived from E2BConfig."""

    class _FakeE2BAdapter(SandboxAdapter):
        key = "E2B"
        display_name = "E2B"
        language = "PYTHON"
        config_model = E2BConfig

        def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
            raise NotImplementedError

    original_specs = list(SANDBOX_ADAPTER_METADATA["E2B"].config_field_specs)
    register_sandbox_adapter(_FakeE2BAdapter())
    yield
    SANDBOX_ADAPTER_METADATA["E2B"].config_field_specs = original_specs


async def test_sandbox_backends_config_field_specs(
    gql_client: AsyncGraphQLClient,
    seed_sandbox_providers: None,
    register_e2b_adapter: Any,
) -> None:
    """configFieldSpecs for E2B derives 3 fields from E2BConfig; others have none."""
    query = """
      query {
        sandboxBackends {
          backendType
          configFieldSpecs {
            key
            displayName
            fieldType
            required
            description
            choices
          }
        }
      }
    """

    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data is not None
    backends = {b["backendType"]: b for b in response.data["sandboxBackends"]}

    # E2B derives 3 specs from E2BConfig (template, cwd, metadata)
    e2b_specs = backends["E2B"]["configFieldSpecs"]
    assert len(e2b_specs) == 3
    spec_by_key = {s["key"]: s for s in e2b_specs}
    assert spec_by_key["template"] == {
        "key": "template",
        "displayName": "Template",
        "fieldType": "string",
        "required": False,
        "description": "E2B sandbox template ID. Defaults to 'base'.",
        "choices": None,
    }
    assert spec_by_key["cwd"] == {
        "key": "cwd",
        "displayName": "Working Directory",
        "fieldType": "string",
        "required": False,
        "description": "Working directory for code execution inside the sandbox.",
        "choices": None,
    }
    assert spec_by_key["metadata"] == {
        "key": "metadata",
        "displayName": "Metadata",
        "fieldType": "string",
        "required": False,
        "description": "Metadata string attached to the sandbox at creation time.",
        "choices": None,
    }

    # Adapters with empty config models have no specs
    for backend_type in ("WASM", "VERCEL_PYTHON", "VERCEL_TYPESCRIPT", "DENO"):
        assert backends[backend_type]["configFieldSpecs"] == [], backend_type
