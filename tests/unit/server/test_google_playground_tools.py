from typing import Any, Optional

from phoenix.server.api.helpers.playground_clients import (
    ChatCompletionMessageRole,
    GoogleStreamingClient,
)


def _make_messages(
    items: list[tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[Any]]]]
):
    return items


def test_map_tool_choice_to_google_modes():
    # NONE
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google({"type": "none"})
    assert mode == "NONE" and allow is None
    # AUTO / zero_or_more
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google({"type": "auto"})
    assert mode == "AUTO" and allow is None
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google({"type": "zero_or_more"})
    assert mode == "AUTO" and allow is None
    # ANY / one_or_more
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google({"type": "any"})
    assert mode == "ANY" and allow is None
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google({"type": "one_or_more"})
    assert mode == "ANY" and allow is None
    # SPECIFIC FUNCTION
    mode, allow = GoogleStreamingClient._map_tool_choice_to_google(
        {"type": "specific_function", "name": "get_weather"}
    )
    assert mode == "ANY" and allow == ["get_weather"]


def test_build_google_messages_with_tool_response_mapping():
    # Create an instance without running __init__ to avoid SDK import
    client = GoogleStreamingClient.__new__(GoogleStreamingClient)

    tool_calls = [
        {"id": "abc", "function": {"name": "get_weather", "arguments": "{}"}},
    ]
    messages = _make_messages(
        [
            (ChatCompletionMessageRole.SYSTEM, "sys", None, None),
            (ChatCompletionMessageRole.AI, "", None, tool_calls),
            (ChatCompletionMessageRole.TOOL, "{\"temp\": 70}", "abc", None),
            (ChatCompletionMessageRole.USER, "Final question", None, None),
        ]
    )

    history, prompt, system = client._build_google_messages(messages)

    # System prompts collected
    assert system.strip() == "sys"

    # The last user content becomes the prompt
    assert prompt == "Final question"

    # History should include the AI tool call as model content and the tool response as functionResponse part
    # Find the functionResponse part
    fr_name = None
    fr_resp = None
    for entry in history:
        if entry.get("role") != "user":
            continue
        parts = entry.get("parts", [])
        if not isinstance(parts, list):
            continue
        for p in parts:
            if isinstance(p, dict) and "functionResponse" in p:
                fr = p["functionResponse"]
                fr_name = fr.get("name")
                fr_resp = fr.get("response")
    assert fr_name == "get_weather"
    assert isinstance(fr_resp, dict) and fr_resp.get("temp") == 70
