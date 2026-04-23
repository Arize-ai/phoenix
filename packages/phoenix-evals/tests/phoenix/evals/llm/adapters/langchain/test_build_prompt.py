# type: ignore
"""Tests for ``LangChainModelAdapter._build_prompt()`` (issue #12465)."""

from unittest.mock import MagicMock

import pytest

pytest.importorskip("langchain_core")

from langchain_core.messages import (  # noqa: E402
    AIMessage,
    HumanMessage,
    SystemMessage,
)

from phoenix.evals.llm.adapters.langchain.adapter import LangChainModelAdapter  # noqa: E402
from phoenix.evals.llm.prompts import Message, MessageRole  # noqa: E402


def _make_adapter() -> LangChainModelAdapter:
    """A MagicMock happens to satisfy the adapter's ``invoke``/``predict`` check."""
    client = MagicMock()
    client.__module__ = "langchain_openai"
    return LangChainModelAdapter(client=client, model="model")


# --------------------------------------------------------------------------- #
# Happy paths
# --------------------------------------------------------------------------- #


def test_string_prompt_passed_through() -> None:
    assert _make_adapter()._build_prompt("hi") == "hi"


def test_typed_message_list_converts_to_langchain_messages() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(role=MessageRole.SYSTEM, content="sys"),
        Message(role=MessageRole.USER, content="q"),
        Message(role=MessageRole.AI, content="a"),
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert isinstance(result[0], SystemMessage)
    assert isinstance(result[1], HumanMessage)
    assert isinstance(result[2], AIMessage)
    assert [m.content for m in result] == ["sys", "q", "a"]


def test_openai_format_dict_list_converts_to_langchain_messages() -> None:
    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert isinstance(result[0], SystemMessage)
    assert isinstance(result[1], HumanMessage)
    assert isinstance(result[2], AIMessage)
    assert [m.content for m in result] == ["sys", "q", "a"]


@pytest.mark.parametrize(
    "alias,expected_type",
    [
        ("ai", AIMessage),
        ("human", HumanMessage),
        ("model", AIMessage),
        ("developer", SystemMessage),
    ],
)
def test_role_aliases_normalize_on_dict_path(alias: str, expected_type: type) -> None:
    adapter = _make_adapter()
    result = adapter._build_prompt([{"role": alias, "content": "x"}])
    assert isinstance(result, list)
    assert isinstance(result[0], expected_type)


def test_content_parts_joined_with_newline_on_typed_path() -> None:
    """Typed-path join behavior is preserved for list content."""
    adapter = _make_adapter()
    prompt = [
        Message(
            role=MessageRole.USER,
            content=[
                {"type": "text", "text": "a"},
                {"type": "text", "text": "b"},
            ],
        )
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert isinstance(result[0], HumanMessage)
    assert result[0].content == "a\nb"


def test_non_text_content_parts_silently_dropped_on_typed_path() -> None:
    adapter = _make_adapter()
    prompt = [
        Message(
            role=MessageRole.USER,
            content=[
                {"type": "text", "text": "keep"},
                {"type": "image_url", "image_url": {"url": "http://x/y.png"}},
            ],
        )
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert result[0].content == "keep"


def test_fallback_path_without_langchain_community(monkeypatch: pytest.MonkeyPatch) -> None:
    """Exercise the ImportError fallback path by hiding ``langchain_community``."""
    import builtins

    real_import = builtins.__import__

    def fake_import(
        name: str,
        globals=None,
        locals=None,
        fromlist=(),
        level: int = 0,
    ):
        if name.startswith("langchain_community"):
            raise ImportError(f"mocked: {name} not available")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    adapter = _make_adapter()
    prompt = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert isinstance(result[0], SystemMessage)
    assert isinstance(result[1], HumanMessage)
    assert isinstance(result[2], AIMessage)
    assert [m.content for m in result] == ["sys", "q", "a"]


# --------------------------------------------------------------------------- #
# Failure modes
# --------------------------------------------------------------------------- #


def test_missing_role_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'role'"):
        _make_adapter()._build_prompt([{"content": "x"}])


def test_missing_content_raises() -> None:
    with pytest.raises(ValueError, match="index 0.*'content'"):
        _make_adapter()._build_prompt([{"role": "user"}])


def test_none_content_raises() -> None:
    with pytest.raises(ValueError, match="None content"):
        _make_adapter()._build_prompt([{"role": "user", "content": None}])


def test_empty_string_content_raises() -> None:
    with pytest.raises(ValueError, match="empty string content"):
        _make_adapter()._build_prompt([{"role": "user", "content": ""}])


def test_empty_list_content_raises() -> None:
    with pytest.raises(ValueError, match="empty list content"):
        _make_adapter()._build_prompt([{"role": "user", "content": []}])


def test_non_str_non_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="Expected prompt"):
        _make_adapter()._build_prompt(42)  # type: ignore[arg-type]


def test_empty_list_prompt_raises() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        _make_adapter()._build_prompt([])


def test_unknown_role_raises() -> None:
    with pytest.raises(ValueError, match="Unknown message role"):
        _make_adapter()._build_prompt([{"role": "tool", "content": "x"}])
