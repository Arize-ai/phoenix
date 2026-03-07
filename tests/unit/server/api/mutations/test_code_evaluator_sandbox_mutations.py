from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
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
    async def sandbox_config_e2b(self, db: DbSessionFactory) -> models.SandboxConfig:
        """Get the E2B sandbox config seeded by sync_sandbox_adapters at startup."""
        async with db() as session:
            config = await session.scalar(
                select(models.SandboxConfig).where(models.SandboxConfig.backend_type == "E2B")
            )
        assert config is not None, "E2B sandbox config should be seeded at startup"
        return config

    @pytest.fixture
    async def code_evaluator_gid(self, gql_client: AsyncGraphQLClient) -> str:
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
                }
            },
        )
        assert result.data and not result.errors, f"Create failed: {result.errors}"
        gid: str = result.data["createCodeEvaluator"]["evaluator"]["id"]
        return gid

    async def test_update_sandbox_backend_type_wasm_sets_null(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
    ) -> None:
        """Setting sandbox_backend_type to WASM should set sandbox_config_id to null."""
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
            assert evaluator.sandbox_config_id is None
            assert evaluator.sandbox_config_hash is None

    async def test_update_sandbox_backend_type_e2b_sets_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """Setting sandbox_backend_type to E2B should set sandbox_config_id and hash."""
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
            assert evaluator.sandbox_config_hash == sandbox_config_e2b.config_hash

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
            assert evaluator.sandbox_config_hash == sandbox_config_e2b.config_hash

    async def test_update_sandbox_backend_type_nonexistent_config_errors(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        code_evaluator_gid: str,
    ) -> None:
        """Setting sandbox_backend_type to a type with no config should error."""
        # Delete the VERCEL config so we can test the "not found" path
        async with db() as session:
            vercel_config = await session.scalar(
                select(models.SandboxConfig).where(models.SandboxConfig.backend_type == "VERCEL")
            )
            if vercel_config is not None:
                await session.delete(vercel_config)
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

    async def test_preview_without_sandbox_type_defaults_to_wasm(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Preview without sandboxBackendType should default to 'WASM'."""
        with patch(
            "phoenix.server.sandbox.get_or_create_backend",
            new_callable=AsyncMock,
        ) as mock_get_backend:
            mock_backend = AsyncMock()
            mock_backend.execute.return_value = AsyncMock(
                stdout='{"label": "ok", "score": 0.5}',
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

            assert result.data and not result.errors, f"Preview failed: {result.errors}"
            mock_get_backend.assert_called_once()
            call_args = mock_get_backend.call_args
            assert call_args[0][0] == "WASM", (
                f"Expected get_or_create_backend to be called with 'WASM', got '{call_args[0][0]}'"
            )
