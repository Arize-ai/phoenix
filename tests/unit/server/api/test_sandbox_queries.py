from typing import Mapping, Optional
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel, ConfigDict, SecretStr
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.sandbox import (
    _SANDBOX_ADAPTERS,
    SANDBOX_ADAPTER_METADATA,
    AdapterMetadata,
)
from phoenix.server.sandbox.types import (
    NoDeployment,
    SandboxAdapter,
    SandboxBackend,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_TEST_AUTH_KIND: models.SandboxBackendType = "WASM"
_TEST_AUTH_KEY = "TEST_AUTH_KEY"


class _EmptyConfig(BaseModel):
    model_config = ConfigDict(extra="allow")


class _TestAuthCreds(BaseModel):
    model_config = ConfigDict(extra="forbid")
    TEST_AUTH_KEY: SecretStr = SecretStr("")


class _TestAuthAdapter(SandboxAdapter):  # type: ignore[type-arg]
    backend_type = _TEST_AUTH_KIND
    display_name = "Test Auth Backend"
    config_model = _EmptyConfig
    credentials_model = _TestAuthCreds
    deployment_config_model = NoDeployment

    def build_backend(
        self,
        config: _EmptyConfig,
        *,
        credentials: _TestAuthCreds,
        deployment: NoDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        return MagicMock(spec=SandboxBackend)


async def test_sandbox_providers_returns_nested_configs(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
    assert provider is not None

    query = """
      query {
        sandboxProviders {
          id
          backendType
          supportedLanguages
          enabled
          configs {
            id
            name
            description
            language
            timeout
            enabled
            config {
              envVars {
                name
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
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
        if item["id"] == str(GlobalID("SandboxProvider", provider.backend_type))
    )
    assert provider_result["backendType"] == provider.backend_type
    assert provider_result["supportedLanguages"] == sorted(
        SANDBOX_ADAPTER_METADATA[provider.backend_type].supported_languages
    )
    assert provider_result["enabled"] is True

    # `configs` holds every config for the provider. Built-in defaults may be seeded at
    # startup (e.g. `default-wasm-python` when the WASM adapter registers because
    # `wasmtime` is installed), so assert the fixture config is present by id rather than
    # that it is the only config. See issue #13925.
    config_result = next(
        config
        for config in provider_result["configs"]
        if config["id"] == str(GlobalID("SandboxConfig", str(sandbox_config.id)))
    )
    assert config_result == {
        "id": str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        "name": sandbox_config.name.root,
        "description": sandbox_config.description,
        "language": sandbox_config.language,
        "timeout": sandbox_config.timeout,
        "enabled": sandbox_config.enabled,
        "config": {
            "envVars": [],
            "internetAccess": None,
            "dependencies": None,
        },
    }


async def test_sandbox_backends_and_providers_can_be_loaded_together(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    seed_sandbox_providers: None,
) -> None:
    async with db() as session:
        provider_count = await session.scalar(
            select(func.count(models.SandboxProvider.backend_type))
        )

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
    assert backends["DAYTONA"]["dependencyHints"] == [
        "Install Phoenix with the `daytona` extra.",
        "Provide `DAYTONA_API_KEY`.",
    ]
    assert backends["VERCEL"]["dependencyHints"] == [
        "Install Phoenix with the `vercel` extra.",
        (
            "Set all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID`. "
            "See https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        ),
    ]
    assert backends["DENO"]["dependencyHints"] == [
        "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
    ]
    assert backends["MODAL"]["dependencyHints"] == [
        "Install Phoenix with the `modal` extra.",
        "Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables.",
    ]
    assert len(response.data["sandboxProviders"]) == provider_count


async def test_sandbox_backends_reports_missing_credentials_status(
    gql_client: AsyncGraphQLClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(_TEST_AUTH_KEY, raising=False)
    monkeypatch.setitem(
        SANDBOX_ADAPTER_METADATA,
        _TEST_AUTH_KIND,
        AdapterMetadata(
            display_name="Test Auth Backend",
            supported_languages=frozenset({"PYTHON"}),
        ),
    )
    monkeypatch.setitem(_SANDBOX_ADAPTERS, _TEST_AUTH_KIND, _TestAuthAdapter())

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
    assert backends[_TEST_AUTH_KIND]["status"] == "MISSING_CREDENTIALS"
    assert backends[_TEST_AUTH_KIND]["statusDetail"] == f"Set `{_TEST_AUTH_KEY}`."


async def test_node_rejects_unknown_sandbox_backend_type(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        """
        query SandboxProviderNode($id: ID!) {
          node(id: $id) {
            id
          }
        }
        """,
        variables={"id": str(GlobalID("SandboxProvider", "__bad_provider__"))},
    )

    assert response.errors
    assert any(
        "Unknown sandbox backend type: __bad_provider__" in (error.message or "")
        for error in response.errors
    ), response.errors
