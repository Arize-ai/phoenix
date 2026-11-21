import pytest

from phoenix.client.utils.parse_env_headers import parse_env_headers


@pytest.mark.parametrize(
    "headers, expected",
    [
        ("x=a,y=b", {"x": "a", "y": "b"}),
        ("Authorization=Bearer%20abc", {"authorization": "Bearer abc"}),
        # The form shown in the README: a value that is not URL encoded
        (
            "Authorization=Bearer your-api-key,custom-header=value",
            {"authorization": "Bearer your-api-key", "custom-header": "value"},
        ),
        ("Authorization", {}),
        ("x=a,bad", {"x": "a"}),
    ],
)
def test_parse_env_headers(headers: str, expected: dict[str, str]) -> None:
    assert parse_env_headers(headers) == expected


def test_parse_env_headers_does_not_log_header_values(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level("WARNING"):
        assert parse_env_headers("Authorization=Bearer secret-key") == {
            "authorization": "Bearer secret-key"
        }
        parse_env_headers('bad"name=secret-key')
        assert parse_env_headers("Authorization: Bearer secret-key") == {}
    assert "secret-key" not in caplog.text
