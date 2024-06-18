import pytest
from phoenix.utilities.re import parse_env_headers


@pytest.mark.parametrize(
    "case",
    [
        # invalid header name
        ("=value", [], True),
        ("}key=value", [], True),
        ("@key()=value", [], True),
        ("/key=value", [], True),
        # invalid header value
        ("name=\\", [], True),
        ('name=value"', [], True),
        ("name=;value", [], True),
        # different header values
        ("name=", [("name", "")], False),
        ("name===value=", [("name", "==value=")], False),
        # url-encoded headers
        ("key=value%20with%20space", [("key", "value with space")], False),
        ("key%21=value", [("key!", "value")], False),
        ("%20key%20=%20value%20", [("key", "value")], False),
        # header name case normalization
        ("Key=Value", [("key", "Value")], False),
        # mix of valid and invalid headers
        (
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
        ),
        (
            "=name=valu3; key1; key2, content  =  application, red=\tvelvet; cake",
            [("content", "application")],
            True,
        ),
    ],
)
def test_get_env_client_headers(case, caplog):
    headers, expected, warn = case
    assert parse_env_headers(headers) == dict(expected)
    if warn:
        with caplog.at_level(level="WARNING"):
            assert parse_env_headers(headers) == dict(expected)
            assert (
                "Header format invalid! Header values in environment variables must be URL encoded"
                in caplog.records[0].message
            )

    else:
        assert parse_env_headers(headers) == dict(expected)
