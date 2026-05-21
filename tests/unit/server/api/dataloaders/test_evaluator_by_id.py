from secrets import token_hex

import sqlalchemy

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.dataloaders import EvaluatorByIdDataLoader
from phoenix.server.types import DbSessionFactory


async def test_evaluator_by_id_batches_lookups(db: DbSessionFactory) -> None:
    async with db() as session:
        prompt = models.Prompt(name=Identifier(token_hex(4)))
        session.add(prompt)
        await session.flush()

        evaluators = [
            models.LLMEvaluator(name=Identifier(token_hex(4)), prompt_id=prompt.id)
            for _ in range(5)
        ]
        session.add_all(evaluators)
        await session.flush()
        ids = [e.id for e in evaluators]

    loader = EvaluatorByIdDataLoader(db)

    query_count = 0

    @sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, "before_cursor_execute")
    def count_queries(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        nonlocal query_count
        if "FROM evaluators" in statement:
            query_count += 1

    try:
        keys = [*ids, ids[0]]
        results = await loader._load_fn(keys)
    finally:
        sqlalchemy.event.remove(sqlalchemy.engine.Engine, "before_cursor_execute", count_queries)

    assert query_count == 1
    assert [r.id if r is not None else None for r in results] == keys
    missing = await loader._load_fn([max(ids) + 1000])
    assert missing == [None]
