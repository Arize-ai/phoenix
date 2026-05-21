from secrets import token_hex

import sqlalchemy

from phoenix.db import models
from phoenix.server.api.dataloaders import SandboxProviderDataLoader
from phoenix.server.sandbox.sync import sync_languages
from phoenix.server.types import DbSessionFactory


async def test_sandbox_provider_batches_lookups(db: DbSessionFactory) -> None:
    async with db() as session:
        await sync_languages(session)
        kinds = [f"z-{token_hex(3)}" for _ in range(4)]
        providers = [
            models.SandboxProvider(
                backend_type=k,
                enabled=True,
            )
            for k in kinds
        ]
        session.add_all(providers)
        await session.flush()

    loader = SandboxProviderDataLoader(db)

    query_count = 0

    @sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, "before_cursor_execute")
    def count_queries(conn, cursor, statement, parameters, context, executemany):  # type: ignore[no-untyped-def]
        nonlocal query_count
        if "FROM sandbox_providers" in statement:
            query_count += 1

    try:
        keys = [*kinds, kinds[0]]
        results = await loader._load_fn(keys)
    finally:
        sqlalchemy.event.remove(sqlalchemy.engine.Engine, "before_cursor_execute", count_queries)

    assert query_count == 1
    assert [(r.backend_type if r is not None else None) for r in results] == keys
    missing = await loader._load_fn(["__nonexistent-kind__"])
    assert missing == [None]
