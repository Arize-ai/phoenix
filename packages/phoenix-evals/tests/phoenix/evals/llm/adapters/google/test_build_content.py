# type: ignore
"""Tests for ``GoogleGenAIAdapter._build_content()`` (issue #12465)."""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter
from phoenix.evals.llm.prompts import Message, MessageRole


def _make_adapter(model: str = "gemini-1.5-pro") -> GoogleGenAIAdapter:
    client = MagicMock()
    client.__module__ = "google.genai"
    client.model = model
    client.models = MagicMock()
    client.chats = MagicMock()
    # aio attr absent -> _check_if_async_client() treats this as sync
    try:
        del client.aio
    except AttributeError:
        pass
    return GoogleGenAIAdapter(client=client, model=model)


# --------------------------------------------------------------------------- #
# Happy paths
# --------------------------------------------------------------------------- #


def test_string_prompt_passed_through() -> None:
    content, system = _make_adapter()._build_content("hi")
    assert content == "hi"
    assert system == ""


def test_empty_string_prompt_is_preserved() -> None:
    content, system = _make_adapter()._build_content("")
    assert content == ""
    assert system == ""


def test_openai_format_dict_list_converts_to_google() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "be concise"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    content, system = adapter._build_content(prompt)
    assert system == "be concise"
    assert content == [
        {"role": "user", "parts": [{"text": "hi"}]},
        {"role": "model", "parts": [{"text": "hello"}]},
    ]


def test_typed_message_list_converts_to_google() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(role=MessageRole.SYSTEM, content="sys"),
        Message(role=MessageRole.USER, content="q"),
        Message(role=MessageRole.AI, content="a"),
    ]
    content, system = adapter._build_content(prompt)
    assert system == "sys"
    assert content == [
        {"role": "user", "parts": [{"text": "q"}]},
        {"role": "model", "parts": [{"text": "a"}]},
    ]


def test_message_role_ai_maps_to_model_string() -> None:
    adapter = _make_adapter()
    prompt = [Message(role=MessageRole.AI, content="a")]
    content, _ = adapter._build_content(prompt)
    assert content == [{"role": "model", "parts": [{"text": "a"}]}]


@pytest.mark.parametrize(
    "alias,expected_role",
    [
        ("ai", "model"),
        ("human", "user"),
        ("model", "model"),
    ],
)
def test_role_aliases_normalize_on_dict_path(alias: str, expected_role: str) -> None:
    adapter = _make_adapter()
    content, _ = adapter._build_content([{"role": alias, "content": "x"}])
    assert content == [{"role": expected_role, "parts": [{"text": "x"}]}]


def test_developer_role_extracted_as_system_instruction() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "developer", "content": "be strict"},
        {"role": "user", "content": "q"},
    ]
    content, system = adapter._build_content(prompt)
    assert system == "be strict"
    assert content == [{"role": "user", "parts": [{"text": "q"}]}]


def test_content_parts_joined_with_newline() -> None:
    adapter = _make_adapter()
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "a"},
                {"type": "text", "text": "b"},
            ],
        }
    ]
    content, _ = adapter._build_content(prompt)
    assert content == [{"role": "user", "parts": [{"text": "a\nb"}]}]


def test_non_text_content_parts_silently_dropped() -> None:
    adapter = _make_adapter()
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "keep"},
                {"type": "image_url", "image_url": {"url": "http://x/y.png"}},
            ],
        }
    ]
    content, _ = adapter._build_content(prompt)
    assert content == [{"role": "user", "parts": [{"text": "keep"}]}]


# --------------------------------------------------------------------------- #
# Failure modes
# --------------------------------------------------------------------------- #


def test_missing_role_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'role'"):
        _make_adapter()._build_content([{"content": "x"}])


def test_missing_content_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'content'"):
        _make_adapter()._build_content([{"role": "user"}])


def test_none_content_raises() -> None:
    with pytest.raises(ValueError, match="None content"):
        _make_adapter()._build_content([{"role": "user", "content": None}])


def test_empty_string_content_raises() -> None:
    with pytest.raises(ValueError, match="empty string content"):
        _make_adapter()._build_content([{"role": "user", "content": ""}])


def test_empty_list_content_raises() -> None:
    with pytest.raises(ValueError, match="empty list content"):
        _make_adapter()._build_content([{"role": "user", "content": []}])


def test_non_str_non_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="Expected prompt"):
        _make_adapter()._build_content(42)  # type: ignore[arg-type]


def test_empty_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        _make_adapter()._build_content([])


def test_unknown_role_raises() -> None:
    with pytest.raises(ValueError, match="Unknown message role"):
        _make_adapter()._build_content([{"role": "tool", "content": "x"}])
