# type: ignore
"""Tests for ``LiteLLMAdapter._build_messages()`` (issue #12465)."""

import pytest

from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
from phoenix.evals.llm.adapters.litellm.client import LiteLLMClient
from phoenix.evals.llm.prompts import Message, MessageRole


def _make_adapter(model: str = "gpt-4o") -> LiteLLMAdapter:
    client = LiteLLMClient(provider="openai", model=model)
    return LiteLLMAdapter(client=client, model=model)


# --------------------------------------------------------------------------- #
# Happy paths
# --------------------------------------------------------------------------- #


def test_string_prompt_becomes_single_user_message() -> None:
    adapter = _make_adapter()
    assert adapter._build_messages("Hello") == [{"role": "user", "content": "Hello"}]


def test_empty_string_prompt_is_preserved() -> None:
    adapter = _make_adapter()
    assert adapter._build_messages("") == [{"role": "user", "content": ""}]


def test_openai_format_dict_list_roundtrips() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "be concise"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    assert adapter._build_messages(prompt) == prompt


def test_typed_message_list_roundtrips() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(role=MessageRole.SYSTEM, content="sys"),
        Message(role=MessageRole.USER, content="q"),
        Message(role=MessageRole.AI, content="a"),
    ]
    # LiteLLM does not apply the OpenAI reasoning-model system-role swap —
    # it forwards to whatever provider it is routing to.
    assert adapter._build_messages(prompt) == [
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
        # "developer" is preserved verbatim — LiteLLM routes it to the correct
        # provider-side role for the target model (e.g. "developer" for o-series
        # models via the OpenAI router); silently rewriting to "system" would
        # break callers targeting reasoning models through LiteLLM.
        ("developer", "developer"),
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
                {"type": "text", "text": "a"},
                {"type": "text", "text": "b"},
            ],
        }
    ]
    assert adapter._build_messages(prompt) == [{"role": "user", "content": "a\nb"}]


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
    assert adapter._build_messages(prompt) == [{"role": "user", "content": "keep"}]


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
