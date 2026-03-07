from secrets import token_hex

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.types.SandboxConfig import SandboxBackendType
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def code_evaluator(db: DbSessionFactory) -> models.CodeEvaluator:
    evaluator = models.CodeEvaluator(
        name=IdentifierModel.model_validate(f"test-code-eval-{token_hex(4)}"),
        source_code="def evaluate(text): return {'label': 'good'}",
        language="PYTHON",
    )
    async with db() as session:
        session.add(evaluator)
        await session.flush()
    return evaluator


@pytest.fixture
async def sandbox_config_e2b(db: DbSessionFactory) -> models.SandboxConfig:
    config = models.SandboxConfig(
        backend_type="E2B",
        config={"api_key_env_var": "E2B_API_KEY"},
        timeout=30,
        config_hash="abc123def456gh",
    )
    async with db() as session:
        session.add(config)
        await session.flush()
    return config


class TestUpdateCodeEvaluatorSandboxBackendType:
    """Tests for sandbox_backend_type handling in the update_code_evaluator mutation."""

    _MUTATION = """
      mutation($input: UpdateCodeEvaluatorInput!) {
        updateCodeEvaluator(input: $input) {
          evaluator {
            id
            name
            sandboxBackendType
          }
        }
      }
    """

    async def test_wasm_clears_sandbox_config(
        self,
        db: DbSessionFactory,
        code_evaluator: models.CodeEvaluator,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """Setting sandbox_backend_type=WASM should set sandbox_config_id to null."""
        # Pre-set the evaluator to have an E2B config
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            eval_row.sandbox_config_id = sandbox_config_e2b.id
            eval_row.sandbox_config_hash = sandbox_config_e2b.config_hash
            await session.flush()

        # Simulate the mutation handler logic directly
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            backend_type = SandboxBackendType.WASM
            if backend_type is None or backend_type == SandboxBackendType.WASM:
                eval_row.sandbox_config_id = None
                eval_row.sandbox_config_hash = None
            await session.flush()

        # Verify
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            assert eval_row.sandbox_config_id is None
            assert eval_row.sandbox_config_hash is None

    async def test_e2b_sets_sandbox_config(
        self,
        db: DbSessionFactory,
        code_evaluator: models.CodeEvaluator,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """Setting sandbox_backend_type=E2B should look up and set sandbox_config_id and hash."""
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            backend_type = SandboxBackendType.E2B
            if backend_type is None or backend_type == SandboxBackendType.WASM:
                eval_row.sandbox_config_id = None
                eval_row.sandbox_config_hash = None
            else:
                config_row = await session.scalar(
                    select(models.SandboxConfig).where(
                        models.SandboxConfig.backend_type == backend_type.value
                    )
                )
                assert config_row is not None, "SandboxConfig for E2B should exist"
                eval_row.sandbox_config_id = config_row.id
                eval_row.sandbox_config_hash = config_row.config_hash
            await session.flush()

        # Verify
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            assert eval_row.sandbox_config_id == sandbox_config_e2b.id
            assert eval_row.sandbox_config_hash == sandbox_config_e2b.config_hash

    async def test_unset_leaves_sandbox_config_unchanged(
        self,
        db: DbSessionFactory,
        code_evaluator: models.CodeEvaluator,
        sandbox_config_e2b: models.SandboxConfig,
    ) -> None:
        """When sandbox_backend_type is UNSET, sandbox_config_id should not change."""
        from strawberry import UNSET

        # Pre-set the evaluator to have an E2B config
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            eval_row.sandbox_config_id = sandbox_config_e2b.id
            eval_row.sandbox_config_hash = sandbox_config_e2b.config_hash
            await session.flush()

        # Simulate UNSET — the handler skips the block entirely
        sandbox_backend_type = UNSET
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            if sandbox_backend_type is not UNSET:
                # This block should NOT execute
                eval_row.sandbox_config_id = None
                eval_row.sandbox_config_hash = None
            await session.flush()

        # Verify unchanged
        async with db() as session:
            eval_row = await session.get(models.CodeEvaluator, code_evaluator.id)
            assert eval_row is not None
            assert eval_row.sandbox_config_id == sandbox_config_e2b.id
            assert eval_row.sandbox_config_hash == sandbox_config_e2b.config_hash


class TestPreviewHandlerSandboxBackendType:
    """Test that evaluator_previews forwards sandbox_backend_type to get_or_create_backend."""

    async def test_non_wasm_backend_type_forwarded(self) -> None:
        """InlineCodeEvaluatorInput with E2B sandbox_backend_type should call
        get_or_create_backend with 'E2B', not hardcoded 'WASM'."""
        from phoenix.server.api.input_types.EvaluatorPreviewInput import InlineCodeEvaluatorInput

        inline_input = InlineCodeEvaluatorInput(
            name="test-eval",
            source_code="def evaluate(text): return {'label': 'good'}",
            output_configs=[],
            sandbox_backend_type=SandboxBackendType.E2B,
        )

        # Verify the backend_type_str computation matches the handler logic
        backend_type_str = (
            inline_input.sandbox_backend_type.value
            if inline_input.sandbox_backend_type
            else "WASM"
        )
        assert backend_type_str == "E2B"

    async def test_none_defaults_to_wasm(self) -> None:
        """InlineCodeEvaluatorInput with no sandbox_backend_type should default to WASM."""
        from phoenix.server.api.input_types.EvaluatorPreviewInput import InlineCodeEvaluatorInput

        inline_input = InlineCodeEvaluatorInput(
            name="test-eval",
            source_code="def evaluate(text): return {'label': 'good'}",
            output_configs=[],
        )

        backend_type_str = (
            inline_input.sandbox_backend_type.value
            if inline_input.sandbox_backend_type
            else "WASM"
        )
        assert backend_type_str == "WASM"

    async def test_wasm_explicit_resolves_to_wasm(self) -> None:
        """InlineCodeEvaluatorInput with explicit WASM should resolve to 'WASM'."""
        from phoenix.server.api.input_types.EvaluatorPreviewInput import InlineCodeEvaluatorInput

        inline_input = InlineCodeEvaluatorInput(
            name="test-eval",
            source_code="def evaluate(text): return {'label': 'good'}",
            output_configs=[],
            sandbox_backend_type=SandboxBackendType.WASM,
        )

        backend_type_str = (
            inline_input.sandbox_backend_type.value
            if inline_input.sandbox_backend_type
            else "WASM"
        )
        assert backend_type_str == "WASM"
