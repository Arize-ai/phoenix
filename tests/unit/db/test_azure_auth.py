from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import URL

from phoenix.db.azure_auth import create_azure_engine


def _make_url(
    host: str = "db.postgres.database.azure.com",
    database: str = "mydb",
    username: str = "mi-user",
    port: int | None = None,
) -> URL:
    return URL.create(
        "postgresql+asyncpg",
        host=host,
        database=database,
        username=username,
        port=port,
    )


def _make_token_response(token: str = "test_token_jwt") -> MagicMock:
    """Build a mock AccessToken with the given token string. The production code
    only reads `.token`, so `expires_on` and friends are intentionally not set."""
    mock = MagicMock()
    mock.token = token
    return mock


def _make_mock_engine() -> MagicMock:
    """Build a MagicMock that stands in for the AsyncEngine returned by
    `sqlalchemy.ext.asyncio.create_async_engine`. `dispose` is an AsyncMock so
    the credential-lifecycle patching in `create_azure_engine` can wrap it."""
    engine = MagicMock()
    engine.dispose = AsyncMock()
    return engine


class TestCreateAzureEngineValidation:
    """Input validation before any engine is constructed."""

    def test_missing_host_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", database="mydb", username="user")
        with pytest.raises(ValueError, match="host is required"):
            create_azure_engine(url, {})

    def test_missing_database_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", host="db.example.com", username="user")
        with pytest.raises(ValueError, match="Database name is required"):
            create_azure_engine(url, {})

    def test_missing_username_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", host="db.example.com", database="mydb")
        with pytest.raises(ValueError, match="username is required"):
            create_azure_engine(url, {})


class TestEngineWiring:
    """`create_azure_engine` forwards extra kwargs to `create_async_engine`
    and wires an async_creator that uses the Azure credential."""

    async def test_engine_kwargs_forwarded_to_create_async_engine(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
        ):
            create_azure_engine(
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
        # async_creator is supplied by create_azure_engine itself.
        assert callable(cae_kwargs["async_creator"])

    async def test_connect_args_forwarded_to_asyncpg(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_azure_engine(_make_url(), {"ssl": "require", "timeout": 30})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        asyncpg_kwargs = mock_connect.call_args.kwargs
        assert asyncpg_kwargs["ssl"] == "require"
        assert asyncpg_kwargs["timeout"] == 30


class TestTokenFetchingBehavior:
    """Token retrieval behavior delegated to azure-identity."""

    async def test_each_connection_attempt_requests_token(self) -> None:
        """The creator asks the credential for a token on every connection open."""
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=[_make_token_response("token_1"), _make_token_response("token_2")]
        )
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_azure_engine(_make_url(), {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()
            await creator()

        assert mock_credential.get_token.call_count == 2
        assert mock_connect.call_args_list[0].kwargs["password"] == "token_1"
        assert mock_connect.call_args_list[1].kwargs["password"] == "token_2"


class TestCredentialLifecycle:
    """`create_azure_engine` patches `engine.dispose` so it also closes the
    underlying `DefaultAzureCredential`. This is load-bearing for the Azure
    migration-engine path, which must close its credential on the migration
    event loop before `asyncio.run` tears the loop down. See
    internal_docs/specs/postgres-cloud-auth-pooling.md, section
    'Event-loop affinity of azure.identity.aio credentials'."""

    async def test_dispose_also_closes_credential(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.close = AsyncMock()
        mock_engine = _make_mock_engine()
        original_dispose = mock_engine.dispose

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", return_value=mock_engine),
        ):
            engine = create_azure_engine(_make_url(), {})
            await engine.dispose()

        original_dispose.assert_awaited_once()
        mock_credential.close.assert_awaited_once()

    async def test_credential_closed_even_if_dispose_raises(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.close = AsyncMock()
        mock_engine = _make_mock_engine()
        mock_engine.dispose = AsyncMock(side_effect=RuntimeError("boom"))

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", return_value=mock_engine),
        ):
            engine = create_azure_engine(_make_url(), {})
            with pytest.raises(RuntimeError, match="boom"):
                await engine.dispose()

        mock_credential.close.assert_awaited_once()

    async def test_each_call_builds_its_own_credential(self) -> None:
        """Two `create_azure_engine` calls must produce two independent
        `DefaultAzureCredential` instances, each tied to its own engine's
        dispose. This is the invariant that makes the migration-engine +
        primary-engine split safe across the two event loops those engines
        end up running on."""
        credentials: list[AsyncMock] = []

        def fresh_credential(*_args: Any, **_kwargs: Any) -> AsyncMock:
            cred = AsyncMock()
            cred.close = AsyncMock()
            cred.get_token = AsyncMock(return_value=_make_token_response())
            credentials.append(cred)
            return cred

        mock_engine_a = _make_mock_engine()
        mock_engine_b = _make_mock_engine()
        mock_cae = MagicMock(side_effect=[mock_engine_a, mock_engine_b])

        with (
            patch(
                "azure.identity.aio.DefaultAzureCredential",
                side_effect=fresh_credential,
            ),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
        ):
            engine_a = create_azure_engine(_make_url(), {})
            engine_b = create_azure_engine(_make_url(), {})
            await engine_a.dispose()
            await engine_b.dispose()

        assert len(credentials) == 2
        assert credentials[0] is not credentials[1]
        credentials[0].close.assert_awaited_once()
        credentials[1].close.assert_awaited_once()


class TestScopeConfiguration:
    """Azure token scope selection."""

    async def test_configured_scope_is_passed_to_get_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Integration check: whatever get_env_postgres_azure_scope() returns is the
        scope the creator asks the credential for. Env-var resolution itself is
        tested separately in tests/unit/test_config.py."""
        custom_scope = "https://ossrdbms-aad.database.usgovcloudapi.net/.default"
        monkeypatch.setenv("PHOENIX_POSTGRES_AZURE_SCOPE", custom_scope)
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_mock_engine())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_azure_engine(_make_url(), {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        assert mock_credential.get_token.call_args.args[0] == custom_scope
