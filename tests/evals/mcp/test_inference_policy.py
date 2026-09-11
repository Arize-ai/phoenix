import pytest

from evals.mcp.environment.gateway import validate_inference


@pytest.mark.parametrize(
    "payload",
    [
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
        {
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_file", "file_url": "https://example.com/a.pdf"}],
                }
            ]
        },
        {
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_image", "image_url": "https://example.com/a.png"}],
                }
            ]
        },
        {"input": [{"type": "input_file", "file_id": "outside-file"}]},
    ],
)
def test_provider_fetch_inputs_are_rejected(payload):
    with pytest.raises(ValueError, match="Remote input|External provider"):
        validate_inference(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {"tools": [{"type": "web_search"}]},
        {"tools": [{"type": "namespace", "tools": [{"type": "web_search"}]}]},
        {"tools": [{"type": "shell", "environment": {"type": "container_auto"}}]},
        {"mcp_servers": [{"url": "https://outside.example/mcp"}]},
    ],
)
def test_provider_hosted_tools_are_rejected(payload):
    with pytest.raises(ValueError, match="Hosted tools|Remote execution"):
        validate_inference(payload)


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
