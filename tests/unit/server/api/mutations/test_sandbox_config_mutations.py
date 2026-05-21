from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import LanguageName
from phoenix.db.types.identifier import Identifier
from phoenix.server import sandbox as sandbox_module
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.sandbox.deno_backend import DenoAdapter
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.wasm_backend import WASMAdapter
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_e2b_adapter = E2BAdapter()
_deno_adapter = DenoAdapter()
_wasm_adapter = WASMAdapter()


@pytest.fixture(autouse=True)
def _ensure_wasm_sandbox_adapter() -> Iterator[None]:
    # WASM is omitted from _SANDBOX_ADAPTERS when wasmtime is not installed.
    if "WASM" in sandbox_module._SANDBOX_ADAPTERS:
        yield
        return
    with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
        yield


_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
        }
    }
}
"""

_CREATE_WITH_TIMEOUT = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
            timeout
        }
    }
}
"""

_UPDATE = """
mutation UpdateSandboxConfig($input: UpdateSandboxConfigInput!) {
    updateSandboxConfig(input: $input) {
        sandboxConfig {
            id
        }
    }
}
"""

_UPDATE_WITH_TIMEOUT = """
mutation UpdateSandboxConfig($input: UpdateSandboxConfigInput!) {
    updateSandboxConfig(input: $input) {
        sandboxConfig {
            id
            timeout
        }
    }
}
"""


def _config_global_id(config_id: int) -> str:
    return str(GlobalID("SandboxConfig", str(config_id)))


async def _get_provider(
    db: DbSessionFactory, backend_type: models.SandboxBackendType
) -> models.SandboxProvider:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, backend_type)
    assert provider is not None, f"{backend_type} sandbox provider not found"
    return provider


def _primary_language(kind: models.SandboxBackendType) -> LanguageName:
    langs = SANDBOX_ADAPTER_METADATA[kind].supported_languages
    return sorted(langs)[0]


async def _create_config_for_provider(
    db: DbSessionFactory, provider: models.SandboxProvider
) -> models.SandboxConfig:
    async with db() as session:
        config = models.SandboxConfig(
            backend_type=provider.backend_type,
            language=_primary_language(provider.backend_type),
            name=Identifier.model_validate(f"cap-gate-test-config-{provider.backend_type.lower()}"),
            description="Capability gate regression test fixture",
            config={},
            timeout=30,
        )
        session.add(config)
        await session.flush()
        return config


class TestCapabilityGates:
    async def test_duplicate_env_var_name_returns_bad_request(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "E2B")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "e2b": {
                                "language": "PYTHON",
                                "envVars": [
                                    {"name": "FOO", "secretKey": "first"},
                                    {"name": "FOO", "secretKey": "second"},
                                ],
                            }
                        },
                    }
                },
            )
        assert result.errors
        assert any("Duplicate env var name: FOO" in (err.message or "") for err in result.errors), (
            result.errors
        )

    async def test_internet_access_field_absent_from_deno_input_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "DENO")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "deno": {"language": "TYPESCRIPT", "internetAccess": {"mode": "DENY"}}
                        },
                    }
                },
            )
        assert result.errors
        assert result.data is None

    async def test_env_vars_field_absent_from_deno_input_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "DENO")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "deno": {
                                "language": "TYPESCRIPT",
                                "envVars": [{"name": "FOO", "secretKey": "k"}],
                            }
                        },
                    }
                },
            )
        assert result.errors
        assert result.data is None

    async def test_dependencies_packages_on_unsupported_adapter_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "WASM")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "wasm": {
                                "language": "PYTHON",
                                "dependencies": {"packages": ["requests"]},
                            }
                        },
                    }
                },
            )
        assert result.errors
        assert result.data is None


class TestPackageSpecValidationThroughGraphQL:
    async def test_create_with_invalid_python_spec_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": {
                            "e2b": {
                                "language": "PYTHON",
                                "dependencies": {
                                    "packages": ["numpy", "openai@>=6.37.0"],
                                },
                            }
                        },
                        "name": "e2b-bad-python-spec",
                    }
                },
            )
        assert result.errors
        assert any("invalid Python package spec" in (err.message or "") for err in result.errors), (
            result.errors
        )

    async def test_create_with_invalid_npm_spec_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        from phoenix.server.sandbox.daytona_backend import DaytonaAdapter

        daytona_adapter = DaytonaAdapter()
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DAYTONA": daytona_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": {
                            "daytona": {
                                "language": "TYPESCRIPT",
                                "dependencies": {
                                    "packages": ["lodash", "has spaces"],
                                },
                            }
                        },
                        "name": "daytona-bad-npm-spec",
                    }
                },
            )
        assert result.errors
        assert any("invalid npm package spec" in (err.message or "") for err in result.errors), (
            result.errors
        )


class TestUpdateSandboxConfigInvariants:
    async def test_wasm_rejects_typescript_language(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "config": {"wasm": {"language": "TYPESCRIPT"}},
                    "name": "wasm-typescript-rejected",
                }
            },
        )
        assert result.errors
        assert any("TYPESCRIPT" in (err.message or "") for err in result.errors), result.errors

    async def test_deno_rejects_python_language(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": {"deno": {"language": "PYTHON"}},
                        "name": "deno-python-rejected",
                    }
                },
            )
        assert result.errors
        assert any("PYTHON" in (err.message or "") for err in result.errors), result.errors

    async def test_update_rejects_variant_kind_mismatch(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "E2B")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {"wasm": {"language": "PYTHON"}},
                    }
                },
            )
        assert result.errors
        assert any("does not match" in (err.message or "") for err in result.errors), result.errors

    async def test_update_rejects_language_change(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "DAYTONA")
        async with db() as session:
            config = models.SandboxConfig(
                backend_type=provider.backend_type,
                language="PYTHON",
                name=Identifier("daytona-python-original"),
                config={"backend_type": "DAYTONA", "language": "PYTHON"},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(config_id),
                    "config": {"daytona": {"language": "TYPESCRIPT"}},
                }
            },
        )
        assert result.errors
        assert any("row-immutable" in (err.message or "") for err in result.errors), result.errors


class TestTimeout:
    async def test_create_without_timeout_persists_300(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE_WITH_TIMEOUT,
                variables={
                    "input": {
                        "config": {"e2b": {"language": "PYTHON"}},
                        "name": "e2b-default-timeout",
                    }
                },
            )
        assert result.data and not result.errors
        assert result.data["createSandboxConfig"]["sandboxConfig"]["timeout"] == 300

    async def test_create_with_explicit_timeout_persists_given_value(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE_WITH_TIMEOUT,
                variables={
                    "input": {
                        "config": {"e2b": {"language": "PYTHON"}},
                        "name": "e2b-explicit-timeout",
                        "timeout": 60,
                    }
                },
            )
        assert result.data and not result.errors
        assert result.data["createSandboxConfig"]["sandboxConfig"]["timeout"] == 60

    async def test_existing_explicit_timeout_preserved_when_not_updated(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        provider = await _get_provider(db, "E2B")
        async with db() as session:
            config = models.SandboxConfig(
                backend_type=provider.backend_type,
                language=_primary_language(provider.backend_type),
                name=Identifier("e2b-preserve-timeout"),
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE_WITH_TIMEOUT,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "description": "updated description only",
                    }
                },
            )
        assert result.data and not result.errors
        assert result.data["updateSandboxConfig"]["sandboxConfig"]["timeout"] == 30

    async def test_non_positive_timeout_rejected_on_both_paths(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        create_result = await gql_client.execute(
            _CREATE_WITH_TIMEOUT,
            variables={
                "input": {
                    "config": {"wasm": {"language": "PYTHON"}},
                    "name": "zero-timeout",
                    "timeout": 0,
                }
            },
        )
        assert create_result.errors
        assert any("timeout" in (err.message or "") for err in create_result.errors), (
            create_result.errors
        )

        config = await _create_config_for_provider(db, await _get_provider(db, "WASM"))
        update_result = await gql_client.execute(
            _UPDATE_WITH_TIMEOUT,
            variables={
                "input": {
                    "id": _config_global_id(config.id),
                    "timeout": -5,
                }
            },
        )
        assert update_result.errors
        assert any("timeout" in (err.message or "") for err in update_result.errors), (
            update_result.errors
        )


class TestNameSemantics:
    async def test_create_duplicate_name_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        first = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "config": {"wasm": {"language": "PYTHON"}},
                    "name": "duplicate-cfg",
                }
            },
        )
        assert first.data and not first.errors

        dup = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "config": {"wasm": {"language": "PYTHON"}},
                    "name": "duplicate-cfg",
                }
            },
        )
        assert dup.errors
        assert any("already exists" in (err.message or "") for err in dup.errors), dup.errors

    async def test_update_rename_collision_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
        db: DbSessionFactory,
    ) -> None:
        provider = await _get_provider(db, "WASM")
        async with db() as session:
            existing = models.SandboxConfig(
                backend_type=provider.backend_type,
                language=_primary_language(provider.backend_type),
                name=Identifier("existing-cfg"),
                config={},
                timeout=30,
            )
            target = models.SandboxConfig(
                backend_type=provider.backend_type,
                language=_primary_language(provider.backend_type),
                name=Identifier("target-cfg"),
                config={},
                timeout=30,
            )
            session.add(existing)
            session.add(target)
            await session.flush()
            target_id = target.id

        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(target_id),
                    "name": "existing-cfg",
                }
            },
        )
        assert result.errors
        assert any("already exists" in (err.message or "") for err in result.errors), result.errors

    async def test_update_rename_to_fresh_name_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
        db: DbSessionFactory,
    ) -> None:
        provider = await _get_provider(db, "WASM")
        config = await _create_config_for_provider(db, provider)
        original_id = config.id

        result = await gql_client.execute(
            """
            mutation RenameSandboxConfig($input: UpdateSandboxConfigInput!) {
                updateSandboxConfig(input: $input) {
                    sandboxConfig { id name }
                }
            }
            """,
            variables={
                "input": {
                    "id": _config_global_id(config.id),
                    "name": "renamed-cfg",
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["name"] == "renamed-cfg"
        async with db() as session:
            row = await session.get(models.SandboxConfig, original_id)
        assert row is not None
        assert row.name == Identifier("renamed-cfg")

    async def test_update_name_null_is_noop(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
        db: DbSessionFactory,
    ) -> None:
        provider = await _get_provider(db, "WASM")
        config = await _create_config_for_provider(db, provider)
        original_name = config.name

        result = await gql_client.execute(
            """
            mutation NullRenameSandboxConfig($input: UpdateSandboxConfigInput!) {
                updateSandboxConfig(input: $input) {
                    sandboxConfig { id name }
                }
            }
            """,
            variables={
                "input": {
                    "id": _config_global_id(config.id),
                    "name": None,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["name"] == original_name.root


def _provider_global_id(backend_type: models.SandboxBackendType) -> str:
    return str(GlobalID("SandboxProvider", backend_type))


_UPDATE_PROVIDER = """
mutation UpdateSandboxProvider($input: UpdateSandboxProviderInput!) {
    updateSandboxProvider(input: $input) {
        sandboxProvider {
            id
            enabled
            deployment {
                __typename
                ... on DaytonaDeploymentData { apiUrl target }
                ... on E2BDeploymentData { domain apiUrl }
            }
        }
    }
}
"""


class TestUpdateSandboxProviderDeployment:
    async def test_daytona_deployment_round_trips(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("DAYTONA"),
                    "deployment": {
                        "daytona": {
                            "apiUrl": "https://daytona.example.com",
                            "target": "us-east",
                        }
                    },
                }
            },
        )
        assert result.data and not result.errors, result.errors
        payload = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert payload["deployment"] == {
            "__typename": "DaytonaDeploymentData",
            "apiUrl": "https://daytona.example.com",
            "target": "us-east",
        }

    async def test_e2b_deployment_round_trips(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("E2B"),
                    "deployment": {"e2b": {"domain": "tenant.e2b.dev"}},
                }
            },
        )
        assert result.data and not result.errors, result.errors
        payload = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert payload["deployment"] == {
            "__typename": "E2BDeploymentData",
            "domain": "tenant.e2b.dev",
            "apiUrl": None,
        }

    async def test_e2b_deployment_domain_and_api_url_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("E2B"),
                    "deployment": {
                        "e2b": {
                            "domain": "tenant.e2b.dev",
                            "apiUrl": "https://tenant.e2b.dev/api",
                        }
                    },
                }
            },
        )
        assert result.errors
        assert any("mutually exclusive" in (err.message or "") for err in result.errors), (
            result.errors
        )
        assert any("mutually exclusive" in (err.message or "") for err in result.errors), (
            result.errors
        )

    async def test_variant_kind_mismatch_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("DAYTONA"),
                    "deployment": {"e2b": {"domain": "tenant.e2b.dev"}},
                }
            },
        )
        assert result.errors
        assert any("does not match" in (err.message or "") for err in result.errors), result.errors

    async def test_daytona_deployment_bad_url_scheme_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("DAYTONA"),
                    "deployment": {
                        "daytona": {"apiUrl": "file:///etc/passwd"},
                    },
                }
            },
        )
        assert result.errors

    async def test_deployment_unset_leaves_stored_blob_intact(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, "DAYTONA")
            assert provider is not None
            provider.config = {
                "backend_type": "DAYTONA",
                "api_url": "https://prior.daytona.example",
                "target": "eu",
            }

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {"id": _provider_global_id("DAYTONA"), "enabled": False},
            },
        )
        assert result.data and not result.errors, result.errors
        payload = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert payload["enabled"] is False
        assert payload["deployment"] == {
            "__typename": "DaytonaDeploymentData",
            "apiUrl": "https://prior.daytona.example",
            "target": "eu",
        }

    async def test_deployment_null_clears_stored_blob(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, "E2B")
            assert provider is not None
            provider.config = {
                "backend_type": "E2B",
                "domain": "tenant.e2b.dev",
            }

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id("E2B"),
                    "deployment": None,
                },
            },
        )
        assert result.data and not result.errors, result.errors
        payload = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert payload["deployment"] is None

        async with db() as session:
            provider = await session.get(models.SandboxProvider, "E2B")
            assert provider is not None
            assert provider.config == {}

    async def test_deployment_field_null_for_no_deployment_provider(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            """
            query SandboxProvider($id: ID!) {
                node(id: $id) {
                    ... on SandboxProvider {
                        deployment { __typename }
                    }
                }
            }
            """,
            variables={"id": _provider_global_id("WASM")},
        )
        assert result.data and not result.errors, result.errors
        assert result.data["node"]["deployment"] is None
