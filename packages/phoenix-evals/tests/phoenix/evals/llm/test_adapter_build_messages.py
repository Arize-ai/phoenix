"""Unit tests for LLM adapter message-building methods.

Covers the `_build_messages` / `_build_content` / `_build_prompt` method
across all 5 adapters. Each adapter is tested with:

- ``str`` prompt (simple user message)
- ``List[Dict[str, Any]]`` prompt (raw OpenAI-format messages, backward compat)
- ``List[Message]`` prompt (typed Phoenix messages with ``MessageRole``)
- Invalid type → ``ValueError``

These tests were missing — see issue #12465. They guard against regressions
from the evals 1.0 deprecation (PR #12239) that removed the `MultimodalPrompt`
fallback from the message-building paths.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter
from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter
from phoenix.evals.llm.adapters.langchain.adapter import LangChainModelAdapter
from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter
from phoenix.evals.llm.prompts import Message, MessageRole

# ---------------------------------------------------------------------------
# Helpers — construct adapters without going through their client validators.
# ---------------------------------------------------------------------------


def _bare(cls: type) -> Any:
    """Create an adapter instance without running __init__ (skips client validation).

    Message-building methods are pure functions of their input plus instance
    state that we don't need here; this lets us test them without installing
    or mocking each provider's SDK.
    """
    instance = object.__new__(cls)
    instance.client = MagicMock()
    instance.model = "test-model"
    return instance


# ---------------------------------------------------------------------------
# Shared fixtures — representative prompts across the three allowed types.
# ---------------------------------------------------------------------------

STR_PROMPT = "Summarize the document in one sentence."

DICT_PROMPT: list[dict[str, Any]] = [
    {"role": "system", "content": "You are a concise summarizer."},
    {"role": "user", "content": "Summarize the document."},
]

TYPED_PROMPT: list[Message] = [
    {"role": MessageRole.SYSTEM, "content": "You are a concise summarizer."},
    {"role": MessageRole.USER, "content": "Summarize the document."},
]


# ---------------------------------------------------------------------------
# OpenAI adapter
# ---------------------------------------------------------------------------


class TestOpenAIAdapterBuildMessages:
    def test_string_prompt_wrapped_as_user_message(self) -> None:
        adapter = _bare(OpenAIAdapter)
        result = adapter._build_messages(STR_PROMPT)
        assert result == [{"role": "user", "content": STR_PROMPT}]

    def test_dict_list_passes_through(self) -> None:
        adapter = _bare(OpenAIAdapter)
        result = adapter._build_messages(DICT_PROMPT)
        assert result == DICT_PROMPT

    def test_typed_list_transformed_to_openai_format(self) -> None:
        adapter = _bare(OpenAIAdapter)
        result = adapter._build_messages(TYPED_PROMPT)
        assert isinstance(result, list)
        assert len(result) == len(TYPED_PROMPT)
        # Role values become the enum's string value after transformation
        assert result[0]["role"] == "system"
        assert result[1]["role"] == "user"

    def test_invalid_type_raises_value_error(self) -> None:
        adapter = _bare(OpenAIAdapter)
        with pytest.raises(ValueError, match="Expected prompt to be"):
            adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Anthropic adapter
# ---------------------------------------------------------------------------


class TestAnthropicAdapterBuildMessages:
    def test_string_prompt_returns_user_message_and_empty_system(self) -> None:
        adapter = _bare(AnthropicAdapter)
        messages, system = adapter._build_messages(STR_PROMPT)
        assert messages == [{"role": "user", "content": STR_PROMPT}]
        assert system == ""

    def test_dict_list_splits_system_from_messages(self) -> None:
        adapter = _bare(AnthropicAdapter)
        messages, system = adapter._build_messages(DICT_PROMPT)
        assert all(m["role"] != "system" for m in messages)
        assert "concise summarizer" in system

    def test_typed_list_splits_system_and_transforms(self) -> None:
        adapter = _bare(AnthropicAdapter)
        messages, system = adapter._build_messages(TYPED_PROMPT)
        # System messages extracted — no system role in returned messages
        assert all(m["role"] != "system" for m in messages)
        assert "concise summarizer" in system

    def test_invalid_type_raises_value_error(self) -> None:
        adapter = _bare(AnthropicAdapter)
        with pytest.raises(ValueError, match="Expected prompt to be"):
            adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Google adapter (uses _build_content, not _build_messages)
# ---------------------------------------------------------------------------


class TestGoogleAdapterBuildContent:
    def test_string_prompt_returns_string_and_empty_system(self) -> None:
        adapter = _bare(GoogleGenAIAdapter)
        content, system = adapter._build_content(STR_PROMPT)
        assert content == STR_PROMPT
        assert system == ""

    def test_dict_list_extracts_system_instruction(self) -> None:
        adapter = _bare(GoogleGenAIAdapter)
        content, system = adapter._build_content(DICT_PROMPT)
        # Content returned; system extracted
        assert isinstance(content, (str, list))
        assert "concise summarizer" in system

    def test_typed_list_extracts_system_and_transforms(self) -> None:
        adapter = _bare(GoogleGenAIAdapter)
        content, system = adapter._build_content(TYPED_PROMPT)
        assert isinstance(content, (str, list))
        assert "concise summarizer" in system

    def test_invalid_type_raises_value_error(self) -> None:
        adapter = _bare(GoogleGenAIAdapter)
        with pytest.raises(ValueError, match="Expected prompt to be"):
            adapter._build_content(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# LiteLLM adapter
# ---------------------------------------------------------------------------


class TestLiteLLMAdapterBuildMessages:
    def test_string_prompt_wrapped_as_user_message(self) -> None:
        adapter = _bare(LiteLLMAdapter)
        result = adapter._build_messages(STR_PROMPT)
        assert result == [{"role": "user", "content": STR_PROMPT}]

    def test_dict_list_passes_through(self) -> None:
        adapter = _bare(LiteLLMAdapter)
        result = adapter._build_messages(DICT_PROMPT)
        assert result == DICT_PROMPT

    def test_typed_list_transformed_to_openai_format(self) -> None:
        adapter = _bare(LiteLLMAdapter)
        result = adapter._build_messages(TYPED_PROMPT)
        assert isinstance(result, list)
        assert len(result) == len(TYPED_PROMPT)
        assert result[0]["role"] == "system"
        assert result[1]["role"] == "user"

    def test_invalid_type_raises_value_error(self) -> None:
        adapter = _bare(LiteLLMAdapter)
        with pytest.raises(ValueError, match="Expected prompt to be"):
            adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# LangChain adapter (uses _build_prompt, returns str or List[Any])
# ---------------------------------------------------------------------------


class TestLangChainAdapterBuildPrompt:
    def test_string_prompt_returns_string(self) -> None:
        adapter = _bare(LangChainModelAdapter)
        result = adapter._build_prompt(STR_PROMPT)
        assert result == STR_PROMPT

    def test_typed_list_returns_langchain_messages(self) -> None:
        # Requires langchain_core for message-object construction.
        pytest.importorskip("langchain_core")
        adapter = _bare(LangChainModelAdapter)
        result = adapter._build_prompt(TYPED_PROMPT)
        assert isinstance(result, list)
        assert len(result) == len(TYPED_PROMPT)

    def test_dict_list_converts_to_langchain_messages(self) -> None:
        # This path uses the langchain_community / fallback converter, which
        # may error if langchain_core isn't installed. Skip gracefully if so.
        pytest.importorskip("langchain_core")
        adapter = _bare(LangChainModelAdapter)
        result = adapter._build_prompt(DICT_PROMPT)
        assert isinstance(result, list)
        assert len(result) == len(DICT_PROMPT)
