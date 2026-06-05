import asyncio

from sqlalchemy import text

from phoenix.db.engines import aio_sqlite_engine, get_async_db_url


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


def test_memory_sqlite_models_are_ready_when_created_inside_running_loop() -> None:
    async def run() -> None:
        engine = aio_sqlite_engine(get_async_db_url("sqlite:///:memory:"), migrate=True)
        try:
            async with engine.connect() as conn:
                table = await conn.scalar(
                    text(
                        "select name from sqlite_master "
                        "where type = 'table' and name = 'generative_model_custom_providers'"
                    )
                )
            assert table == "generative_model_custom_providers"
        finally:
            await engine.dispose()

    asyncio.run(run())
