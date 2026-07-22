import pytest

from phoenix.client import AsyncClient, Client
from phoenix.client.client import _update_headers  # pyright: ignore[reportPrivateUsage]


@pytest.mark.parametrize(
    "input, expected",
    [
        # Note the addition of the trailing slash here
        ("https://app.phoenix.arize.com/s/me", "https://app.phoenix.arize.com/s/me/"),
        ("http://localhost:6006/", "http://localhost:6006/"),
        ("http://localhost:6006", "http://localhost:6006"),
    ],
)
def test_url_sanitization(input: str, expected: str) -> None:
    """
    This test exists mainly to show the diverging behavior within httpx where a
    trailing / is added to URLs that contain slugs.
    """
    client = Client(base_url=input)
    assert str(client._client.base_url) == expected  # pyright: ignore[reportPrivateUsage]


@pytest.mark.asyncio
async def test_async_client_uses_sync_client_default_timeout_policy() -> None:
    client = Client(base_url="http://localhost:6006")
    async_client = AsyncClient(base_url="http://localhost:6006")

    try:
        assert async_client._client.timeout == client._client.timeout  # pyright: ignore[reportPrivateUsage]
    finally:
        await async_client._client.aclose()  # pyright: ignore[reportPrivateUsage]


def test_explicit_authorization_suppresses_differently_cased_environment_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_CLIENT_HEADERS", "authorization=Bearer%20environment")

    headers = _update_headers({"Authorization": "Bearer explicit"}, None)

    assert headers == {"Authorization": "Bearer explicit"}
