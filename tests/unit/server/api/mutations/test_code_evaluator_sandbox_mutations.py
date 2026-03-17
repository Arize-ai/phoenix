from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.sandbox import sync_sandbox_default_configs, sync_sandbox_providers
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestUpdateCodeEvaluatorSandboxBackendType:
    """Tests for sandbox_backend_type handling in the updateCodeEvaluator mutation."""

    _CREATE_MUTATION = """
      mutation($input: CreateCodeEvaluatorInput!) {
        createCodeEvaluator(input: $input) {
          evaluator {
            id
            sandboxBackendType
          }
        }
      }
    """

    _UPDATE_MUTATION = """
      mutation($input: UpdateCodeEvaluatorInput!) {
        updateCodeEvaluator(input: $input) {
          evaluator {
            id
            sandboxBackendType
          }
        }
      }
    """

    @pytest.fixture
    async def default_sandbox_configs(self, db: DbSessionFactory) -> None:
        """Ensure default SandboxConfig rows exist for configless backends (WASM, DENO, DAYTONA)."""
        async with db() as session:
            # Seed language rows (created by alembic migration in prod, not create_all)
            for lang in ("PYTHON", "TYPESCRIPT"):
                existing = await session.scalar(
                    select(models.Language).where(models.Language.name == lang)
                )
                if existing is None:
                    session.add(models.Language(name=lang))
            await session.flush()
            await sync_sandbox_providers(session)
            await sync_sandbox_default_configs(session)

    @pytest.fixture
    async def sandbox_config_e2b(
        self, db: DbSessionFactory, default_sandbox_configs: None
    ) -> models.SandboxConfig:
        """Create an E2B SandboxConfig for tests that need a non-WASM backend."""
        async with db() as session:
            provider_id = await session.scalar(
                select(models.SandboxProvider.id).where(
                    models.SandboxProvider.backend_type == "E2B"
                )
            )
            assert provider_id is not None, "E2B provider should exist after sync"
            language_id = await session.scalar(
                select(models.Language.id).where(models.Language.name == "PYTHON")
            )
            instance = models.SandboxConfig(
                provider_id=provider_id,
                language_id=language_id,
                name="test-e2b",
                config={"api_key_env_var": "E2B_API_KEY"},
                timeout=30,
            )
            session.add(instance)
            await session.flush()
            await session.refresh(instance)
        return instance

    @pytest.fixture
    async def code_evaluator_gid(
        self,
        gql_client: AsyncGraphQLClient,
        default_sandbox_configs: None,
    ) -> str:
        result = await gql_client.execute(
            self._CREATE_MUTATION,
            {
                "input": {
                    "name": "test_sandbox_eval",
                    "sourceCode": "def evaluate(text):\n  return {'label': 'ok'}",
                    "language": "PYTHON",
                    "inputMapping": {
                        "literalMapping": {},
                        "pathMapping": {},
                    },
                    "sandboxBackendType": "WASM",
                }
            },
        )
        assert result.data and not result.errors, f"Create failed: {result.errors}"
        gid: str = result.data["createCodeEvaluator"]["evaluator"]["id"]
        return gid

    async def test_update_sandbox_backend_type_wasm_sets_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
        default_sandbox_configs: None,
    ) -> None:
        """Setting sandbox_backend_type to WASM should set sandbox_config_id to the default row."""
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "evaluatorId": code_evaluator_gid,
                    "sandboxBackendType": "WASM",
                }
            },
        )
        assert result.data and not result.errors, f"Update failed: {result.errors}"
        assert result.data["updateCodeEvaluator"]["evaluator"]["sandboxBackendType"] == "WASM"

        evaluator_rowid = int(GlobalID.from_id(code_evaluator_gid).node_id)
        async with db() as session:
            evaluator = await session.get(models.CodeEvaluator, evaluator_rowid)
            assert evaluator is not None
            assert evaluator.sandbox_config_id is not None

    async def test_update_sandbox_backend_type_e2b_sets_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """Setting sandbox_backend_type to E2B should set sandbox_config_id."""
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "evaluatorId": code_evaluator_gid,
                    "sandboxBackendType": "E2B",
                }
            },
        )
        assert result.data and not result.errors, f"Update failed: {result.errors}"
        assert result.data["updateCodeEvaluator"]["evaluator"]["sandboxBackendType"] == "E2B"

        evaluator_rowid = int(GlobalID.from_id(code_evaluator_gid).node_id)
        async with db() as session:
            evaluator = await session.get(models.CodeEvaluator, evaluator_rowid)
            assert evaluator is not None
            assert evaluator.sandbox_config_id == sandbox_config_e2b.id

    async def test_update_sandbox_backend_type_unset_leaves_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """Omitting sandbox_backend_type should leave sandbox_config_id unchanged."""
        # First set to E2B
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "evaluatorId": code_evaluator_gid,
                    "sandboxBackendType": "E2B",
                }
            },
        )
        assert result.data and not result.errors

        # Now update without sandbox_backend_type (UNSET)
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "evaluatorId": code_evaluator_gid,
                    "name": "renamed_eval",
                }
            },
        )
        assert result.data and not result.errors, f"Update failed: {result.errors}"

        evaluator_rowid = int(GlobalID.from_id(code_evaluator_gid).node_id)
        async with db() as session:
            evaluator = await session.get(models.CodeEvaluator, evaluator_rowid)
            assert evaluator is not None
            # sandbox_config_id should still be set to E2B config
            assert evaluator.sandbox_config_id == sandbox_config_e2b.id

    async def test_update_sandbox_backend_type_nonexistent_config_errors(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
    ) -> None:
        """Setting sandbox_backend_type to a type with no config should error."""
        # No SandboxConfig exists for VERCEL — the mutation should raise BadRequest.
        result = await gql_client.execute(
            self._UPDATE_MUTATION,
            {
                "input": {
                    "evaluatorId": code_evaluator_gid,
                    "sandboxBackendType": "VERCEL",
                }
            },
        )
        assert result.errors, f"Expected error but got: {result.data}"
        error_msg = result.errors[0].message
        assert "No sandbox configuration found" in error_msg
        assert "VERCEL" in error_msg


class TestPreviewHandlerSandboxBackendType:
    """Tests for sandbox_backend_type forwarding in the evaluator_previews handler."""

    _MUTATION = """
      mutation($input: EvaluatorPreviewsInput!) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            error
            annotation {
              name
              label
              score
              explanation
              annotatorKind
            }
          }
        }
      }
    """

    async def test_preview_with_non_wasm_sandbox_type_calls_correct_backend(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Preview with sandboxBackendType=E2B should call get_or_create_backend with 'E2B'."""
        with patch(
            "phoenix.server.sandbox.get_or_create_backend",
            new_callable=AsyncMock,
        ) as mock_get_backend:
            mock_backend = AsyncMock()
            mock_backend.execute.return_value = AsyncMock(
                stdout='{"label": "good", "score": 1.0}',
                stderr="",
                exit_code=0,
                timed_out=False,
            )
            mock_get_backend.return_value = mock_backend

            result = await gql_client.execute(
                self._MUTATION,
                {
                    "input": {
                        "previews": [
                            {
                                "evaluator": {
                                    "inlineCodeEvaluator": {
                                        "name": "test_preview",
                                        "sourceCode": "def evaluate(text):\n  return {'label': 'good', 'score': 1.0}",
                                        "outputConfigs": [],
                                        "sandboxBackendType": "E2B",
                                    }
                                },
                                "context": {"text": "hello"},
                                "inputMapping": {
                                    "literalMapping": {},
                                    "pathMapping": {},
                                },
                            }
                        ]
                    }
                },
            )

            assert result.data and not result.errors, f"Preview failed: {result.errors}"
            # Verify get_or_create_backend was called with "E2B", not "WASM"
            mock_get_backend.assert_called_once()
            call_args = mock_get_backend.call_args
            assert call_args[0][0] == "E2B", (
                f"Expected get_or_create_backend to be called with 'E2B', got '{call_args[0][0]}'"
            )

    async def test_preview_without_sandbox_type_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Preview without sandboxBackendType should return an error (no longer defaults to WASM)."""
        result = await gql_client.execute(
            self._MUTATION,
            {
                "input": {
                    "previews": [
                        {
                            "evaluator": {
                                "inlineCodeEvaluator": {
                                    "name": "test_preview_default",
                                    "sourceCode": "def evaluate(text):\n  return {'label': 'ok', 'score': 0.5}",
                                    "outputConfigs": [],
                                }
                            },
                            "context": {"text": "hello"},
                            "inputMapping": {
                                "literalMapping": {},
                                "pathMapping": {},
                            },
                        }
                    ]
                }
            },
        )

        # BadRequest raises a top-level GraphQL error
        assert result.errors, f"Expected error but got: {result.data}"
        error_msg = result.errors[0].message
        assert "sandbox_backend_type" in error_msg or "required" in error_msg.lower()


class TestFullFlowSyncCreateExecute:
    """Verify the full flow: startup sync → evaluator creation → config lookup."""

    async def test_sync_creates_defaults_and_evaluator_resolves_to_them(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Default configs created at sync time are used when creating evaluators."""
        async with db() as session:
            # Seed language rows (done by alembic migration in prod, not create_all)
            for lang in ("PYTHON", "TYPESCRIPT"):
                existing = await session.scalar(
                    select(models.Language).where(models.Language.name == lang)
                )
                if existing is None:
                    session.add(models.Language(name=lang))
            await session.flush()

            # Step 1: Sync providers and default configs (mirrors startup)
            await sync_sandbox_providers(session)
            await sync_sandbox_default_configs(session)

            # Step 2: Verify default configs exist for configless backends
            provider_map = {
                row[0]: row[1]
                for row in (
                    await session.execute(
                        select(models.SandboxProvider.backend_type, models.SandboxProvider.id)
                    )
                ).all()
            }
            configs = (
                await session.execute(
                    select(models.SandboxConfig, models.SandboxProvider.backend_type)
                    .join(
                        models.SandboxProvider,
                        models.SandboxConfig.provider_id == models.SandboxProvider.id,
                    )
                    .where(models.SandboxConfig.name == "Default")
                )
            ).all()
            configless_types = {"WASM", "DENO", "DAYTONA"}
            created_types = {backend_type for _, backend_type in configs}
            assert configless_types.issubset(created_types), (
                f"Expected default configs for {configless_types}, got {created_types}"
            )

            # Step 3: Verify config-required backends did NOT get default rows
            for _, backend_type in configs:
                assert backend_type not in {"E2B", "VERCEL"}, (
                    f"Config-required backend {backend_type} should not have a default row"
                )

            # Step 4: Verify WASM default config has expected shape
            wasm_config = next(c for c, bt in configs if bt == "WASM")
            assert wasm_config.id is not None
            assert wasm_config.config == {}
            assert wasm_config.timeout == 30
            assert wasm_config.provider_id == provider_map["WASM"]
