from typing import Any, Mapping, Optional
from unittest.mock import MagicMock

import pytest
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.sandbox import (
    _SANDBOX_ADAPTERS,
    SANDBOX_ADAPTER_METADATA,
    AdapterMetadata,
)
from phoenix.server.sandbox.types import (
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_TEST_AUTH_BACKEND = "TEST_AUTH_BACKEND"
_TEST_AUTH_KEY = "TEST_AUTH_KEY"


class _TestAuthAdapter(SandboxAdapter):
    key = _TEST_AUTH_BACKEND
    family = "WASM"  # any canonical family — gate doesn't filter for these tests
    display_name = "Test Auth Backend"
    language = "PYTHON"
    credential_specs = [ProviderCredentialSpec(key=_TEST_AUTH_KEY, display_name="Test Auth Key")]

    def build_backend(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        return MagicMock(spec=SandboxBackend)


@pytest.fixture(autouse=True)
def _clean_test_auth_backend() -> Any:
    yield
    SANDBOX_ADAPTER_METADATA.pop(_TEST_AUTH_BACKEND, None)
    _SANDBOX_ADAPTERS.pop(_TEST_AUTH_BACKEND, None)


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
          statusDetail
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
        "Provide `E2B_API_KEY`.",
    ]
    assert backends["DAYTONA_PYTHON"]["dependencyHints"] == [
        "Install Phoenix with the `daytona` extra.",
        "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY`.",
    ]
    assert backends["VERCEL_PYTHON"]["dependencyHints"] == [
        "Install Phoenix with the `vercel` extra.",
        "Set all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID`. See https://vercel.com/docs/vercel-sandbox/concepts/authentication",
    ]
    assert backends["DENO"]["dependencyHints"] == [
        "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
    ]
    assert len(response.data["sandboxProviders"]) == provider_count


async def test_sandbox_backends_reports_missing_credentials_status(
    gql_client: AsyncGraphQLClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(_TEST_AUTH_KEY, raising=False)
    SANDBOX_ADAPTER_METADATA[_TEST_AUTH_BACKEND] = AdapterMetadata(
        display_name="Test Auth Backend",
        language="PYTHON",
    )
    _SANDBOX_ADAPTERS[_TEST_AUTH_BACKEND] = _TestAuthAdapter()

    query = """
      query {
        sandboxBackends {
          backendType
          status
          statusDetail
        }
      }
    """

    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data is not None

    backends = {backend["backendType"]: backend for backend in response.data["sandboxBackends"]}
    assert backends[_TEST_AUTH_BACKEND]["status"] == "MISSING_CREDENTIALS"
    assert backends[_TEST_AUTH_BACKEND]["statusDetail"] == f"Set `{_TEST_AUTH_KEY}`."
