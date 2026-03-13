import httpx
import pytest

from phoenix.client import AsyncClient, Client
from phoenix.client.client import PhoenixAsyncHTTPClient, PhoenixHTTPClient


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


class TestClientPreservesUserHTTPClient:
    def test_sync_client_preserves_identity_and_config(self) -> None:
        user_client = httpx.Client(
            base_url="http://example.com",
            headers={"X-Custom": "value"},
            timeout=httpx.Timeout(99.0),
            auth=("user", "pass"),
        )
        client = Client(http_client=user_client)
        inner = client._client  # pyright: ignore[reportPrivateUsage]

        assert inner is user_client
        assert isinstance(inner, PhoenixHTTPClient)
        assert inner.server_version is None
        assert str(inner.base_url) == "http://example.com"
        assert inner.headers["x-custom"] == "value"
        assert inner.timeout == httpx.Timeout(99.0)

    def test_async_client_preserves_identity_and_config(self) -> None:
        user_client = httpx.AsyncClient(
            base_url="http://example.com",
            headers={"X-Custom": "value"},
            timeout=httpx.Timeout(99.0),
        )
        client = AsyncClient(http_client=user_client)
        inner = client._client  # pyright: ignore[reportPrivateUsage]

        assert inner is user_client
        assert isinstance(inner, PhoenixAsyncHTTPClient)
        assert inner.server_version is None
        assert str(inner.base_url) == "http://example.com"
        assert inner.headers["x-custom"] == "value"
        assert inner.timeout == httpx.Timeout(99.0)

    def test_sync_client_preserves_event_hooks(self) -> None:
        hook_called = False

        def on_response(response: httpx.Response) -> None:
            nonlocal hook_called
            hook_called = True

        user_client = httpx.Client(
            base_url="http://example.com",
            event_hooks={"response": [on_response]},
        )
        client = Client(http_client=user_client)
        inner = client._client  # pyright: ignore[reportPrivateUsage]

        assert on_response in inner.event_hooks["response"]
