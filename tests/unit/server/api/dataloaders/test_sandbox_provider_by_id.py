from secrets import token_hex

import sqlalchemy
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.dataloaders import SandboxProviderByIdDataLoader
from phoenix.server.types import DbSessionFactory


async def test_sandbox_provider_by_id_batches_lookups(db: DbSessionFactory) -> None:
    """Loading N provider ids issues a single batched query and preserves key order."""
    async with db() as session:
        language_id = await session.scalar(
            select(models.Language.id).where(models.Language.name == "PYTHON")
        )
        if language_id is None:
            language = models.Language(name="PYTHON")
            session.add(language)
            await session.flush()
            language_id = language.id
        providers = [
            models.SandboxProvider(
                backend_type=f"backend-{token_hex(3)}",
                language_id=language_id,
                config={},
                enabled=True,
            )
            for _ in range(4)
        ]
        session.add_all(providers)
        await session.flush()
        ids = [p.id for p in providers]

    loader = SandboxProviderByIdDataLoader(db)

    query_count = 0

    @sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, "before_cursor_execute")
    def count_queries(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        nonlocal query_count
        if "FROM sandbox_providers" in statement:
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
