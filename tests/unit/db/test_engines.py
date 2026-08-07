from pathlib import Path
from unittest import mock

import pytest
import sqlean
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine, get_async_db_url


def test_get_async_sqlite_db_url() -> None:
    connection_str = "sqlite:///phoenix.db"
    url = get_async_db_url(connection_str)
    assert url.drivername == "sqlite+aiosqlite"
    assert url.database == "phoenix.db"


def test_get_async_postgresql_db_url() -> None:
    # Test credentials as url params
    connection_str = "postgresql://user:password@localhost:5432/phoenix?ssl=require"
    url = get_async_db_url(connection_str)
    assert url.drivername == "postgresql+asyncpg"
    assert url.database == "phoenix"
    assert url.host == "localhost"
    assert url.query["user"] == "user"
    assert url.query["password"] == "password"
    assert url.query["ssl"] == "require"

    # Test credentials as part of the url
    connection_str = "postgresql://user:password@localhost:5432/phoenix"
    url = get_async_db_url(connection_str)
    assert url.drivername == "postgresql+asyncpg"
    assert url.database == "phoenix"
    assert url.host == "localhost"
    # NB(mikeldking): No idea why this fails to authenticate
    assert url.query["user"] == "user"
    assert url.query["password"] == "password"


async def test_memory_sqlite_models_are_ready_when_created_inside_running_loop() -> None:
    engine = aio_sqlite_engine(get_async_db_url("sqlite:///:memory:"), migrate=True)
    try:
        async with engine.connect() as conn:
            # The default project row is inserted at the end of init_models,
            # so its presence proves initialization ran to completion before
            # the engine was returned.
            name = await conn.scalar(text("select name from projects"))
        assert name == "default"
    finally:
        await engine.dispose()


async def test_memory_sqlite_init_failure_propagates_to_caller() -> None:
    async def fail(_engine: object) -> None:
        raise RuntimeError("init failed")

    with mock.patch("phoenix.db.engines.init_models", fail):
        with pytest.raises(RuntimeError, match="init failed"):
            aio_sqlite_engine(get_async_db_url("sqlite:///:memory:"), migrate=True)


async def test_sqlite_read_session_holds_one_snapshot(tmp_path: Path) -> None:
    path = tmp_path / "phoenix.db"
    setup = sqlean.connect(str(path))
    setup.execute("PRAGMA journal_mode = WAL")
    setup.execute("create table t (x int)")
    setup.execute("insert into t values (1)")
    setup.commit()
    setup.close()

    engine = aio_sqlite_read_engine(get_async_db_url(f"sqlite:///{path}"))
    assert engine is not None
    try:
        async with async_sessionmaker(engine, expire_on_commit=False).begin() as session:
            before = await session.scalar(text("select count(*) from t"))
            # Committed by another connection while the session is open. Without
            # an explicit BEGIN the next statement takes a fresh WAL read mark
            # and counts it, so the two reads disagree within one session.
            writer = sqlean.connect(str(path))
            writer.execute("insert into t values (2)")
            writer.commit()
            writer.close()
            after = await session.scalar(text("select count(*) from t"))
        assert before == 1
        assert after == 1
    finally:
        await engine.dispose()
