import pytest

from phoenix.utilities.re import parse_env_headers


@pytest.mark.parametrize(
    "headers, expected, warn",
    [
        # invalid header name
        pytest.param("=value", [], True, id="invalid header name 1"),
        pytest.param("}key=value", [], True, id="invalid header name 2"),
        pytest.param("@key()=value", [], True, id="invalid header name 3"),
        pytest.param("/key=value", [], True, id="invalid header name 4"),
        # invalid header value
        pytest.param("name=\\", [], True, id="invalid header value 1"),
        pytest.param('name=value"', [], True, id="invalid header value 2"),
        pytest.param("name=;value", [], True, id="invalid header value 3"),
        # different header values
        pytest.param("name=", [("name", "")], False, id="different header values 1"),
        pytest.param(
            "name===value=",
            [("name", "==value=")],
            False,
            id="different header values 2",
        ),
        # url-encoded headers
        pytest.param(
            "key=value%20with%20space",
            [("key", "value with space")],
            False,
            id="url-encoded headers 1",
        ),
        pytest.param("key%21=value", [("key!", "value")], False, id="url-encoded headers 2"),
        pytest.param(
            "%20key%20=%20value%20",
            [("key", "value")],
            False,
            id="url-encoded headers 3",
        ),
        # header name case normalization
        pytest.param("Key=Value", [("key", "Value")], False, id="header name case normalization"),
        # mix of valid and invalid headers
        pytest.param(
            "name1=value1,invalidName, name2 =   value2   , name3=value3==",
            [
                (
                    "name1",
                    "value1",
                ),
                ("name2", "value2"),
                ("name3", "value3=="),
            ],
            True,
            id="mix of valid and invalid headers 1",
        ),
        pytest.param(
            "=name=valu3; key1; key2, content  =  application, red=\tvelvet; cake",
            [("content", "application")],
            True,
            id="mix of valid and invalid headers 2",
        ),
    ],
)
def test_get_env_client_headers(
    headers: str,
    expected: list[tuple[str, str]],
    warn: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    if warn:
        with caplog.at_level(level="WARNING"):
            assert parse_env_headers(headers) == dict(expected)
            assert (
                "Header format invalid! Header values in environment variables must be URL encoded"
                in caplog.records[0].message
            )

    else:
        assert parse_env_headers(headers) == dict(expected)
