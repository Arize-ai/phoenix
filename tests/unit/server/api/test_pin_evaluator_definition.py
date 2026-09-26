import pytest

from phoenix.db import models
from phoenix.db.types.evaluator_definition import (
    InlineCodeEvaluatorDefinition,
    StoredCodeEvaluatorDefinition,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.evaluators import pin_evaluator_definition
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.types import DbSessionFactory


async def _insert_code_evaluator(
    db: DbSessionFactory, *, versions: int, sandbox_config_id: int | None = None
) -> tuple[int, list[int]]:
    async with db() as session:
        code_eval = models.CodeEvaluator(
            name=Identifier("pinned"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[],
            language="PYTHON",
            sandbox_config_id=sandbox_config_id,
        )
        session.add(code_eval)
        await session.flush()
        version_ids: list[int] = []
        for i in range(versions):
            version = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code=f"def evaluate(output): return {i}",
            )
            session.add(version)
            await session.flush()
            version_ids.append(version.id)
        return code_eval.id, version_ids


class TestPinEvaluatorDefinition:
    async def test_pins_a_stored_code_evaluator_to_its_current_version_and_sandbox(
        self, db: DbSessionFactory, sandbox_config: models.SandboxConfig
    ) -> None:
        code_eval_id, version_ids = await _insert_code_evaluator(
            db, versions=2, sandbox_config_id=sandbox_config.id
        )
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator", code_evaluator_id=code_eval_id
        )
        async with db() as session:
            pinned = await pin_evaluator_definition(definition, session=session)
        assert isinstance(pinned, StoredCodeEvaluatorDefinition)
        assert pinned.code_evaluator_id == code_eval_id
        assert pinned.code_evaluator_version_id == version_ids[-1]
        assert pinned.sandbox_config_id == sandbox_config.id
        assert pinned.language == "PYTHON"

    async def test_keeps_a_version_already_pinned(
        self, db: DbSessionFactory, seed_languages: None
    ) -> None:
        code_eval_id, version_ids = await _insert_code_evaluator(db, versions=2)
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator",
            code_evaluator_id=code_eval_id,
            code_evaluator_version_id=version_ids[0],
        )
        async with db() as session:
            pinned = await pin_evaluator_definition(definition, session=session)
        assert isinstance(pinned, StoredCodeEvaluatorDefinition)
        assert pinned.code_evaluator_version_id == version_ids[0]

    async def test_rejects_an_evaluator_without_a_version(
        self, db: DbSessionFactory, seed_languages: None
    ) -> None:
        code_eval_id, _ = await _insert_code_evaluator(db, versions=0)
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator", code_evaluator_id=code_eval_id
        )
        async with db() as session:
            with pytest.raises(BadRequest, match="no current version"):
                await pin_evaluator_definition(definition, session=session)

    async def test_leaves_inline_definitions_alone(self, db: DbSessionFactory) -> None:
        definition = InlineCodeEvaluatorDefinition(
            type="inline_code_evaluator",
            name="draft",
            language="PYTHON",
            source_code="def evaluate(output): return 1",
            sandbox_config_id=1,
            output_configs=[],
        )
        async with db() as session:
            assert await pin_evaluator_definition(definition, session=session) is definition
