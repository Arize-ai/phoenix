"""Tests for sandbox GQL mutations: createSandboxConfig, updateSandboxConfig,
updateSandboxProvider, deleteSandboxConfig.

Uses the gql_client fixture to send real GQL mutations against the in-memory
test app, backed by seed_sandbox_providers DB fixtures.
"""

from __future__ import annotations

from secrets import token_hex
from typing import Any
from unittest.mock import patch

import sqlalchemy as sa
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server import sandbox as sandbox_module
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_e2b_adapter = E2BAdapter()
_patched_adapters = {**sandbox_module._SANDBOX_ADAPTERS, "E2B": _e2b_adapter}

# ---------------------------------------------------------------------------
# GraphQL documents
# ---------------------------------------------------------------------------

_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
            name
            description
            timeout
            enabled
        }
    }
}
"""

_UPDATE = """
mutation UpdateSandboxConfig($input: UpdateSandboxConfigInput!) {
    updateSandboxConfig(input: $input) {
        sandboxConfig {
            id
            name
            description
            timeout
            enabled
        }
    }
}
"""

_DELETE = """
mutation DeleteSandboxConfig($input: DeleteSandboxConfigInput!) {
    deleteSandboxConfig(input: $input) {
        deletedId
    }
}
"""

_UPDATE_PROVIDER = """
mutation UpdateSandboxProvider($input: UpdateSandboxProviderInput!) {
    updateSandboxProvider(input: $input) {
        sandboxProvider {
            id
            enabled
        }
    }
}
"""

_SANDBOX_PROVIDERS = """
query SandboxProviders {
    sandboxProviders {
        id
        backendType
        configs {
            id
            name
        }
    }
}
"""

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _config_global_id(config_id: int) -> str:
    return str(GlobalID("SandboxConfig", str(config_id)))


def _provider_global_id(provider_id: int) -> str:
    return str(GlobalID("SandboxProvider", str(provider_id)))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCreateSandboxConfig:
    async def test_creates_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
        assert provider is not None

        result = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "sandboxProviderId": _provider_global_id(provider.id),
                    "name": "my-wasm-config",
                    "timeout": 15,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["createSandboxConfig"]["sandboxConfig"]
        assert cfg["name"] == "my-wasm-config"
        assert cfg["timeout"] == 15
        assert cfg["enabled"] is True

    async def test_create_config_not_found_provider_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "sandboxProviderId": _provider_global_id(99999),
                    "name": "ghost-config",
                }
            },
        )
        assert result.errors


class TestUpdateSandboxConfig:
    async def test_updates_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "timeout": 60,
                    "description": "updated description",
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == 60
        assert cfg["description"] == "updated description"
        assert cfg["enabled"] is False

    async def test_update_only_description_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "description": "new desc",
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["description"] == "new desc"
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["enabled"] is True

    async def test_update_only_timeout_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "timeout": 120,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == 120
        assert cfg["description"] == sandbox_config.description

    async def test_update_only_enabled_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["enabled"] is False
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["description"] == sandbox_config.description

    async def test_update_no_fields_is_noop(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["description"] == sandbox_config.description
        assert cfg["enabled"] is True

    async def test_update_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": _config_global_id(99999), "timeout": 5}},
        )
        assert result.errors


class TestDeleteSandboxConfig:
    async def test_deletes_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        config_id = sandbox_config.id
        config_gid = _config_global_id(config_id)

        result = await gql_client.execute(_DELETE, variables={"input": {"id": config_gid}})
        assert result.data and not result.errors
        assert result.data["deleteSandboxConfig"]["deletedId"] == config_gid

        # Verify row is gone from DB
        async with db() as session:
            row = await session.get(models.SandboxConfig, config_id)
        assert row is None

    async def test_delete_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _DELETE, variables={"input": {"id": _config_global_id(99999)}}
        )
        assert result.errors


class TestUpdateSandboxProvider:
    async def test_updates_provider_enabled(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.id),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        sandbox_provider = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sandbox_provider["enabled"] is False

    async def test_update_provider_no_fields_is_noop(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
        assert provider is not None
        original_enabled = provider.enabled

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.id),
                }
            },
        )
        assert result.data and not result.errors
        sp = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sp["enabled"] is original_enabled

    async def test_update_provider_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={"input": {"id": _provider_global_id(99999), "enabled": True}},
        )
        assert result.errors


_EVALUATOR_PREVIEWS = """
mutation EvaluatorPreviews($input: EvaluatorPreviewsInput!) {
    evaluatorPreviews(input: $input) {
        results {
            evaluatorName
            error
        }
    }
}
"""

_CREATE_CODE_EVALUATOR = """
mutation CreateCodeEvaluator($input: CreateCodeEvaluatorInput!) {
    createCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                currentVersion {
                    id
                }
            }
        }
    }
}
"""

_PATCH_CODE_EVALUATOR = """
mutation PatchCodeEvaluator($input: PatchCodeEvaluatorInput!) {
    patchCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                name
                description
                sandboxConfig {
                    id
                }
            }
        }
    }
}
"""

_CREATE_CODE_EVALUATOR_VERSION = """
mutation CreateCodeEvaluatorVersion($input: CreateCodeEvaluatorVersionInput!) {
    createCodeEvaluatorVersion(input: $input) {
        wasCreated
        evaluator {
            id
            ... on CodeEvaluator {
                currentVersion {
                    id
                    sourceCode
                }
            }
        }
    }
}
"""


async def _create_code_evaluator_with_config(
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> int:
    """Insert a CodeEvaluator with one version linked to the given sandbox config."""
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
        assert provider is not None
        code_eval = models.CodeEvaluator(
            name=Identifier(root="test-disabled-guard-eval"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
        )
        session.add(code_eval)
        await session.flush()
        version = models.CodeEvaluatorVersion(
            code_evaluator_id=code_eval.id,
            source_code="def evaluate(input): return {'score': 1.0}",
        )
        session.add(version)
        await session.flush()
        return code_eval.id


async def _create_code_evaluator_with_two_versions(
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> tuple[int, int, int]:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
        assert provider is not None
        code_eval = models.CodeEvaluator(
            name=Identifier(root=f"test-history-eval-{token_hex(4)}"),
            description=None,
            metadata_={},
            language=provider.language,
            sandbox_config_id=sandbox_config.id,
        )
        session.add(code_eval)
        await session.flush()
        common_kwargs: dict[str, Any] = dict(
            code_evaluator_id=code_eval.id,
        )
        first_version = models.CodeEvaluatorVersion(
            source_code="def evaluate(input): return {'score': 0.0}",
            **common_kwargs,
        )
        second_version = models.CodeEvaluatorVersion(
            source_code="def evaluate(input): return {'score': 1.0}",
            **common_kwargs,
        )
        session.add_all([first_version, second_version])
        await session.flush()
        return code_eval.id, first_version.id, second_version.id


class TestDisabledProviderAndConfigGuards:
    async def test_disabled_provider_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        # Disable the provider via the updateSandboxProvider mutation
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
        assert provider is not None
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.id),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors

        # Preview should fail — no backend resolved when provider is disabled
        result = await gql_client.execute(
            _EVALUATOR_PREVIEWS,
            variables={
                "input": {
                    "previews": [
                        {
                            "evaluator": {"codeEvaluatorId": evaluator_gid},
                            "context": {"output": "test"},
                            "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        }
                    ]
                }
            },
        )
        assert result.errors
        assert (
            "Sandbox provider 'WASM' is disabled. Enable it before testing this evaluator."
            in str(result.errors)
        )


class TestCodeEvaluatorSandboxMutationIds:
    async def test_create_code_evaluator_accepts_sandbox_global_id(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": {
                    "name": "test_code_evaluator",
                    "description": "uses relay id",
                    "language": "PYTHON",
                    "sourceCode": "def evaluate(output):\n    return {'score': 1.0}",
                    "sandboxConfigId": _config_global_id(sandbox_config.id),
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                    "outputConfigs": [
                        {
                            "continuous": {
                                "name": "score",
                                "optimizationDirection": "NONE",
                                "lowerBound": 0,
                                "upperBound": 1,
                            }
                        }
                    ],
                }
            },
        )
        assert result.data and not result.errors
        evaluator = result.data["createCodeEvaluator"]["evaluator"]
        assert evaluator["currentVersion"]["id"]

        evaluator_id = GlobalID.from_id(evaluator["id"])
        async with db() as session:
            row = await session.get(models.CodeEvaluator, int(evaluator_id.node_id))
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_create_code_evaluator_version_appends_when_code_changes(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        """createCodeEvaluatorVersion appends a new immutable row when the
        source_code changes. Sandbox binding is not part of the version row."""
        async with db() as session:
            code_eval = models.CodeEvaluator(
                name=Identifier(root="test_update_code_evaluator"),
                description=None,
                metadata_={},
                language="PYTHON",
                sandbox_config_id=sandbox_config.id,
            )
            session.add(code_eval)
            await session.flush()
            seed = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code="def evaluate(output): return {'score': 0.0}",
            )
            session.add(seed)
            await session.flush()
            evaluator_gid = str(GlobalID("CodeEvaluator", str(code_eval.id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def evaluate(output): return {'score': 1.0}",
                }
            },
        )
        assert result.data and not result.errors
        payload = result.data["createCodeEvaluatorVersion"]
        assert payload["wasCreated"] is True
        assert (
            payload["evaluator"]["currentVersion"]["sourceCode"]
            == "def evaluate(output): return {'score': 1.0}"
        )

        async with db() as session:
            row = await session.get(models.CodeEvaluator, code_eval.id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_create_code_evaluator_version_dedups_identical_content(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id, _, current_version_id = await _create_code_evaluator_with_two_versions(
            db, sandbox_config
        )
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def evaluate(input): return {'score': 1.0}",
                }
            },
        )

        assert result.data and not result.errors
        payload = result.data["createCodeEvaluatorVersion"]
        assert payload["wasCreated"] is False
        current_version = payload["evaluator"]["currentVersion"]
        assert current_version["id"] == str(
            GlobalID("CodeEvaluatorVersion", str(current_version_id))
        )
        async with db() as session:
            version_count = await session.scalar(
                select(sa.func.count(models.CodeEvaluatorVersion.id)).where(
                    models.CodeEvaluatorVersion.code_evaluator_id == evaluator_db_id
                )
            )
        assert version_count == 2

    async def test_create_code_evaluator_version_rejects_uninferable_source(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id, _, _ = await _create_code_evaluator_with_two_versions(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def not_evaluate(input): return {'score': 1.0}",
                }
            },
        )

        assert result.errors
        assert "evaluate" in str(result.errors)

    async def test_patch_code_evaluator_rejects_source_and_language_fields(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sourceCode": "def evaluate(input): return {'score': 0.0}",
                    "language": "PYTHON",
                }
            },
        )

        assert result.errors
        assert len(result.errors) == 2

    async def test_patch_code_evaluator_updates_sandbox_binding(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
        seed_sandbox_providers: None,
    ) -> None:
        """Happy path: patchCodeEvaluator(sandboxConfigId=B) updates the tip's
        sandbox binding without bumping a version — sandbox is binding state on
        the tip, not version content."""
        # Build a second WASM/Python config (B) to switch the binding to.
        async with db() as session:
            python_provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert python_provider is not None
            sandbox_config_b = models.SandboxConfig(
                sandbox_provider_id=python_provider.id,
                language=python_provider.language,
                name=f"sandbox-b-{token_hex(4)}",
                description=None,
                config={},
                timeout=45,
            )
            session.add(sandbox_config_b)
            await session.flush()
            sandbox_config_b_id = sandbox_config_b.id

        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))
        sandbox_b_gid = str(GlobalID("SandboxConfig", str(sandbox_config_b_id)))

        patch_result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sandboxConfigId": sandbox_b_gid,
                }
            },
        )
        assert patch_result.data and not patch_result.errors, patch_result.errors
        patched = patch_result.data["patchCodeEvaluator"]["evaluator"]
        assert patched["sandboxConfig"]["id"] == sandbox_b_gid

        async with db() as session:
            row = await session.get(models.CodeEvaluator, evaluator_db_id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config_b_id

    async def test_disabled_config_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        # Disable the sandbox config via the mutation
        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": _config_global_id(sandbox_config.id), "enabled": False}},
        )
        assert result.data and not result.errors
        assert result.data["updateSandboxConfig"]["sandboxConfig"]["enabled"] is False

        # Preview should fail — no backend resolved when config is disabled
        result = await gql_client.execute(
            _EVALUATOR_PREVIEWS,
            variables={
                "input": {
                    "previews": [
                        {
                            "evaluator": {"codeEvaluatorId": evaluator_gid},
                            "context": {"output": "test"},
                            "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        }
                    ]
                }
            },
        )
        assert result.errors
        assert (
            f"Sandbox configuration '{sandbox_config.name}' is disabled. "
            "Enable it before testing this evaluator."
        ) in str(result.errors)


class TestMultiConfigOrdering:
    async def test_configs_returned_in_name_asc_order(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Seed 3 configs with different names, assert configs() returns name ASC."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
        assert provider is not None

        names = ["zebra-config", "alpha-config", "middle-config"]
        for name in names:
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": name,
                    }
                },
            )
            assert result.data and not result.errors

        result = await gql_client.execute(_SANDBOX_PROVIDERS)
        assert result.data and not result.errors
        providers = result.data["sandboxProviders"]

        # Find the WASM provider by matching its ID
        wasm_provider = next(p for p in providers if p["id"] == _provider_global_id(provider.id))
        config_names = [c["name"] for c in wasm_provider["configs"]]
        assert config_names == sorted(config_names)


class TestCrossProviderIsolation:
    async def test_configs_isolated_per_provider(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Configs under provider A must not appear under provider B."""
        async with db() as session:
            wasm = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            e2b = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert wasm is not None and e2b is not None

        # Create configs under each provider
        wasm_names = ["wasm-cfg-1", "wasm-cfg-2"]
        e2b_names = ["e2b-cfg-1"]
        for name in wasm_names:
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(wasm.id),
                        "name": name,
                    }
                },
            )
            assert result.data and not result.errors
        for name in e2b_names:
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(e2b.id),
                        "name": name,
                    }
                },
            )
            assert result.data and not result.errors

        result = await gql_client.execute(_SANDBOX_PROVIDERS)
        assert result.data and not result.errors
        providers = {p["id"]: p for p in result.data["sandboxProviders"]}

        wasm_config_names = [c["name"] for c in providers[_provider_global_id(wasm.id)]["configs"]]
        e2b_config_names = [c["name"] for c in providers[_provider_global_id(e2b.id)]["configs"]]

        assert set(wasm_config_names) == set(wasm_names)
        assert set(e2b_config_names) == set(e2b_names)
        # No overlap
        assert not set(wasm_config_names) & set(e2b_config_names)


class TestConfigValidationPath:
    """
    Integration tests for the validation path in create/update mutations.

    Patches _SANDBOX_ADAPTERS to always include E2BAdapter (which has declared
    config fields), independent of whether e2b_code_interpreter is installed.
    E2BAdapter.validate_config() only needs pydantic — no optional extras.
    """

    async def test_create_valid_e2b_config_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-valid",
                        "config": {
                            "env_vars": [{"kind": "literal", "name": "FOO", "value": "bar"}],
                        },
                    }
                },
            )
        assert result.data and not result.errors

    async def test_create_rejects_unknown_keys(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """extra="forbid" means unknown keys must be rejected at the mutation boundary.

        Canonical config shape per adapter is the closed set declared on the
        per-adapter pydantic model (env_vars / internet_access / dependencies).
        Anything outside that set is a stale or attacker-supplied key and must
        surface as a BadRequest rather than silently persisting.
        """
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-extra-keys",
                        "config": {"custom_key": "preserved"},
                    }
                },
            )
        assert result.errors

    async def test_update_valid_config_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        # Create a config first
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                language=provider.language,
                name="e2b-update-test",
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config_id),
                        "config": {
                            "env_vars": [{"kind": "literal", "name": "FOO", "value": "bar"}],
                        },
                    }
                },
            )
        assert result.data and not result.errors

    async def test_update_config_persists_validated_dict(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """After update, DB row stores the validated (pydantic model_dump) dict."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                language=provider.language,
                name="e2b-persist-test",
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        new_env_vars = [{"kind": "literal", "name": "FOO", "value": "bar"}]
        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config_id),
                        "config": {"env_vars": new_env_vars},
                    }
                },
            )
        assert result.data and not result.errors

        async with db() as session:
            row = await session.get(models.SandboxConfig, config_id)
        assert row is not None
        # env_vars was provided — must be persisted
        assert row.config.get("env_vars") == new_env_vars

    async def test_create_env_var_round_trip(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """env_vars inside config persist through create mutation."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-env-vars",
                        "config": {
                            "env_vars": [{"kind": "literal", "name": "FOO", "value": "bar"}],
                        },
                    }
                },
            )
        assert result.data and not result.errors
        cfg_id = result.data["createSandboxConfig"]["sandboxConfig"]["id"]

        async with db() as session:
            from strawberry.relay import GlobalID as GID

            row_id = int(GID.from_id(cfg_id).node_id)
            row = await session.get(models.SandboxConfig, row_id)
        assert row is not None
        env_vars = row.config.get("env_vars")
        assert env_vars == [{"kind": "literal", "name": "FOO", "value": "bar"}]

    async def test_create_reserved_env_var_name_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """PHOENIX_SANDBOX_* env var names must be rejected with a BadRequest."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-reserved",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "literal",
                                    "name": "E2B_API_KEY",
                                    "value": "bad",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_create_vercel_token_reserved_name_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Adapter-owned credentials like VERCEL_TOKEN must also be rejected at
        createSandboxConfig time — reserved-name coverage is derived from every
        adapter's credential_specs, regardless of naming prefix."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            # env_vars surface
            env_var_result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-vercel-token-env",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "VERCEL_TOKEN",
                                    "secret_key": "anything",
                                }
                            ]
                        },
                    }
                },
            )
            # top-level config surface
            top_level_result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-vercel-token-top",
                        "config": {"VERCEL_TOKEN": "attacker-value"},
                    }
                },
            )
        assert env_var_result.errors, (
            "Expected BadRequest for VERCEL_TOKEN in env_vars; "
            "reserved-name enforcement may not cover adapter-owned credentials"
        )
        assert top_level_result.errors, (
            "Expected BadRequest for VERCEL_TOKEN as top-level config key; "
            "reserved-name enforcement may not cover top-level SandboxConfig.config"
        )

    async def test_update_reserved_env_var_name_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Reserved provider-credential names are also rejected on update."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                language=provider.language,
                name="e2b-reserved-update",
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config_id),
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "secret_ref",
                                    "name": "VERCEL_TOKEN",
                                    "secret_key": "my-secret",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors


# ---------------------------------------------------------------------------
# Admin gate: IsAdminIfAuthEnabled on createSandboxConfig / updateSandboxConfig
# ---------------------------------------------------------------------------


class TestAdminGate:
    """
    Unit-level tests for the IsAdminIfAuthEnabled permission class behaviour.

    The integration fixture (gql_client) runs with authentication_enabled=False,
    so IsAdminIfAuthEnabled always returns True there — existing tests remain
    unaffected. These tests verify the permission logic directly.
    """

    def _make_info(self, *, auth_enabled: bool, is_admin: bool) -> object:
        from typing import Literal
        from unittest.mock import MagicMock

        from phoenix.server.bearer_auth import PhoenixUser
        from phoenix.server.types import AccessTokenId, UserClaimSet, UserId, UserTokenAttributes

        user_id = UserId(1)
        role: Literal["ADMIN", "MEMBER"] = "ADMIN" if is_admin else "MEMBER"
        claims = UserClaimSet(
            subject=user_id,
            token_id=AccessTokenId(1),
            attributes=UserTokenAttributes(user_role=role),
        )
        mock_info = MagicMock()
        mock_info.context.auth_enabled = auth_enabled
        mock_info.context.user = PhoenixUser(user_id, claims)
        return mock_info

    def test_admin_allowed_when_auth_enabled(self) -> None:
        from phoenix.server.api.auth import IsAdminIfAuthEnabled

        perm = IsAdminIfAuthEnabled()
        info = self._make_info(auth_enabled=True, is_admin=True)
        assert perm.has_permission(source=None, info=info) is True  # type: ignore[arg-type]

    def test_non_admin_denied_when_auth_enabled(self) -> None:
        from phoenix.server.api.auth import IsAdminIfAuthEnabled

        perm = IsAdminIfAuthEnabled()
        info = self._make_info(auth_enabled=True, is_admin=False)
        assert perm.has_permission(source=None, info=info) is False  # type: ignore[arg-type]

    def test_allowed_when_auth_disabled_regardless_of_role(self) -> None:
        from phoenix.server.api.auth import IsAdminIfAuthEnabled

        perm = IsAdminIfAuthEnabled()
        info = self._make_info(auth_enabled=False, is_admin=False)
        assert perm.has_permission(source=None, info=info) is True  # type: ignore[arg-type]

    def test_create_sandbox_config_has_admin_gate(self) -> None:
        """createSandboxConfig must include IsAdminIfAuthEnabled in its permission_classes."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.mutations.sandbox_config_mutations import SandboxConfigMutationMixin

        defn = SandboxConfigMutationMixin.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "create_sandbox_config")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"createSandboxConfig is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    def test_update_sandbox_config_has_admin_gate(self) -> None:
        """updateSandboxConfig must include IsAdminIfAuthEnabled in its permission_classes."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.mutations.sandbox_config_mutations import SandboxConfigMutationMixin

        defn = SandboxConfigMutationMixin.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "update_sandbox_config")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"updateSandboxConfig is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    # ------------------------------------------------------------------
    # Read-side admin gates (Vuln 1: secret exfil via GraphQL config read)
    # ------------------------------------------------------------------

    def test_sandbox_config_config_field_has_admin_gate(self) -> None:
        """SandboxConfig.config field exposes admin-authored env_vars / secret_refs;
        must be gated so non-admin readers cannot exfil decrypted env-var literals.
        """
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.types.SandboxConfig import SandboxConfig

        defn = SandboxConfig.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "config")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"SandboxConfig.config is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    def test_sandbox_provider_config_field_has_admin_gate(self) -> None:
        """SandboxProvider.config field exposes admin-authored provider credentials;
        must be gated so non-admin readers cannot read provider config plaintext.
        """
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.types.SandboxConfig import SandboxProvider

        defn = SandboxProvider.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "config")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"SandboxProvider.config is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    def test_query_sandbox_backends_has_admin_gate(self) -> None:
        """Query.sandboxBackends returns admin-managed backend info; must be admin-gated."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.queries import Query

        defn = Query.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "sandbox_backends")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"Query.sandboxBackends is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    def test_query_sandbox_providers_has_admin_gate(self) -> None:
        """Query.sandboxProviders is the primary enumerator non-admins use to discover
        admin-authored sandbox_config_id values; must be admin-gated so the enumerate-
        then-pivot attack on the preview path has no input."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.queries import Query

        defn = Query.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "sandbox_providers")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"Query.sandboxProviders is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    # ------------------------------------------------------------------
    # Persisted code-evaluator admin gates (Vuln 2: persisted-then-preview path)
    # ------------------------------------------------------------------

    def test_create_code_evaluator_has_admin_gate(self) -> None:
        """createCodeEvaluator can bind a CodeEvaluator to an admin-authored
        sandbox_config_id; must be admin-gated so non-admins cannot seed an
        admin-sandbox-backed evaluator they later preview / run."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.mutations.evaluator_mutations import EvaluatorMutationMixin

        defn = EvaluatorMutationMixin.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "create_code_evaluator")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"createCodeEvaluator is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    def test_patch_code_evaluator_has_admin_gate(self) -> None:
        """patchCodeEvaluator can rebind an existing CodeEvaluator to a different
        sandbox_config_id; must be admin-gated so non-admins cannot redirect a
        code evaluator at an admin-authored sandbox config."""
        from phoenix.server.api.auth import IsAdminIfAuthEnabled
        from phoenix.server.api.mutations.evaluator_mutations import EvaluatorMutationMixin

        defn = EvaluatorMutationMixin.__strawberry_definition__  # type: ignore[attr-defined]
        field = next(f for f in defn.fields if f.name == "patch_code_evaluator")
        assert IsAdminIfAuthEnabled in field.permission_classes, (
            f"patchCodeEvaluator is missing IsAdminIfAuthEnabled in permission_classes; "
            f"found: {field.permission_classes}"
        )

    # ------------------------------------------------------------------
    # Branch-level admin gate inside evaluator_previews (Vuln 2 primary)
    # ------------------------------------------------------------------

    def test_require_admin_if_auth_enabled_raises_for_non_admin(self) -> None:
        """The branch-local gate inside evaluator_previews must raise Unauthorized
        for non-admin callers when auth is enabled — this is the gate that closes
        the exfil-via-preview path before _resolve_user_env runs."""
        from phoenix.server.api.auth import MSG_ADMIN_ONLY
        from phoenix.server.api.exceptions import Unauthorized
        from phoenix.server.api.mutations.chat_mutations import (
            _require_admin_if_auth_enabled,
        )

        info = self._make_info(auth_enabled=True, is_admin=False)
        try:
            _require_admin_if_auth_enabled(info)  # type: ignore[arg-type]
        except Unauthorized as exc:
            assert str(exc) == MSG_ADMIN_ONLY
        else:
            raise AssertionError(
                "_require_admin_if_auth_enabled must raise Unauthorized for non-admin "
                "when auth is enabled; this is the gate that prevents secret exfil via "
                "evaluator_previews."
            )

    def test_require_admin_if_auth_enabled_passes_for_admin(self) -> None:
        """The branch-local gate must allow admin callers when auth is enabled."""
        from phoenix.server.api.mutations.chat_mutations import (
            _require_admin_if_auth_enabled,
        )

        info = self._make_info(auth_enabled=True, is_admin=True)
        _require_admin_if_auth_enabled(info)  # type: ignore[arg-type]

    def test_require_admin_if_auth_enabled_passes_when_auth_disabled(self) -> None:
        """The branch-local gate must NOT block when auth is disabled — preserves
        the existing single-user / local-dev behaviour where evaluator_previews
        runs for any caller (matches the rest of the IsAdminIfAuthEnabled surface)."""
        from phoenix.server.api.mutations.chat_mutations import (
            _require_admin_if_auth_enabled,
        )

        info = self._make_info(auth_enabled=False, is_admin=False)
        _require_admin_if_auth_enabled(info)  # type: ignore[arg-type]

    # ------------------------------------------------------------------
    # Vuln 2 exploit-chain regression: gate fires before sandbox resolution
    # ------------------------------------------------------------------

    async def test_evaluator_previews_inline_branch_rejects_non_admin_before_resolving_sandbox(
        self,
    ) -> None:
        """End-to-end regression for the Vuln 2 exploit chain.

        Constructs the exact exploit payload from the security-review notes —
        a non-admin caller, an inline_code_evaluator referencing an admin-authored
        sandbox_config_id, and source code that returns os.environ via the
        explanation field — and asserts the runtime composition (gate ->
        resolver -> secret lookup -> harness -> response) is short-circuited
        at the gate. Verified by:

        1) Unauthorized is raised before any sandbox resolution.
        2) `_resolve_inline_code_evaluator_backend` is never reached.
        3) The error message matches the standard admin-only contract so the
           UI / clients can handle it identically to the rest of the surface.
        """
        from unittest.mock import AsyncMock, MagicMock, patch

        from phoenix.server.api.auth import MSG_ADMIN_ONLY
        from phoenix.server.api.exceptions import Unauthorized
        from phoenix.server.api.input_types.EvaluatorPreviewInput import (
            EvaluatorPreviewsInput,
        )
        from phoenix.server.api.mutations.chat_mutations import (
            ChatCompletionMutationMixin,
        )

        info = self._make_info(auth_enabled=True, is_admin=False)

        # Build the exploit payload shape: inline_code_evaluator referencing an
        # admin-authored sandbox_config_id with source code that would exfil
        # os.environ via the explanation field. We don't need a real DB row
        # because the gate must fire before any DB / sandbox access.
        inline_input = MagicMock()
        inline_input.language.value = "PYTHON"
        inline_input.name = "exfil-attempt"
        inline_input.description = None
        inline_input.source_code = (
            "import os, json\n"
            "def evaluate(**kw):\n"
            "    return {'explanation': json.dumps(dict(os.environ))}\n"
        )
        inline_input.output_configs = []
        inline_input.sandbox_config_id = str(GlobalID("SandboxConfig", "1"))

        evaluator_input = MagicMock()
        evaluator_input.built_in_evaluator_id = None
        evaluator_input.inline_llm_evaluator = None
        evaluator_input.code_evaluator_id = None
        evaluator_input.inline_code_evaluator = inline_input

        preview_item = MagicMock()
        preview_item.evaluator = evaluator_input
        preview_item.context = {}
        preview_item.input_mapping = MagicMock()
        preview_item.input_mapping.to_orm = MagicMock(return_value=MagicMock())

        input_payload = MagicMock(spec=EvaluatorPreviewsInput)
        input_payload.previews = [preview_item]
        input_payload.credentials = []

        # Sentinel: if the gate fails, the resolver would be reached. Patch
        # `_resolve_inline_code_evaluator_backend` and assert it is never
        # called — proving the gate runs upstream of any secret access.
        resolver_path = (
            "phoenix.server.api.mutations.chat_mutations._resolve_inline_code_evaluator_backend"
        )
        with patch(resolver_path, new=AsyncMock()) as resolver_spy:
            try:
                await ChatCompletionMutationMixin.evaluator_previews(
                    info=info,
                    input=input_payload,
                )
            except Unauthorized as exc:
                # Standard admin-only contract — matches the message produced by
                # IsAdminIfAuthEnabled.on_unauthorized so UI / clients can
                # handle it the same way as gated mutation fields.
                assert str(exc) == MSG_ADMIN_ONLY
            else:
                raise AssertionError(
                    "Non-admin invocation of evaluator_previews with an "
                    "inline_code_evaluator must raise Unauthorized — the "
                    "Vuln 2 exfil chain is otherwise reachable."
                )
            assert resolver_spy.await_count == 0, (
                "_resolve_inline_code_evaluator_backend must not run for a "
                "non-admin caller — the branch-local gate must short-circuit "
                "before any sandbox / secret access."
            )

    async def test_evaluator_previews_code_evaluator_branch_rejects_non_admin_before_db(
        self,
    ) -> None:
        """Companion regression for the persisted code_evaluator branch.

        Same shape as the inline test, but using a persisted code_evaluator_id
        instead of an inline evaluator. Asserts the gate fires before the
        branch's `info.context.db()` lookup runs.
        """
        from unittest.mock import MagicMock, patch

        from phoenix.server.api.auth import MSG_ADMIN_ONLY
        from phoenix.server.api.exceptions import Unauthorized
        from phoenix.server.api.input_types.EvaluatorPreviewInput import (
            EvaluatorPreviewsInput,
        )
        from phoenix.server.api.mutations.chat_mutations import (
            ChatCompletionMutationMixin,
        )

        info = self._make_info(auth_enabled=True, is_admin=False)

        evaluator_input = MagicMock()
        evaluator_input.built_in_evaluator_id = None
        evaluator_input.inline_llm_evaluator = None
        evaluator_input.inline_code_evaluator = None
        evaluator_input.code_evaluator_id = str(GlobalID("CodeEvaluator", "1"))

        preview_item = MagicMock()
        preview_item.evaluator = evaluator_input
        preview_item.context = {}
        preview_item.input_mapping = MagicMock()
        preview_item.input_mapping.to_orm = MagicMock(return_value=MagicMock())

        input_payload = MagicMock(spec=EvaluatorPreviewsInput)
        input_payload.previews = [preview_item]
        input_payload.credentials = []

        # If the gate fails, the branch dispatches to the data loader.
        # Patch the data loader entry so we can assert it is never called.
        loader = info.context.data_loaders.latest_code_evaluator_versions  # type: ignore[attr-defined]
        loader.load = MagicMock()

        with patch.object(loader, "load") as load_spy:
            try:
                await ChatCompletionMutationMixin.evaluator_previews(
                    info=info,
                    input=input_payload,
                )
            except Unauthorized as exc:
                assert str(exc) == MSG_ADMIN_ONLY
            else:
                raise AssertionError(
                    "Non-admin invocation of evaluator_previews with a "
                    "persisted code_evaluator_id must raise Unauthorized."
                )
            assert load_spy.call_count == 0, (
                "latest_code_evaluator_versions.load must not run for a "
                "non-admin caller — the branch-local gate must short-circuit "
                "before any DB access in the persisted code-evaluator branch."
            )
