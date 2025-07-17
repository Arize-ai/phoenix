from unittest.mock import AsyncMock, patch

import pytest
from starlette.middleware.gzip import GZipMiddleware as _GZipMiddleware

from phoenix.server.middleware.gzip import GZipMiddleware, _is_multipart, _remove_accept_encoding


@pytest.fixture
def middleware() -> GZipMiddleware:
    return GZipMiddleware(AsyncMock())


@pytest.mark.parametrize(
    "headers,expected",
    [
        # Basic cases
        pytest.param([(b"accept", b"multipart/mixed")], True, id="multipart_only"),
        pytest.param([(b"accept", b"application/json")], False, id="json_only"),
        pytest.param(
            [
                (b"accept", b"application/json"),
                (b"accept", b"multipart/mixed"),
            ],
            True,
            id="multiple_accept_headers",
        ),
        pytest.param(
            [(b"accept", b"application/json, multipart/mixed")],
            True,
            id="single_header_multiple_values",
        ),
        # Case sensitivity
        pytest.param([(b"ACCEPT", b"MULTIPART/MIXED")], True, id="uppercase_accept"),
        pytest.param([(b"Accept", b"Multipart/Mixed")], True, id="mixed_case_accept"),
        pytest.param(
            [(b"accept", b"Multipart/Mixed, application/json")],
            True,
            id="mixed_case_in_value",
        ),
        # Edge cases
        pytest.param([], False, id="empty_headers"),
        pytest.param([(b"accept", b"")], False, id="empty_value"),
        pytest.param([(b"accept", b"multipart/mixed; boundary=123")], True, id="with_parameters"),
        pytest.param(
            [(b"accept", b"multipart/mixed, application/json")], True, id="mixed_content_types"
        ),
        pytest.param(
            [(b"accept", b"multipart/mixed; boundary=123, application/json; charset=utf-8")],
            True,
            id="multiple_values_with_parameters",
        ),
    ],
)
def test_is_multipart(
    headers: list[tuple[bytes, bytes]],
    expected: bool,
) -> None:
    assert _is_multipart(headers) is expected


@pytest.mark.parametrize(
    "headers,expected_kept",
    [
        # Basic cases
        pytest.param(
            [
                (b"accept", b"multipart/mixed"),
                (b"accept-encoding", b"gzip"),
                (b"content-type", b"application/json"),
            ],
            [
                (b"accept", b"multipart/mixed"),
                (b"content-type", b"application/json"),
            ],
            id="remove_single_encoding",
        ),
        pytest.param(
            [
                (b"accept-encoding", b"gzip"),
                (b"accept-encoding", b"deflate"),
            ],
            [],
            id="remove_multiple_encoding",
        ),
        # Case sensitivity
        pytest.param(
            [
                (b"Accept-Encoding", b"gzip"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="uppercase_encoding",
        ),
        pytest.param(
            [
                (b"accept-encoding", b"Gzip"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="mixed_case_in_value",
        ),
        # Combined values
        pytest.param(
            [
                (b"accept-encoding", b"gzip, deflate"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="combined_values",
        ),
        pytest.param(
            [
                (b"accept-encoding", b"gzip , deflate"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="combined_values_with_spaces",
        ),
        # Quality values
        pytest.param(
            [
                (b"accept-encoding", b"gzip; q=0.8, deflate; q=0.6"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="quality_values",
        ),
        pytest.param(
            [
                (b"accept-encoding", b"gzip;q=0.8,deflate;q=0.6"),
                (b"content-type", b"application/json"),
            ],
            [(b"content-type", b"application/json")],
            id="quality_values_no_spaces",
        ),
        # Edge cases
        pytest.param([], [], id="empty_headers"),
        pytest.param(
            [(b"accept-encoding", b"")],
            [],
            id="empty_value",
        ),
        pytest.param(
            [(b"accept-encoding", b"invalid; q=0.8")],
            [],
            id="invalid_value",
        ),
    ],
)
def test_remove_accept_encoding(
    headers: list[tuple[bytes, bytes]],
    expected_kept: list[tuple[bytes, bytes]],
) -> None:
    result = list(_remove_accept_encoding(headers))
    assert result == expected_kept


@pytest.mark.parametrize(
    "scope,expected_headers",
    [
        # HTTP requests
        pytest.param(
            {
                "type": "http",
                "headers": [(b"accept", b"application/json")],
            },
            [(b"accept", b"application/json")],
            id="regular_http_request",
        ),
        pytest.param(
            {
                "type": "http",
                "headers": [
                    (b"accept", b"multipart/mixed"),
                    (b"accept-encoding", b"gzip"),
                ],
            },
            [(b"accept", b"multipart/mixed")],
            id="multipart_http_request",
        ),
        pytest.param(
            {
                "type": "http",
                "headers": [
                    (b"accept", b"application/json"),
                    (b"accept", b"multipart/mixed"),
                    (b"accept-encoding", b"gzip"),
                ],
            },
            [
                (b"accept", b"application/json"),
                (b"accept", b"multipart/mixed"),
            ],
            id="multiple_accept_headers",
        ),
        # Non-HTTP requests
        pytest.param(
            {
                "type": "websocket",
                "headers": [(b"accept", b"multipart/mixed")],
            },
            [(b"accept", b"multipart/mixed")],
            id="websocket_request",
        ),
        pytest.param(
            {
                "type": "lifespan",
                "headers": [(b"accept", b"multipart/mixed")],
            },
            [(b"accept", b"multipart/mixed")],
            id="lifespan_request",
        ),
        # Edge cases
        pytest.param(
            {
                "type": "http",
                "headers": [],
            },
            [],
            id="no_headers",
        ),
        pytest.param(
            {
                "type": "http",
                "headers": [(b"accept", b"")],
            },
            [(b"accept", b"")],
            id="empty_header_value",
        ),
        pytest.param(
            {
                "type": "http",
                "headers": [(b"accept", b"invalid")],
            },
            [(b"accept", b"invalid")],
            id="invalid_header_value",
        ),
    ],
)
async def test_gzip_middleware(
    middleware: GZipMiddleware,
    scope: dict[str, object],
    expected_headers: list[tuple[bytes, bytes]],
) -> None:
    receive = AsyncMock()
    send = AsyncMock()
    with patch.object(_GZipMiddleware, "__call__", new_callable=AsyncMock) as mock_call:
        await middleware(scope, receive, send)
        mock_call.assert_called_once()
        call_args = mock_call.call_args[0]
        assert call_args[0]["headers"] == expected_headers
        assert call_args[1] == receive
        assert call_args[2] == send


@pytest.mark.parametrize(
    "scope",
    [
        pytest.param({}, id="empty_scope"),
        pytest.param({"type": "http"}, id="missing_headers"),
        pytest.param({"headers": []}, id="missing_type"),
        pytest.param({"type": "invalid", "headers": []}, id="invalid_type"),
        pytest.param({"type": "http", "headers": "not a list"}, id="non_list_headers"),
    ],
)
async def test_gzip_middleware_invalid_scope(
    middleware: GZipMiddleware,
    scope: dict[str, object],
) -> None:
    receive = AsyncMock()
    send = AsyncMock()
    with patch.object(_GZipMiddleware, "__call__", new_callable=AsyncMock) as mock_call:
        await middleware(scope, receive, send)
        mock_call.assert_called_once()
        call_args = mock_call.call_args[0]
        assert call_args[0] == scope
        assert call_args[1] == receive
        assert call_args[2] == send
