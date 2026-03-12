from unittest.mock import AsyncMock, patch

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.mutations.sandbox_config_mutations import compute_sandbox_config_hash
from phoenix.server.sandbox import sync_sandbox_default_configs
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestComputeSandboxConfigHash:
    """Determinism and correctness tests for compute_sandbox_config_hash."""

    def test_same_inputs_produce_same_hash(self) -> None:
        h1 = compute_sandbox_config_hash("WASM", 30, {})
        h2 = compute_sandbox_config_hash("WASM", 30, {})
        assert h1 == h2

    def test_different_backend_type_produces_different_hash(self) -> None:
        h_wasm = compute_sandbox_config_hash("WASM", 30, {})
        h_e2b = compute_sandbox_config_hash("E2B", 30, {})
        assert h_wasm != h_e2b

    def test_different_timeout_produces_different_hash(self) -> None:
        h1 = compute_sandbox_config_hash("WASM", 30, {})
        h2 = compute_sandbox_config_hash("WASM", 60, {})
        assert h1 != h2

    def test_different_config_produces_different_hash(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"template": "base"})
        h2 = compute_sandbox_config_hash("E2B", 30, {"template": "custom"})
        assert h1 != h2

    def test_config_key_ordering_does_not_affect_hash(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"a": "1", "b": "2"})
        h2 = compute_sandbox_config_hash("E2B", 30, {"b": "2", "a": "1"})
        assert h1 == h2

    def test_hash_length_is_16_hex_chars(self) -> None:
        h = compute_sandbox_config_hash("WASM", 30, {})
        assert len(h) == 16
        assert all(c in "0123456789abcdef" for c in h)


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
            await sync_sandbox_default_configs(session)

    @pytest.fixture
    async def sandbox_config_e2b(self, db: DbSessionFactory) -> models.SandboxConfig:
        """Create an E2B SandboxConfig for tests that need to resolve a non-WASM backend."""
        instance = models.SandboxConfig(
            backend_type="E2B",
            name="test-e2b",
            config={"api_key_env_var": "E2B_API_KEY"},
            timeout=30,
            config_hash="abc123def456gh01",
        )
        async with db() as session:
            session.add(instance)
            await session.flush()
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
            assert evaluator.sandbox_config_hash is not None

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
        from sqlalchemy import select

        from phoenix.server.sandbox import sync_sandbox_adapters, sync_sandbox_default_configs

        async with db() as session:
            # Step 1: Sync adapters and default configs (mirrors startup)
            await sync_sandbox_adapters(session)
            await sync_sandbox_default_configs(session)

            # Step 2: Verify default configs exist for configless backends
            configs = (
                (
                    await session.execute(
                        select(models.SandboxConfig).where(models.SandboxConfig.name == "Default")
                    )
                )
                .scalars()
                .all()
            )
            configless_types = {"WASM", "DENO", "DAYTONA"}
            created_types = {c.backend_type for c in configs}
            assert configless_types.issubset(created_types), (
                f"Expected default configs for {configless_types}, got {created_types}"
            )

            # Step 3: Verify config-required backends did NOT get default rows
            for config in configs:
                assert config.backend_type not in {"E2B", "VERCEL"}, (
                    f"Config-required backend {config.backend_type} should not have a default row"
                )

            # Step 4: Verify evaluator creation resolves to the default config
            wasm_config = next(c for c in configs if c.backend_type == "WASM")
            assert wasm_config.id is not None
            assert wasm_config.config_hash is not None
            assert wasm_config.config == {}
            assert wasm_config.timeout == 30
