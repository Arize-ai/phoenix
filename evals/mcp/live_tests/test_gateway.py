import io
import json
from email.message import Message
from unittest.mock import Mock

import pytest

import smoke_gateway
from smoke_gateway import Handler, validate_inference


@pytest.mark.parametrize(
    "provider, route, payload",
    [
        (
            "anthropic",
            "messages",
            {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {"type": "url", "url": "https://example.com/a.pdf"},
                            }
                        ],
                    }
                ]
            },
        ),
        (
            "openai",
            "responses",
            {
                "input": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_file", "file_url": "https://example.com/a.pdf"}
                        ],
                    }
                ]
            },
        ),
        (
            "openai",
            "responses",
            {
                "input": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_image", "image_url": "https://example.com/a.png"}
                        ],
                    }
                ]
            },
        ),
        ("openai", "responses", {"input": [{"type": "input_file", "file_id": "outside-file"}]}),
    ],
)
def test_remote_inputs_are_denied_before_any_upstream_request(
    monkeypatch, provider, route, payload
):
    monkeypatch.setenv("PROVIDER", provider)
    monkeypatch.setenv("INTERFACE", "mcp")
    upstream = Mock()
    monkeypatch.setattr(smoke_gateway.urllib.request, "urlopen", upstream)
    audit = Mock()
    monkeypatch.setattr(smoke_gateway, "audit", audit)
    handler = object.__new__(Handler)
    handler.path = "/provider/v1/" + route
    handler.command = "POST"
    handler.client_address = ("172.20.0.2", 123)
    body = json.dumps(payload).encode()
    handler.headers = Message()
    handler.headers["Content-Length"] = str(len(body))
    handler.rfile = io.BytesIO(body)
    handler.send_error = Mock()
    handler.forward()
    handler.send_error.assert_called_once()
    assert handler.send_error.call_args.args[0] == 403
    upstream.assert_not_called()
    assert audit.call_args.kwargs["kind"] == "denied"


def test_inline_input_and_local_tool_url_schemas_remain_available():
    validate_inference(
        {
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "Explain https://example.com as text"},
                        {"type": "input_image", "image_url": "data:image/png;base64,AAAA"},
                    ],
                }
            ],
            "tools": [
                {
                    "type": "function",
                    "name": "lookup",
                    "parameters": {"type": "object", "properties": {"url": {"type": "string"}}},
                }
            ],
        }
    )
