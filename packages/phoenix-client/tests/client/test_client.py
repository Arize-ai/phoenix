import pytest

from phoenix.client import Client


@pytest.mark.parametrize(
    "input, expected",
    [
        ("https://app.phoenix.arize.com/s/me", "https://app.phoenix.arize.com/s/me/"),
        ("http://localhost:6006/", "http://localhost:6006"),
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
