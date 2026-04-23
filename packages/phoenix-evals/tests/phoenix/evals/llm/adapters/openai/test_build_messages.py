# type: ignore
"""Tests for ``OpenAIAdapter._build_messages()`` (issue #12465)."""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter
from phoenix.evals.llm.prompts import Message, MessageRole


def _make_adapter(model: str = "gpt-4o") -> OpenAIAdapter:
    client = MagicMock()
    client.__module__ = "openai"
    client.__class__.__name__ = "OpenAI"
    client.model = model
    client.chat.completions.create = MagicMock()
    return OpenAIAdapter(client=client, model=model)


# --------------------------------------------------------------------------- #
# Happy paths
# --------------------------------------------------------------------------- #


def test_string_prompt_becomes_single_user_message() -> None:
    adapter = _make_adapter()
    assert adapter._build_messages("Hello") == [{"role": "user", "content": "Hello"}]


def test_openai_format_dict_list_roundtrips() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "be concise"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    result = adapter._build_messages(prompt)
    assert result == [
        {"role": "system", "content": "be concise"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]


def test_typed_message_list_roundtrips() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(role=MessageRole.SYSTEM, content="sys"),
        Message(role=MessageRole.USER, content="q"),
        Message(role=MessageRole.AI, content="a"),
    ]
    result = adapter._build_messages(prompt)
    assert result == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]


@pytest.mark.parametrize(
    "alias,expected_role",
    [
        ("ai", "assistant"),
        ("human", "user"),
        ("model", "assistant"),
        ("developer", "system"),
    ],
)
def test_role_aliases_normalize_on_dict_path(alias: str, expected_role: str) -> None:
    adapter = _make_adapter()
    result = adapter._build_messages([{"role": alias, "content": "x"}])
    assert result == [{"role": expected_role, "content": "x"}]


def test_content_parts_joined_with_newline() -> None:
    adapter = _make_adapter()
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "part one"},
                {"type": "text", "text": "part two"},
            ],
        }
    ]
    assert adapter._build_messages(prompt) == [
        {"role": "user", "content": "part one\npart two"},
    ]


def test_non_text_content_parts_silently_dropped() -> None:
    """Documents current behavior — non-text parts are dropped rather than errored."""
    adapter = _make_adapter()
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "only text survives"},
                {"type": "image_url", "image_url": {"url": "http://x/y.png"}},
            ],
        }
    ]
    assert adapter._build_messages(prompt) == [
        {"role": "user", "content": "only text survives"},
    ]


# --------------------------------------------------------------------------- #
# Failure modes
# --------------------------------------------------------------------------- #


def test_missing_role_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="index 0.*'role'"):
        adapter._build_messages([{"content": "x"}])


def test_missing_content_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="index 0.*'content'"):
        adapter._build_messages([{"role": "user"}])


def test_none_content_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="index 0.*None content"):
        adapter._build_messages([{"role": "user", "content": None}])


def test_empty_string_content_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="empty string content"):
        adapter._build_messages([{"role": "user", "content": ""}])


def test_empty_list_content_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="empty list content"):
        adapter._build_messages([{"role": "user", "content": []}])


def test_non_str_non_list_prompt_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="Expected prompt"):
        adapter._build_messages(42)  # type: ignore[arg-type]


def test_empty_list_prompt_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="cannot be empty"):
        adapter._build_messages([])


def test_unknown_role_raises() -> None:
    adapter = _make_adapter()
    with pytest.raises(ValueError, match="Unknown message role"):
        adapter._build_messages([{"role": "tool", "content": "x"}])


# --------------------------------------------------------------------------- #
# _system_role() integration
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "model,expected_system_role",
    [
        ("gpt-4o", "system"),
        ("o3-mini", "developer"),
    ],
)
def test_system_role_routing_on_typed_messages(model: str, expected_system_role: str) -> None:
    adapter = _make_adapter(model)
    result = adapter._build_messages([Message(role=MessageRole.SYSTEM, content="be concise")])
    assert result == [{"role": expected_system_role, "content": "be concise"}]


@pytest.mark.parametrize(
    "model,expected_system_role",
    [
        ("gpt-4o", "system"),
        ("o3-mini", "developer"),
    ],
)
def test_system_role_routing_on_dict_messages(model: str, expected_system_role: str) -> None:
    adapter = _make_adapter(model)
    result = adapter._build_messages([{"role": "system", "content": "be concise"}])
    assert result == [{"role": expected_system_role, "content": "be concise"}]
