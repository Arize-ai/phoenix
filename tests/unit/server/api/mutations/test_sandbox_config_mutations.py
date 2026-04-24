"""Regression and behavior tests for update_sandbox_config capability gates.

Covers two related concerns:

1. Exception-type regression (task #1): update_sandbox_config must convert
   both ValueError and ValidationError from validate_config into BadRequest,
   matching the equivalent handler in create_sandbox_config.

2. Stored-baseline passthrough (task #8): when a stored config already
   contains a capability-gated section and the submitted update value is
   semantically unchanged, the update must succeed. The create path retains
   strict rejection (no stored baseline).
"""

from __future__ import annotations

from unittest.mock import patch

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server import sandbox as sandbox_module
from phoenix.server.sandbox.deno_backend import DenoAdapter
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.wasm_backend import WASMAdapter
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_e2b_adapter = E2BAdapter()
_deno_adapter = DenoAdapter()
_wasm_adapter = WASMAdapter()

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


def _provider_global_id(provider_id: int) -> str:
    return str(GlobalID("SandboxProvider", str(provider_id)))


async def _get_provider(db: DbSessionFactory, backend_type: str) -> models.SandboxProvider:
    async with db() as session:
        provider = await session.scalar(
            select(models.SandboxProvider).where(
                models.SandboxProvider.backend_type == backend_type
            )
        )
    assert provider is not None, f"{backend_type} sandbox provider not found"
    return provider


async def _create_config_for_provider(
    db: DbSessionFactory, provider: models.SandboxProvider
) -> models.SandboxConfig:
    async with db() as session:
        config = models.SandboxConfig(
            sandbox_provider_id=provider.id,
            name=f"cap-gate-test-config-{provider.backend_type.lower()}",
            description="Capability gate regression test fixture",
            config={},
            timeout=30,
        )
        session.add(config)
        await session.flush()
        return config


class TestUpdateSandboxConfigCapabilityGates:
    """Capability-gate ValidationError paths on update_sandbox_config must
    surface as BadRequest errors, not 500s."""

    async def test_duplicate_env_var_name_returns_bad_request(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Two env_var entries with the same name must be rejected at update
        time. _enforce_unique_env_var_names raises ValidationError; the update
        mutation must convert it to BadRequest."""
        provider = await _get_provider(db, "E2B")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "env_vars": [
                                {"kind": "literal", "name": "FOO", "value": "first"},
                                {"kind": "literal", "name": "FOO", "value": "second"},
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_internet_access_on_none_capability_adapter_returns_bad_request(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Setting internet_access on an adapter with internet_access_capability='none'
        must be rejected. _enforce_capability_gates raises ValidationError; the
        update mutation must convert it to BadRequest."""
        provider = await _get_provider(db, "DENO")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "internet_access": {"mode": "deny"},
                        },
                    }
                },
            )
        assert result.errors

    async def test_dependencies_packages_on_null_language_adapter_returns_bad_request(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Setting dependencies.packages on an adapter with dependencies_language=None
        must be rejected. _enforce_capability_gates raises ValidationError; the
        update mutation must convert it to BadRequest."""
        provider = await _get_provider(db, "WASM")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "dependencies": {"packages": ["requests"]},
                        },
                    }
                },
            )
        assert result.errors


class TestStoredBaselinePassthrough:
    """Update-path capability gates must pass when the submitted section is
    semantically unchanged from the stored baseline (round-trip preservation).
    Create-path gates remain strict (no stored baseline)."""

    async def test_create_still_rejects_unsupported_internet_access(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Create path has no stored baseline — gate must still reject."""
        provider = await _get_provider(db, "DENO")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "deno-create-ia-reject",
                        "config": {"internet_access": {"mode": "deny"}},
                    }
                },
            )
        assert result.errors

    async def test_create_still_rejects_unsupported_dependencies(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Create path has no stored baseline — gate must still reject."""
        provider = await _get_provider(db, "WASM")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "wasm-create-deps-reject",
                        "config": {"dependencies": {"packages": ["requests"]}},
                    }
                },
            )
        assert result.errors

    async def test_update_preserved_internet_access_passes(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Stored config already has internet_access; round-tripping the same
        value must succeed even on a 'none'-capability adapter."""
        provider = await _get_provider(db, "DENO")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="deno-preserved-ia",
                description="Pre-existing config with internet_access",
                config={"internet_access": {"mode": "deny"}},
                timeout=30,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {"internet_access": {"mode": "deny"}},
                    }
                },
            )
        assert result.data and not result.errors

    async def test_update_changing_internet_access_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Changing internet_access to a different value on a 'none'-capability
        adapter must still be rejected even with a stored baseline."""
        provider = await _get_provider(db, "DENO")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="deno-changed-ia",
                description="Pre-existing config with internet_access",
                config={"internet_access": {"mode": "deny"}},
                timeout=30,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"DENO": _deno_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {"internet_access": {"mode": "allow"}},
                    }
                },
            )
        assert result.errors

    async def test_update_preserved_dependencies_packages_passes(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Stored config already has dependencies.packages; round-tripping the
        same packages must succeed on a null-dependencies-language adapter."""
        provider = await _get_provider(db, "WASM")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="wasm-preserved-deps",
                description="Pre-existing config with dependencies",
                config={"dependencies": {"packages": ["requests", "numpy"]}},
                timeout=30,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        # Order-independent: same packages in different order
                        "config": {"dependencies": {"packages": ["numpy", "requests"]}},
                    }
                },
            )
        assert result.data and not result.errors

    async def test_update_adding_new_dependency_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Adding a new package to dependencies on a null-language adapter must
        be rejected even when a stored baseline exists."""
        provider = await _get_provider(db, "WASM")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="wasm-new-dep",
                description="Pre-existing config with dependencies",
                config={"dependencies": {"packages": ["requests"]}},
                timeout=30,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {"dependencies": {"packages": ["requests", "numpy"]}},
                    }
                },
            )
        assert result.errors


class TestReservedSecretKeyRejected:
    """secret_ref.secret_key matching a reserved provider-credential name must
    be rejected at mutation time on both create and update paths."""

    async def test_create_rejects_reserved_secret_key(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """createSandboxConfig must reject secret_ref entries whose secret_key
        matches a reserved provider-credential name."""
        provider = await _get_provider(db, "E2B")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-reserved-secret-key",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "MY_TOKEN",
                                    "secret_key": "VERCEL_TOKEN",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_update_rejects_reserved_secret_key(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """updateSandboxConfig must reject secret_ref entries whose secret_key
        matches a reserved provider-credential name."""
        provider = await _get_provider(db, "E2B")
        config = await _create_config_for_provider(db, provider)

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "MY_TOKEN",
                                    "secret_key": "VERCEL_TOKEN",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_reserved_secret_key_case_insensitive(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Reserved secret_key comparison is case-insensitive."""
        provider = await _get_provider(db, "E2B")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-reserved-secret-key-lower",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "MY_TOKEN",
                                    "secret_key": "vercel_token",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_non_reserved_secret_key_accepted(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """A non-reserved secret_key must be accepted at mutation time."""
        provider = await _get_provider(db, "E2B")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-non-reserved-secret-key",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "MY_OPENAI_KEY",
                                    "secret_key": "my-openai-key",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.data and not result.errors


class TestSandboxConfigTimeoutDefault:
    """The default timeout is 300s at both the DB and application layers."""

    async def test_create_without_timeout_persists_300(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Creating a config without an explicit timeout must default to 300."""
        provider = await _get_provider(db, "E2B")

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE_WITH_TIMEOUT,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-default-timeout",
                    }
                },
            )
        assert result.data and not result.errors
        assert result.data["createSandboxConfig"]["sandboxConfig"]["timeout"] == 300

    async def test_create_with_explicit_timeout_persists_given_value(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Creating a config with an explicit timeout must persist that value."""
        provider = await _get_provider(db, "E2B")

        for timeout_value in (30, 60, 120):
            with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
                result = await gql_client.execute(
                    _CREATE_WITH_TIMEOUT,
                    variables={
                        "input": {
                            "sandboxProviderId": _provider_global_id(provider.id),
                            "name": f"e2b-explicit-timeout-{timeout_value}",
                            "timeout": timeout_value,
                        }
                    },
                )
            assert result.data and not result.errors
            assert result.data["createSandboxConfig"]["sandboxConfig"]["timeout"] == timeout_value

    async def test_update_timeout_to_null_resets_to_300(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Setting timeout=null via update resets to the default of 300."""
        provider = await _get_provider(db, "E2B")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="e2b-reset-timeout",
                config={},
                timeout=60,
            )
            session.add(config)
            await session.flush()

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE_WITH_TIMEOUT,
                variables={
                    "input": {
                        "id": _config_global_id(config.id),
                        "timeout": None,
                    }
                },
            )
        assert result.data and not result.errors
        assert result.data["updateSandboxConfig"]["sandboxConfig"]["timeout"] == 300

    async def test_existing_explicit_timeout_preserved_when_not_updated(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Updating an unrelated field leaves an explicitly-stored timeout untouched."""
        provider = await _get_provider(db, "E2B")
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="e2b-preserve-timeout",
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
