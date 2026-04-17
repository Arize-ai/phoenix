"""Tests for sandbox GQL mutations: createSandboxConfig, updateSandboxConfig,
updateSandboxProvider, deleteSandboxConfig.

Uses the gql_client fixture to send real GQL mutations against the in-memory
test app, backed by seed_sandbox_providers DB fixtures.
"""

from __future__ import annotations

from unittest.mock import patch

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
mutation DeleteSandboxConfig($id: ID!) {
    deleteSandboxConfig(id: $id) {
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
            config
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

        result = await gql_client.execute(_DELETE, variables={"id": config_gid})
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
        result = await gql_client.execute(_DELETE, variables={"id": _config_global_id(99999)})
        assert result.errors


class TestUpdateSandboxProvider:
    async def test_updates_provider_config_and_enabled(
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
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.id),
                    "enabled": False,
                    "config": {"template": "custom-template"},
                }
            },
        )
        assert result.data and not result.errors
        sandbox_provider = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sandbox_provider["enabled"] is False
        assert sandbox_provider["config"] == {"template": "custom-template"}

    async def test_update_provider_only_enabled_leaves_config_unchanged(
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
        original_config = provider.config

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
        sp = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sp["enabled"] is False
        assert sp["config"] == original_config

    async def test_update_provider_only_config_leaves_enabled_unchanged(
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
                    "config": {"new_key": "new_value"},
                }
            },
        )
        assert result.data and not result.errors
        sp = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sp["config"] == {"new_key": "new_value"}
        assert sp["enabled"] is original_enabled

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
        original_config = provider.config
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
        assert sp["config"] == original_config
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
                sandboxConfig {
                    id
                }
            }
        }
    }
}
"""

_UPDATE_CODE_EVALUATOR = """
mutation UpdateCodeEvaluator($input: UpdateCodeEvaluatorInput!) {
    updateCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                sandboxConfig {
                    id
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
    """Insert a CodeEvaluator row linked to the given sandbox config."""
    async with db() as session:
        code_eval = models.CodeEvaluator(
            name=Identifier(root="test-disabled-guard-eval"),
            description=None,
            metadata_={},
            source_code="def evaluate(input): return {'score': 1.0}",
            sandbox_config_id=sandbox_config.id,
        )
        session.add(code_eval)
        await session.flush()
        return code_eval.id


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
                            "inputMapping": {},
                        }
                    ]
                }
            },
        )
        assert result.errors


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
        assert evaluator["sandboxConfig"]["id"] == _config_global_id(sandbox_config.id)

        evaluator_id = GlobalID.from_id(evaluator["id"])
        async with db() as session:
            row = await session.get(models.CodeEvaluator, int(evaluator_id.node_id))
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_update_code_evaluator_accepts_sandbox_global_id(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            code_eval = models.CodeEvaluator(
                name=Identifier(root="test_update_code_evaluator"),
                description=None,
                metadata_={},
                source_code="def evaluate(output): return {'score': 0.0}",
            )
            session.add(code_eval)
            await session.flush()
            evaluator_gid = str(GlobalID("CodeEvaluator", str(code_eval.id)))

        result = await gql_client.execute(
            _UPDATE_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sandboxConfigId": _config_global_id(sandbox_config.id),
                }
            },
        )
        assert result.data and not result.errors
        evaluator = result.data["updateCodeEvaluator"]["evaluator"]
        assert evaluator["sandboxConfig"]["id"] == _config_global_id(sandbox_config.id)

        async with db() as session:
            row = await session.get(models.CodeEvaluator, code_eval.id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

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
                            "inputMapping": {},
                        }
                    ]
                }
            },
        )
        assert result.errors


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
                        "config": {"template": "custom-tmpl", "cwd": "/workspace"},
                    }
                },
            )
        assert result.data and not result.errors

    async def test_create_preserves_unknown_keys(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """extra="allow" means unknown keys survive validation and are persisted."""
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
                        "config": {"template": "base", "custom_key": "preserved"},
                    }
                },
            )
        assert result.data and not result.errors
        cfg_id = result.data["createSandboxConfig"]["sandboxConfig"]["id"]

        # Verify persisted config includes the unknown key
        async with db() as session:
            from strawberry.relay import GlobalID as GID

            gid = GID.from_id(cfg_id)
            row_id = int(gid.node_id)
            row = await session.get(models.SandboxConfig, row_id)
        assert row is not None
        assert row.config.get("custom_key") == "preserved"

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
                        "config": {"template": "new-template", "metadata": "my-label"},
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
                name="e2b-persist-test",
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
                        "config": {"template": "saved-tmpl"},
                    }
                },
            )
        assert result.data and not result.errors

        async with db() as session:
            row = await session.get(models.SandboxConfig, config_id)
        assert row is not None
        # template was provided — must be persisted
        assert row.config.get("template") == "saved-tmpl"

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
                            "template": "base",
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
                                    "name": "PHOENIX_SANDBOX_E2B_API_KEY",
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
        """Non-PHOENIX_SANDBOX reserved names (adapter-owned credentials like
        VERCEL_TOKEN) must also be rejected at createSandboxConfig time —
        reserved-name coverage is derived from every adapter's credential_specs,
        not just the PHOENIX_SANDBOX_ prefix."""
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
        """PHOENIX_SANDBOX_* names are also rejected on update."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        async with db() as session:
            config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
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
                                    "name": "PHOENIX_SANDBOX_TOKEN",
                                    "secret_key": "my-secret",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors


# ---------------------------------------------------------------------------
# Admin gate (D10): IsAdminIfAuthEnabled on createSandboxConfig / updateSandboxConfig
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
