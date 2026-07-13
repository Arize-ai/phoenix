from secrets import token_hex
from typing import Any

import sqlalchemy

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.dataloaders.evaluator_by_id import EvaluatorByIdDataLoader
from phoenix.server.types import DbSessionFactory


def _capture_statements() -> tuple[list[str], Any]:
    statements: list[str] = []

    @sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, "before_cursor_execute")
    def capture_statement(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    return statements, capture_statement


def _stop_capturing(listener: Any) -> None:
    sqlalchemy.event.remove(sqlalchemy.engine.Engine, "before_cursor_execute", listener)


async def test_evaluator_by_id_batches_lookups(db: DbSessionFactory) -> None:
    async with db() as session:
        prompt = models.Prompt(name=Identifier(token_hex(4)))
        session.add(prompt)
        await session.flush()

        evaluators = [
            models.LLMEvaluator(
                name=Identifier(token_hex(4)),
                prompt_id=prompt.id,
                output_configs=[],
            )
            for _ in range(5)
        ]
        session.add_all(evaluators)
        await session.flush()
        ids = [evaluator.id for evaluator in evaluators]

    loader = EvaluatorByIdDataLoader(db)
    statements, listener = _capture_statements()
    try:
        keys = [*ids, ids[0]]
        results = await loader._load_fn(keys)
    finally:
        _stop_capturing(listener)

    assert len(statements) == 2
    assert all(isinstance(result, models.LLMEvaluator) for result in results)
    assert [result.id if result is not None else None for result in results] == keys
    missing = await loader._load_fn([max(ids) + 1000])
    assert missing == [None]


async def test_evaluator_by_id_code_only_loads_code_fields(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(models.Language(name="PYTHON"))
        await session.flush()
        evaluator = models.CodeEvaluator(
            name=Identifier(token_hex(4)),
            language="PYTHON",
            input_mapping=InputMapping(
                literal_mapping={"threshold": 0.5},
                path_mapping={"output": "$.output"},
            ),
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        evaluator_id = evaluator.id

    statements, listener = _capture_statements()
    try:
        result = (await EvaluatorByIdDataLoader(db)._load_fn([evaluator_id]))[0]
    finally:
        _stop_capturing(listener)

    assert isinstance(result, models.CodeEvaluator)
    assert result.language == "PYTHON"
    assert result.input_mapping == InputMapping(
        literal_mapping={"threshold": 0.5},
        path_mapping={"output": "$.output"},
    )
    assert result.output_configs == []
    assert len(statements) == 2
    assert not any("llm_evaluators" in statement for statement in statements)
    assert not any("builtin_evaluators" in statement for statement in statements)


async def test_evaluator_by_id_builtin_only_loads_builtin_fields(db: DbSessionFactory) -> None:
    async with db() as session:
        evaluator = models.BuiltinEvaluator(
            name=Identifier(token_hex(4)),
            key=token_hex(4),
            input_schema={"type": "object"},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        evaluator_id = evaluator.id

    statements, listener = _capture_statements()
    try:
        result = (await EvaluatorByIdDataLoader(db)._load_fn([evaluator_id]))[0]
    finally:
        _stop_capturing(listener)

    assert isinstance(result, models.BuiltinEvaluator)
    assert result.key == evaluator.key
    assert result.input_schema == {"type": "object"}
    assert result.output_configs == []
    assert len(statements) == 2
    assert not any("llm_evaluators" in statement for statement in statements)
    assert not any("code_evaluators" in statement for statement in statements)


async def test_evaluator_by_id_mixed_batch_loads_each_subtype_once(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        session.add(models.Language(name="PYTHON"))
        prompt = models.Prompt(name=Identifier(token_hex(4)))
        session.add(prompt)
        await session.flush()
        llm_evaluator = models.LLMEvaluator(
            name=Identifier(token_hex(4)),
            prompt_id=prompt.id,
            output_configs=[],
        )
        code_evaluator = models.CodeEvaluator(
            name=Identifier(token_hex(4)),
            language="PYTHON",
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[],
        )
        builtin_evaluator = models.BuiltinEvaluator(
            name=Identifier(token_hex(4)),
            key=token_hex(4),
            input_schema={},
            output_configs=[],
        )
        session.add_all([llm_evaluator, code_evaluator, builtin_evaluator])
        await session.flush()
        keys = [code_evaluator.id, llm_evaluator.id, builtin_evaluator.id, code_evaluator.id]

    statements, listener = _capture_statements()
    try:
        results = await EvaluatorByIdDataLoader(db)._load_fn(keys)
    finally:
        _stop_capturing(listener)

    assert len(statements) == 4
    assert [type(result) for result in results] == [
        models.CodeEvaluator,
        models.LLMEvaluator,
        models.BuiltinEvaluator,
        models.CodeEvaluator,
    ]
    assert [result.id if result is not None else None for result in results] == keys
    assert isinstance(results[0], models.CodeEvaluator)
    assert results[0].language == "PYTHON"
    assert isinstance(results[1], models.LLMEvaluator)
    assert results[1].prompt_id == prompt.id
    assert isinstance(results[2], models.BuiltinEvaluator)
    assert results[2].key == builtin_evaluator.key
