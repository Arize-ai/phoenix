# type: ignore
"""Tests for ``LangChainModelAdapter._build_prompt()`` (issue #12465)."""

from unittest.mock import MagicMock

import pytest

pytest.importorskip("langchain_core")

from langchain_core.messages import (  # noqa: E402
    AIMessage,
    FunctionMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
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


def test_empty_string_prompt_is_preserved() -> None:
    assert _make_adapter()._build_prompt("") == ""


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


def test_provider_native_tool_transcript_dicts_use_langchain_converter() -> None:
    adapter = _make_adapter()
    prompt = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "lookup", "arguments": "{}"},
                }
            ],
        },
        {"role": "tool", "tool_call_id": "call_1", "content": "result"},
    ]
    result = adapter._build_prompt(prompt)
    assert isinstance(result, list)
    assert isinstance(result[0], AIMessage)
    assert isinstance(result[1], ToolMessage)
    assert result[1].tool_call_id == "call_1"


def test_provider_native_function_dict_uses_langchain_converter() -> None:
    adapter = _make_adapter()
    result = adapter._build_prompt([{"role": "function", "name": "lookup", "content": "result"}])
    assert isinstance(result, list)
    assert isinstance(result[0], FunctionMessage)
    assert result[0].name == "lookup"


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


def test_unknown_prompt_role_raises() -> None:
    with pytest.raises(ValueError, match="Unknown message role"):
        _make_adapter()._build_prompt([{"role": "narrator", "content": "x"}])


def test_mixed_typed_and_dict_list_raises() -> None:
    prompt = [
        Message(role=MessageRole.USER, content="q"),
        {"role": "assistant", "content": "a"},
    ]
    with pytest.raises(ValueError, match="mixes typed Message"):
        _make_adapter()._build_prompt(prompt)


def test_user_message_with_name_field_is_validated() -> None:
    """``name`` on user/system is a label, not a transcript marker — so the
    dict path should still validate content rather than passing through."""
    with pytest.raises(ValueError, match="empty string content"):
        _make_adapter()._build_prompt([{"role": "user", "name": "alice", "content": ""}])


def test_native_transcript_without_langchain_community_raises_clear_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If ``langchain_community`` is unavailable, native tool transcripts
    should raise a targeted ``ImportError`` pointing the user at the missing
    dependency rather than falling through to a misleading content-validation
    error."""
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
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "lookup", "arguments": "{}"},
                }
            ],
        },
        {"role": "tool", "tool_call_id": "call_1", "content": "result"},
    ]
    with pytest.raises(ImportError, match="langchain.community"):
        adapter._build_prompt(prompt)
