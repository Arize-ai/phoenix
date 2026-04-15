from unittest.mock import AsyncMock, MagicMock, patch

import pytest
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


def _make_token_response(token: str = "test_token_jwt") -> MagicMock:
    """Build a mock AccessToken with the given token string. The production code
    only reads `.token`, so `expires_on` and friends are intentionally not set."""
    mock = MagicMock()
    mock.token = token
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


class TestTokenFetchingBehavior:
    """Token retrieval behavior delegated to azure-identity."""

    async def test_each_connection_attempt_requests_token(self) -> None:
        """The creator asks the credential for a token on every connection open."""
        first_response = _make_token_response("token_1")
        second_response = _make_token_response("token_2")
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
        assert mock_connect.call_args_list[0].kwargs["password"] == "token_1"
        assert mock_connect.call_args_list[1].kwargs["password"] == "token_2"


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

        with (
            patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_credential),
            patch("asyncpg.connect", mock_connect),
        ):
            creator = create_azure_token_connection_creator(_make_url(), {})
            await creator()

        assert mock_credential.get_token.call_args.args[0] == custom_scope
