import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

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


def _make_real_engine() -> AsyncEngine:
    """Return a real PostgreSQL/asyncpg `AsyncEngine` to stand in for the
    value returned by the patched `create_async_engine`. No connection is
    made — SQLAlchemy's engine construction is lazy, and `dispose()` on
    an engine that never connected tears down the (empty) pool.

    Using a real engine rather than a `MagicMock` ensures the
    credential-lifecycle wrapper is exercised against the same
    `__slots__`-bound class used in production. Any approach that
    attempts instance-level assignment to `engine.dispose` fails here."""
    return create_async_engine("postgresql+asyncpg://u:p@localhost/db")


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
        mock_cae = MagicMock(return_value=_make_real_engine())

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
        # async_creator is supplied by create_azure_engine itself — and must
        # actually be an `async def`, since SQLAlchemy will `await` it.
        assert asyncio.iscoroutinefunction(cae_kwargs["async_creator"])

    async def test_connect_args_forwarded_to_asyncpg(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_real_engine())

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
        # The username from `url.username` must reach asyncpg unchanged.
        assert asyncpg_kwargs["user"] == "mi-user"


class TestTokenFetchingBehavior:
    """Token retrieval behavior delegated to azure-identity."""

    async def test_each_connection_attempt_requests_token(self) -> None:
        """The creator asks the credential for a token on every connection open."""
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=[_make_token_response("token_1"), _make_token_response("token_2")]
        )
        mock_connect = AsyncMock(return_value=MagicMock())
        mock_cae = MagicMock(return_value=_make_real_engine())

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
    """`create_azure_engine` returns a wrapper around the `AsyncEngine` whose
    `dispose()` also closes the underlying `DefaultAzureCredential`. This is
    required for the Azure migration-engine path, which must close its
    credential on the migration event loop before `asyncio.run` tears the
    loop down. See internal_docs/specs/postgres-cloud-auth-pooling.md,
    section 'Event-loop affinity of azure.identity.aio credentials'.

    These tests use a real `AsyncEngine` (not `MagicMock`) so that
    engine-shape regressions — e.g., instance-level assignment to a method
    on a `__slots__`-bound class — are caught by the test suite."""

    async def test_returned_object_behaves_as_async_engine(self) -> None:
        """The wrapper must satisfy `isinstance(_, AsyncEngine)` and forward
        attribute access to the wrapped engine so that callers which
        type-check or read ordinary engine attributes continue to work.
        A change that replaces the transparent proxy with, e.g., a direct
        `AsyncEngine` subclass would fail this test."""
        mock_credential = AsyncMock()
        mock_credential.close = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())

        real_engine = _make_real_engine()
        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", return_value=real_engine),
        ):
            engine = create_azure_engine(_make_url(), {})

        assert isinstance(engine, AsyncEngine)
        # Transparent forwarding: attributes of the underlying engine must be
        # reachable through the wrapper without special-casing.
        assert engine.url is real_engine.url
        assert engine.pool is real_engine.pool
        assert engine.sync_engine is real_engine.sync_engine
        await engine.dispose()

    async def test_dispose_also_closes_credential(self) -> None:
        mock_credential = AsyncMock()
        mock_credential.close = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=_make_token_response())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", return_value=_make_real_engine()),
        ):
            engine = create_azure_engine(_make_url(), {})
            await engine.dispose()

        mock_credential.close.assert_awaited_once()

    async def test_credential_closed_even_if_dispose_raises(self) -> None:
        """If the underlying engine's `dispose` raises, the credential must
        still be closed so the Azure SDK's aiohttp session doesn't leak."""
        mock_credential = AsyncMock()
        mock_credential.close = AsyncMock()

        real_engine = _make_real_engine()

        # Drive the except-branch by substituting `dispose` with a raising
        # async function. Instance-level assignment is forbidden by
        # `AsyncEngine.__slots__`, so patch the class attribute for the
        # duration of this test.
        async def _boom(*_args: Any, **_kwargs: Any) -> None:
            raise RuntimeError("boom")

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", return_value=real_engine),
            patch.object(AsyncEngine, "dispose", _boom),
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

        real_engine_a = _make_real_engine()
        real_engine_b = _make_real_engine()
        mock_cae = MagicMock(side_effect=[real_engine_a, real_engine_b])

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
        mock_cae = MagicMock(return_value=_make_real_engine())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("phoenix.db.azure_auth.create_async_engine", mock_cae),
            patch("asyncpg.connect", mock_connect),
        ):
            create_azure_engine(_make_url(), {})
            creator = mock_cae.call_args.kwargs["async_creator"]
            await creator()

        assert mock_credential.get_token.call_args.args[0] == custom_scope
