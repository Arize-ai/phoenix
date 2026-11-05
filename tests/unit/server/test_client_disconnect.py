from typing import Any

import pytest
from starlette.types import ASGIApp, Message


async def _post_then_disconnect(app: ASGIApp, *, path: str, content_type: str) -> list[Message]:
    """
    Drive the real ASGI app the way uvicorn does when a client hangs up before
    the request body is complete: the first ``receive()`` yields a partial body
    chunk (``more_body=True``) and the next one yields ``http.disconnect``.
    """
    events: list[Message] = [
        {"type": "http.request", "body": b"partial", "more_body": True},
        {"type": "http.disconnect"},
    ]
    sent: list[Message] = []

    async def receive() -> Message:
        return events.pop(0) if events else {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        sent.append(message)

    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "query_string": b"",
        "headers": [
            (b"host", b"test"),
            (b"content-type", content_type.encode()),
            (b"content-length", b"1000"),
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }
    await app(scope, receive, send)
    return sent


@pytest.mark.parametrize(
    "path, content_type",
    [
        pytest.param("/v1/traces", "application/x-protobuf", id="rest-v1-traces"),
        pytest.param("/graphql", "application/json", id="graphql"),
    ],
)
async def test_client_disconnect_while_reading_body_does_not_escape_app(
    asgi_app: ASGIApp,
    path: str,
    content_type: str,
) -> None:
    """
    A client that disconnects before its request body is fully read ends the
    request quietly with a 499 instead of an unhandled ClientDisconnect.
    """
    sent = await _post_then_disconnect(asgi_app, path=path, content_type=content_type)
    statuses = [m["status"] for m in sent if m["type"] == "http.response.start"]
    assert statuses == [499]
