import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from freezegun import freeze_time
from sqlalchemy import URL

from phoenix.db.azure_auth import create_azure_token_connection_creator


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


def _make_token_response(
    token: str = "test_token_jwt",
    expires_on: float | None = None,
) -> MagicMock:
    """Build a mock AccessToken with the given token string and expiry timestamp."""
    if expires_on is None:
        expires_on = time.time() + 3600  # 1 hour from now
    mock = MagicMock()
    mock.token = token
    mock.expires_on = expires_on
    return mock


class TestCreateAzureTokenConnectionCreatorValidation:
    """Input validation before the async creator is returned."""

    def test_missing_host_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", database="mydb", username="user")
        with pytest.raises(ValueError, match="host is required"):
            create_azure_token_connection_creator(url, {})

    def test_missing_database_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", host="db.example.com", username="user")
        with pytest.raises(ValueError, match="Database name is required"):
            create_azure_token_connection_creator(url, {})

    def test_missing_username_raises(self) -> None:
        url = URL.create("postgresql+asyncpg", host="db.example.com", database="mydb")
        with pytest.raises(ValueError, match="username is required"):
            create_azure_token_connection_creator(url, {})


class TestConnectionCreatorBehavior:
    """Structural behavior of the factory itself (not the async inner function)."""

    def test_credential_created_once_per_factory_call(self) -> None:
        """Each call to the factory creates exactly one DefaultAzureCredential instance."""
        mock_class = MagicMock()
        with patch("azure.identity.aio.DefaultAzureCredential", mock_class):
            create_azure_token_connection_creator(_make_url(), {})
            create_azure_token_connection_creator(_make_url(), {})
        assert mock_class.call_count == 2

    async def test_connect_args_forwarded_to_asyncpg(self) -> None:
        """Arbitrary connect_args are forwarded unchanged to asyncpg.connect."""
        token_response = _make_token_response()
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())
        connect_args = {"ssl": "require", "timeout": 30}

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), connect_args)
            await creator()

        call_kwargs = mock_connect.call_args.kwargs
        assert call_kwargs["ssl"] == "require"
        assert call_kwargs["timeout"] == 30


class TestTokenCaching:
    """Azure access token caching and refresh behavior."""

    async def test_cache_miss_fetches_token(self) -> None:
        """A fresh creator with no cached token calls get_token once."""
        token_response = _make_token_response("my_token")
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()

        mock_credential.get_token.assert_called_once()
        assert mock_connect.call_args.kwargs["password"] == "my_token"

    async def test_cache_hit_skips_get_token(self) -> None:
        """A second call within the token lifetime reuses the cached token."""
        token_response = _make_token_response("cached_token")
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()  # populates cache
            await creator()  # should hit cache

        assert mock_credential.get_token.call_count == 1

    async def test_cache_near_expiry_refreshes(self) -> None:
        """Token with < 300s remaining triggers a refresh."""
        with freeze_time("2024-01-01 12:00:00"):
            now = time.time()
            first_response = _make_token_response("old_token", expires_on=now + 290)
            second_response = _make_token_response("new_token", expires_on=now + 3600)
            mock_credential = AsyncMock()
            mock_credential.get_token = AsyncMock(side_effect=[first_response, second_response])
            mock_connect = AsyncMock(return_value=MagicMock())

            with (
                patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
                patch("asyncpg.connect", mock_connect),
            ):
                creator = create_azure_token_connection_creator(_make_url(), {})
                await creator()  # caches token expiring in 290s
                await creator()  # < 300s buffer → refresh

        assert mock_credential.get_token.call_count == 2

    async def test_cache_at_exact_300s_boundary_refreshes(self) -> None:
        """Token expiring in exactly 300s is NOT considered valid (strict > comparison)."""
        with freeze_time("2024-01-01 12:00:00"):
            now = time.time()
            first_response = _make_token_response("old_token", expires_on=now + 300)
            second_response = _make_token_response("new_token", expires_on=now + 3600)
            mock_credential = AsyncMock()
            mock_credential.get_token = AsyncMock(side_effect=[first_response, second_response])
            mock_connect = AsyncMock(return_value=MagicMock())

            with (
                patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
                patch("asyncpg.connect", mock_connect),
            ):
                creator = create_azure_token_connection_creator(_make_url(), {})
                await creator()
                await creator()

        assert mock_credential.get_token.call_count == 2

    async def test_concurrent_calls_both_succeed(self) -> None:
        """Concurrent calls with an empty cache both return a valid token.

        Due to the intentional lock-outside-fetch design, get_token may be
        called 1 or 2 times (harmless race); both connections must succeed.
        """
        token_response = _make_token_response("concurrent_token")
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            results = await asyncio.gather(creator(), creator())

        assert len(results) == 2
        assert 1 <= mock_credential.get_token.call_count <= 2
        for call in mock_connect.call_args_list:
            assert call.kwargs["password"] == "concurrent_token"


class TestRetryLogic:
    """Exponential backoff retries for transient token fetch failures."""

    async def test_transient_error_retries_with_backoff(self) -> None:
        """Two transient failures followed by success succeeds, with correct backoff delays."""
        token_response = _make_token_response()
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=[Exception("timeout"), Exception("connection reset"), token_response]
        )
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
            patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()

        assert mock_credential.get_token.call_count == 3
        # Exponential backoff: 2^0=1s then 2^1=2s
        assert mock_sleep.call_count == 2
        calls = [c.args[0] for c in mock_sleep.call_args_list]
        assert calls == [1, 2]

    async def test_max_retries_exceeded_raises_runtime_error(self) -> None:
        """Three consecutive transient failures raise RuntimeError."""
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=[Exception("err1"), Exception("err2"), Exception("err3")]
        )
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
            patch("asyncio.sleep", new_callable=AsyncMock),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            with pytest.raises(RuntimeError, match="after 3 attempts"):
                await creator()

        assert mock_credential.get_token.call_count == 3

    async def test_credential_unavailable_no_retry(self) -> None:
        """CredentialUnavailableError is re-raised immediately without retrying."""
        from azure.identity import CredentialUnavailableError

        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=CredentialUnavailableError("no credential chain succeeded")
        )
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
            patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            with pytest.raises(CredentialUnavailableError):
                await creator()

        mock_credential.get_token.assert_called_once()
        mock_sleep.assert_not_called()

    async def test_client_auth_error_no_retry(self) -> None:
        """ClientAuthenticationError is re-raised immediately without retrying."""
        from azure.core.exceptions import ClientAuthenticationError

        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(
            side_effect=ClientAuthenticationError("invalid client secret")
        )
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
            patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            with pytest.raises(ClientAuthenticationError):
                await creator()

        mock_credential.get_token.assert_called_once()
        mock_sleep.assert_not_called()

    async def test_cancelled_error_propagates(self) -> None:
        """asyncio.CancelledError is re-raised immediately."""
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(side_effect=asyncio.CancelledError())
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
            patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            with pytest.raises(asyncio.CancelledError):
                await creator()

        mock_credential.get_token.assert_called_once()
        mock_sleep.assert_not_called()


class TestScopeConfiguration:
    """Azure token scope selection."""

    async def test_default_scope_used(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """The ossrdbms-aad default scope is used when no env var is set."""
        monkeypatch.delenv("PHOENIX_POSTGRES_AZURE_SCOPE", raising=False)
        token_response = _make_token_response()
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()

        scope_arg = mock_credential.get_token.call_args.args[0]
        assert scope_arg == "https://ossrdbms-aad.database.windows.net/.default"

    async def test_custom_scope_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A custom scope env var overrides the default."""
        custom_scope = "https://ossrdbms-aad.database.usgovcloudapi.net/.default"
        monkeypatch.setenv("PHOENIX_POSTGRES_AZURE_SCOPE", custom_scope)
        token_response = _make_token_response()
        mock_credential = AsyncMock()
        mock_credential.get_token = AsyncMock(return_value=token_response)
        mock_connect = AsyncMock(return_value=MagicMock())

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()

        scope_arg = mock_credential.get_token.call_args.args[0]
        assert scope_arg == custom_scope
