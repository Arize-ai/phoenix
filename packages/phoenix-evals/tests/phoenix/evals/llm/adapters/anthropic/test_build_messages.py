# type: ignore
"""Tests for ``AnthropicAdapter._build_messages()`` (issue #12465)."""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter
from phoenix.evals.llm.prompts import Message, MessageRole


def _make_adapter(model: str = "claude-3-sonnet") -> AnthropicAdapter:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "Anthropic"
    client.messages.create = MagicMock()
    return AnthropicAdapter(client=client, model=model)


# --------------------------------------------------------------------------- #
# Happy paths
# --------------------------------------------------------------------------- #


def test_string_prompt_becomes_single_user_message() -> None:
    messages, system = _make_adapter()._build_messages("hi")
    assert messages == [{"role": "user", "content": "hi"}]
    assert system == ""


def test_empty_string_prompt_is_preserved() -> None:
    messages, system = _make_adapter()._build_messages("")
    assert messages == [{"role": "user", "content": ""}]
    assert system == ""


def test_openai_format_dict_list_extracts_system() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "be concise"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    messages, system = adapter._build_messages(prompt)
    assert system == "be concise"
    assert messages == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]


def test_typed_message_list_extracts_system() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(role=MessageRole.SYSTEM, content="sys"),
        Message(role=MessageRole.USER, content="q"),
        Message(role=MessageRole.AI, content="a"),
    ]
    messages, system = adapter._build_messages(prompt)
    assert system == "sys"
    assert messages == [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]


def test_multiple_system_messages_concatenated_with_newline() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "rule 1"},
        {"role": "system", "content": "rule 2"},
        {"role": "user", "content": "q"},
    ]
    messages, system = adapter._build_messages(prompt)
    assert system == "rule 1\nrule 2"
    assert messages == [{"role": "user", "content": "q"}]


def test_developer_role_extracted_as_system() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "developer", "content": "be strict"},
        {"role": "user", "content": "q"},
    ]
    messages, system = adapter._build_messages(prompt)
    assert system == "be strict"
    assert messages == [{"role": "user", "content": "q"}]


@pytest.mark.parametrize(
    "alias,expected_role",
    [
        ("ai", "assistant"),
        ("human", "user"),
        ("model", "assistant"),
    ],
)
def test_role_aliases_normalize_on_dict_path(alias: str, expected_role: str) -> None:
    adapter = _make_adapter()
    messages, _ = adapter._build_messages([{"role": alias, "content": "x"}])
    assert messages == [{"role": expected_role, "content": "x"}]


def test_content_parts_joined_with_newline() -> None:
    adapter = _make_adapter()
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "one"},
                {"type": "text", "text": "two"},
            ],
        }
    ]
    messages, _ = adapter._build_messages(prompt)
    assert messages == [{"role": "user", "content": "one\ntwo"}]


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
    messages, _ = adapter._build_messages(prompt)
    assert messages == [{"role": "user", "content": "keep"}]


# --------------------------------------------------------------------------- #
# Failure modes
# --------------------------------------------------------------------------- #


def test_missing_role_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'role'"):
        _make_adapter()._build_messages([{"content": "x"}])


def test_missing_content_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'content'"):
        _make_adapter()._build_messages([{"role": "user"}])


def test_none_content_raises() -> None:
    with pytest.raises(ValueError, match="None content"):
        _make_adapter()._build_messages([{"role": "user", "content": None}])


def test_empty_string_content_raises() -> None:
    with pytest.raises(ValueError, match="empty string content"):
        _make_adapter()._build_messages([{"role": "user", "content": ""}])


def test_empty_list_content_raises() -> None:
    with pytest.raises(ValueError, match="empty list content"):
        _make_adapter()._build_messages([{"role": "user", "content": []}])


def test_non_str_non_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="Expected prompt"):
        _make_adapter()._build_messages(42)  # type: ignore[arg-type]


def test_empty_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        _make_adapter()._build_messages([])


def test_unknown_role_raises() -> None:
    with pytest.raises(ValueError, match="Unknown message role"):
        _make_adapter()._build_messages([{"role": "tool", "content": "x"}])


def test_mixed_typed_and_dict_list_raises() -> None:
    prompt = [
        Message(role=MessageRole.USER, content="q"),
        {"role": "assistant", "content": "a"},
    ]
    with pytest.raises(ValueError, match="mixes typed Message"):
        _make_adapter()._build_messages(prompt)


def test_user_message_with_name_field_is_validated() -> None:
    with pytest.raises(ValueError, match="empty string content"):
        _make_adapter()._build_messages([{"role": "user", "name": "alice", "content": ""}])


def test_user_message_with_name_field_round_trips_on_non_system_messages() -> None:
    """Non-system messages are forwarded as Anthropic message dicts; any
    caller-supplied extras (e.g. ``name``) ride along on those dicts.
    System-role extras are intentionally discarded because the system text
    folds into the separate ``system`` string parameter."""
    messages, system = _make_adapter()._build_messages(
        [
            {"role": "system", "name": "policy", "content": "be concise"},
            {"role": "user", "name": "alice", "content": "hi"},
            {"role": "assistant", "name": "bot", "content": "hello"},
        ]
    )
    assert system == "be concise"
    assert messages == [
        {"role": "user", "name": "alice", "content": "hi"},
        {"role": "assistant", "name": "bot", "content": "hello"},
    ]


def test_unknown_extra_keys_are_preserved_on_dict_path() -> None:
    """Caller-supplied keys other than ``role``/``content`` flow through
    unchanged on non-system messages; canonical role/content from the
    transform always win."""
    messages, _ = _make_adapter()._build_messages(
        [{"role": "user", "name": "alice", "content": "hi", "metadata": {"trace_id": "abc"}}]
    )
    assert messages == [
        {"role": "user", "name": "alice", "content": "hi", "metadata": {"trace_id": "abc"}}
    ]
