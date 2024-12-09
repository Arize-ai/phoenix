from phoenix.db.engines import get_async_db_url


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
