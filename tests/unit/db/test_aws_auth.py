from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import URL

from phoenix.db.aws_auth import create_aws_engine


def _make_url(
    host: str = "mydb.abc123.us-west-2.rds.amazonaws.com",
    database: str = "mydb",
    username: str = "iam-user",
    port: int | None = None,
) -> URL:
    return URL.create(
        "postgresql+asyncpg",
        host=host,
        database=database,
        username=username,
        port=port,
    )


def _make_rds_client(token: str = "test_rds_token") -> MagicMock:
    """Build a mock aioboto3 rds client whose generate_db_auth_token returns the given
    token. The production code only consumes the return value as a string, so no
    other attributes are set."""
    client = MagicMock()
    client.generate_db_auth_token = AsyncMock(return_value=token)
    return client


def _make_aioboto3_session(rds_client: MagicMock) -> MagicMock:
    """Build a mock aioboto3 session whose .client('rds') async-context yields the provided client."""
    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=rds_client)
    client_context.__aexit__ = AsyncMock(return_value=None)

    session = MagicMock()
    session.client = MagicMock(return_value=client_context)
    return session


def _make_mock_engine() -> MagicMock:
    engine = MagicMock()
    engine.dispose = AsyncMock()
    return engine


class TestCreateAwsEngineValidation:
    """Input validation before any engine is constructed."""

    def test_missing_host_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", database="mydb", username="user")
        with pytest.raises(ValueError, match="host is required"):
            create_aws_engine(url, {})

    def test_missing_username_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", host="db.example.com", database="mydb")
        with pytest.raises(ValueError, match="user is required"):
            create_aws_engine(url, {})


class TestEngineWiring:
    """`create_aws_engine` forwards extra kwargs to `create_async_engine` and
    wires an async_creator that uses aioboto3 for token generation."""

    async def test_engine_kwargs_forwarded_to_create_async_engine(self) -> None:
        session = _make_aioboto3_session(_make_rds_client())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("aioboto3.Session", return_value=session),
            patch("phoenix.db.aws_auth.create_async_engine", mock_cae),
        ):
            create_aws_engine(
                _make_url(),
                {"ssl": "require"},
                echo=True,
                pool_pre_ping=True,
                pool_recycle=3300,
            )

        cae_kwargs = mock_cae.call_args.kwargs
        assert cae_kwargs["echo"] is True
        assert cae_kwargs["pool_pre_ping"] is True
        assert cae_kwargs["pool_recycle"] == 3300
        assert callable(cae_kwargs["async_creator"])

    async def test_connect_args_forwarded_to_asyncpg(self) -> None:
        mock_connect = AsyncMock(return_value=MagicMock())
        connect_args = {"ssl": "require", "timeout": 30}
        session = _make_aioboto3_session(_make_rds_client())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("aioboto3.Session", return_value=session),
            patch("phoenix.db.aws_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_aws_engine(_make_url(), connect_args)
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        call_kwargs = mock_connect.call_args.kwargs
        assert call_kwargs["ssl"] == "require"
        assert call_kwargs["timeout"] == 30

    async def test_default_port_and_database_used_when_url_omits_them(self) -> None:
        """Port defaults to 5432 and database defaults to 'postgres' when the URL
        omits them. This is an AWS-specific fallback — the Azure factory requires
        database to be present — so the defaults are worth a regression guard."""
        url = URL.create(
            "postgresql+asyncpg",
            host="mydb.abc123.us-west-2.rds.amazonaws.com",
            username="iam-user",
        )
        rds_client = _make_rds_client()
        session = _make_aioboto3_session(rds_client)
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("aioboto3.Session", return_value=session),
            patch("phoenix.db.aws_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_aws_engine(url, {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        assert rds_client.generate_db_auth_token.call_args.kwargs["Port"] == 5432
        asyncpg_kwargs = mock_connect.call_args.kwargs
        assert asyncpg_kwargs["port"] == 5432
        assert asyncpg_kwargs["database"] == "postgres"


class TestTokenGenerationBehavior:
    """Token generation behavior delegated to aioboto3."""

    async def test_each_connection_attempt_generates_token(self) -> None:
        """The creator asks aioboto3 for a fresh token on every connection open, and
        the token is passed to asyncpg as the password for that connection."""
        rds_client = MagicMock()
        rds_client.generate_db_auth_token = AsyncMock(side_effect=["token_1", "token_2"])
        session = _make_aioboto3_session(rds_client)
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("aioboto3.Session", return_value=session),
            patch("phoenix.db.aws_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_aws_engine(_make_url(), {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()
            await creator()

        assert rds_client.generate_db_auth_token.call_count == 2
        assert mock_connect.call_args_list[0].kwargs["password"] == "token_1"
        assert mock_connect.call_args_list[1].kwargs["password"] == "token_2"

    async def test_aioboto3_receives_url_components(self) -> None:
        """generate_db_auth_token is called with the host, port, and username parsed
        from the SQLAlchemy URL. Guards against refactors that swap or drop any of
        the three kwargs (DBHostname / Port / DBUsername)."""
        url = _make_url(
            host="mydb.abc123.us-west-2.rds.amazonaws.com",
            username="iam-user-alice",
            port=5433,
        )
        rds_client = _make_rds_client()
        session = _make_aioboto3_session(rds_client)
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("aioboto3.Session", return_value=session),
            patch("phoenix.db.aws_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_aws_engine(url, {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        call_kwargs = rds_client.generate_db_auth_token.call_args.kwargs
        assert call_kwargs["DBHostname"] == "mydb.abc123.us-west-2.rds.amazonaws.com"
        assert call_kwargs["Port"] == 5433
        assert call_kwargs["DBUsername"] == "iam-user-alice"
