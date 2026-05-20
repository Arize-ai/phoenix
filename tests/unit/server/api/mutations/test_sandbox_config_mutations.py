"""GraphQL-layer tests for sandbox config mutations.

Scope: behavior that's surfaced via the GraphQL boundary on
``createSandboxConfig`` / ``updateSandboxConfig`` / ``deleteSandboxConfig`` /
``updateSandboxProvider`` — capability gates, timeout invariants, DB
uniqueness, and rename semantics. Auth behavior is exercised in
``tests/integration/auth/test_auth.py``; pure pydantic / adapter behavior is
exercised in ``tests/unit/server/sandbox/``.
"""

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
    """WASM is omitted from ``_SANDBOX_ADAPTERS`` when wasmtime is not installed."""
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
    """``update_sandbox_config`` rejects per-adapter capability violations."""

    async def test_duplicate_env_var_name_returns_bad_request(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """The same env-var ``name`` twice is rejected by ``_names_are_unique``
        on the strawberry input's ``__post_init__``."""
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
        """Deno exposes no GraphQL internet-access input, so the schema rejects the field."""
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
        """Deno sandboxes intentionally don't accept env vars — ``DenoConfigInput``
        has no ``envVars`` field, so the GraphQL parser rejects it outright."""
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
        """``WASMConfigInput`` has no ``dependencies`` field, so the GraphQL
        parser rejects it before any pydantic / capability-gate logic runs."""
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
    """Invalid per-language package specs are rejected when submitted through
    the GraphQL input boundary.

    Distinct from the direct-pydantic tests in
    ``tests/unit/server/sandbox/test_sandbox_config_validation.py`` —
    those validate ``E2BConfig.model_validate({...})`` with a raw dict. The
    GraphQL path is structurally different: each per-provider ``ConfigInput``
    builds nested pydantic submodels (``DependenciesConfig(...)``) and hands
    them up to the parent ``E2BConfig.model_validate({...})``. Pre-fix, the
    parent's ``mode='before'`` validator short-circuited on
    ``isinstance(deps, dict)`` being False and never ran the per-package
    syntax check on that path. These tests pin that the after-validator
    closes that gap.
    """

    async def test_create_with_invalid_python_spec_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        """A pip-shaped Python config with an npm-style spec is rejected at
        ``createSandboxConfig`` time, before any DB write."""
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
        """A TypeScript Daytona config with a whitespace-containing spec is
        rejected at ``createSandboxConfig`` time."""
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
    """Row-immutability invariants on ``update_sandbox_config``.

    The mutation must reject (a) variants that don't match the row's
    ``backend_type`` and (b) language changes — both pin the
    discriminator/language pair to what was set at create time. Also
    covers the Language-Literal rejection on single-language provider
    inputs (WASM rejects TYPESCRIPT, Deno rejects PYTHON) which fires at
    pydantic ``model_validate`` time through the GraphQL boundary.
    """

    async def test_wasm_rejects_typescript_language(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        """``WASMConfig.language: Literal["PYTHON"]`` rejects TYPESCRIPT
        at pydantic ``model_validate``; the mutation maps it to BadRequest."""
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
        """``DenoConfig.language: Literal["TYPESCRIPT"]`` rejects PYTHON."""
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
        """Updating an E2B config with a WASM variant is rejected because
        ``backend_type`` is row-immutable."""
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
        """``language`` is row-immutable. Daytona supports both PYTHON and
        TYPESCRIPT, so the variant↔kind check passes — only the
        language-immutability guard blocks the rename."""
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
    """Timeout invariants on the create/update mutations."""

    async def test_create_without_timeout_persists_300(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        """Creating a config without a timeout falls back to the
        ``DEFAULT_SANDBOX_TIMEOUT_SECONDS`` (300) constant."""
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
        """An explicit timeout on create is persisted verbatim."""
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
        """Updating an unrelated field leaves the stored timeout untouched —
        PATCH semantics, not full replace."""
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
        """``timeout <= 0`` is rejected by ``__post_init__`` on both
        ``CreateSandboxConfigInput`` and ``UpdateSandboxConfigInput`` —
        independent copies of the same invariant. Both paths must remain
        guarded.
        """
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
    """Behavior around SandboxConfig.name on create and update."""

    async def test_create_duplicate_name_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        """Creating two configs with the same ``(backend_type, name)`` pair
        violates the DB UNIQUE constraint; the create mutation converts the
        IntegrityError into Conflict."""
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
        """Renaming a config to an existing name in the same provider
        triggers the DB UNIQUE constraint on update."""
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
        """Happy-path rename: the new name is applied and persisted."""
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
        """``name: null`` is a no-op on update — the existing name is
        preserved. Distinguishes UNSET, None, and a real Identifier."""
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
    """``update_sandbox_provider`` accepts per-provider deployment routing
    via a ``@oneOf`` variant. The mutation validates against the adapter's
    typed pydantic deployment model (URL schemes, mutual exclusion, etc.)
    and persists to ``SandboxProvider.config``; the read field
    ``SandboxProvider.deployment`` projects the stored blob back through
    the same validators.
    """

    async def test_daytona_deployment_round_trips(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        """Setting a Daytona deployment persists ``api_url`` + ``target`` and
        the read field surfaces the stored values."""
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
        """E2B accepts ``domain`` alone (``api_url`` left unset)."""
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
        """E2BDeployment's mutual-exclusion validator fires through the
        mutation boundary; the row's ``config`` is not mutated."""
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
        """Submitting an E2B deployment variant against the Daytona provider
        row is rejected as ``BadRequest`` before any DB write."""
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
        """The ``api_url`` URL-scheme validator fires through the mutation
        boundary — non-https/http schemes are rejected."""
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
        """Not sending ``deployment`` is a no-op — the existing stored blob
        survives an ``enabled``-only update."""
        async with db() as session:
            provider = await session.get(models.SandboxProvider, "DAYTONA")
            assert provider is not None
            # Stored blobs include the ``kind`` discriminator (writes go
            # through ``model_dump``); the read path validates via the
            # ``SandboxDeploymentModel`` discriminated union.
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
        """Sending ``deployment: null`` resets deployment routing to provider defaults."""
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
        """Providers whose SDK has no routing kwargs (WASM here) expose
        ``deployment: null`` on the read side."""
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
