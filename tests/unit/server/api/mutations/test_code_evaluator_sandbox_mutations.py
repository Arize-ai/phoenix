"""Tests for sandbox GQL mutations: createSandboxConfig, updateSandboxConfig,
deleteSandboxConfig, setSandboxProviderEnabled.

Uses the gql_client fixture to send real GQL mutations against the in-memory
test app, backed by seed_sandbox_providers DB fixtures.
"""

from __future__ import annotations

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

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

_SET_PROVIDER_ENABLED = """
mutation SetSandboxProviderEnabled($providerId: Int!, $enabled: Boolean!) {
    setSandboxProviderEnabled(providerId: $providerId, enabled: $enabled) {
        sandboxProvider {
            id
            enabled
        }
    }
}
"""

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _config_global_id(config_id: int) -> str:
    return str(GlobalID("SandboxConfig", str(config_id)))


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
                    "sandboxProviderId": provider.id,
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
                    "sandboxProviderId": 99999,
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
                    "id": sandbox_config.id,
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

    async def test_update_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": 99999, "timeout": 5}},
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


class TestSetSandboxProviderEnabled:
    async def test_disables_provider(
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
            _SET_PROVIDER_ENABLED,
            variables={"providerId": provider.id, "enabled": False},
        )
        assert result.data and not result.errors
        assert result.data["setSandboxProviderEnabled"]["sandboxProvider"]["enabled"] is False

    async def test_enables_provider_after_disable(
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

        # First disable
        result = await gql_client.execute(
            _SET_PROVIDER_ENABLED,
            variables={"providerId": provider.id, "enabled": False},
        )
        assert result.data and not result.errors
        assert result.data["setSandboxProviderEnabled"]["sandboxProvider"]["enabled"] is False

        # Then re-enable
        result = await gql_client.execute(
            _SET_PROVIDER_ENABLED,
            variables={"providerId": provider.id, "enabled": True},
        )
        assert result.data and not result.errors
        assert result.data["setSandboxProviderEnabled"]["sandboxProvider"]["enabled"] is True

    async def test_not_found_provider_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _SET_PROVIDER_ENABLED,
            variables={"providerId": 99999, "enabled": True},
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


class TestDisabledProviderAndConfigGuards:
    async def _create_code_evaluator_with_config(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> int:
        """Insert a CodeEvaluator row (joined-table inheritance) linked to the given sandbox config."""
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

    async def test_disabled_provider_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await self._create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        # Disable the provider via the mutation
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
        assert provider is not None
        result = await gql_client.execute(
            _SET_PROVIDER_ENABLED,
            variables={"providerId": provider.id, "enabled": False},
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

    async def test_disabled_config_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await self._create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        # Disable the sandbox config via the mutation
        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": sandbox_config.id, "enabled": False}},
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
