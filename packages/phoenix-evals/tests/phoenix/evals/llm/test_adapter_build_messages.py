"""Unit tests for LLM adapter _build_messages / _build_content / _build_prompt methods.

Each adapter is tested with:
- str prompt
- List[Dict] (raw OpenAI-format messages)
- List[Message] (typed message objects with MessageRole enum)
- Invalid type raises ValueError

Resolves https://github.com/Arize-ai/phoenix/issues/12465
"""

from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.prompts import Message, MessageRole


# ---------------------------------------------------------------------------
# Fixtures: adapter instances with mocked clients
# ---------------------------------------------------------------------------


@pytest.fixture
def openai_adapter():
    from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter

    mock_client = MagicMock()
    mock_client.__module__ = "openai"
    return OpenAIAdapter(client=mock_client, model="gpt-4o")


@pytest.fixture
def anthropic_adapter():
    from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter

    mock_client = MagicMock()
    mock_client.__module__ = "anthropic"
    return AnthropicAdapter(client=mock_client, model="claude-3-5-sonnet-20241022")


@pytest.fixture
def google_adapter():
    from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter

    mock_client = MagicMock()
    mock_client.__module__ = "google.generativeai"
    return GoogleGenAIAdapter(client=mock_client, model="gemini-1.5-flash")


@pytest.fixture
def litellm_adapter():
    from unittest.mock import patch

    from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
    from phoenix.evals.llm.adapters.litellm.client import LiteLLMClient

    client = LiteLLMClient(provider="openai", model="gpt-4o")
    with patch.object(LiteLLMAdapter, "_import_litellm"):
        return LiteLLMAdapter(client=client, model="gpt-4o")


@pytest.fixture
def langchain_adapter():
    from phoenix.evals.llm.adapters.langchain.adapter import LangChainModelAdapter

    mock_client = MagicMock()
    return LangChainModelAdapter(client=mock_client, model="gpt-4o")


# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------


def _str_prompt() -> str:
    return "What is the capital of France?"


def _list_dict_messages() -> List[Dict[str, Any]]:
    return [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"},
    ]


def _list_typed_messages() -> List[Message]:
    return [
        Message(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        Message(role=MessageRole.USER, content="What is the capital of France?"),
    ]


def _list_typed_messages_no_system() -> List[Message]:
    return [
        Message(role=MessageRole.USER, content="Hello"),
        Message(role=MessageRole.AI, content="Hi there"),
    ]


# ---------------------------------------------------------------------------
# OpenAIAdapter._build_messages
# ---------------------------------------------------------------------------


class TestOpenAIBuildMessages:
    def test_str_prompt(self, openai_adapter) -> None:
        result = openai_adapter._build_messages(_str_prompt())
        assert result == [{"role": "user", "content": "What is the capital of France?"}]

    def test_list_dict_messages(self, openai_adapter) -> None:
        msgs = _list_dict_messages()
        result = openai_adapter._build_messages(msgs)
        assert result == msgs

    def test_list_typed_messages(self, openai_adapter) -> None:
        result = openai_adapter._build_messages(_list_typed_messages())
        assert len(result) == 2
        assert result[0]["role"] == "system"
        assert result[0]["content"] == "You are a helpful assistant."
        assert result[1]["role"] == "user"
        assert result[1]["content"] == "What is the capital of France?"

    def test_list_typed_messages_ai_role(self, openai_adapter) -> None:
        result = openai_adapter._build_messages(_list_typed_messages_no_system())
        assert result[0]["role"] == "user"
        assert result[1]["role"] == "assistant"

    def test_invalid_type_raises(self, openai_adapter) -> None:
        with pytest.raises(ValueError, match="Expected prompt to be"):
            openai_adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# AnthropicAdapter._build_messages
# ---------------------------------------------------------------------------


class TestAnthropicBuildMessages:
    def test_str_prompt(self, anthropic_adapter) -> None:
        messages, system = anthropic_adapter._build_messages(_str_prompt())
        assert messages == [{"role": "user", "content": "What is the capital of France?"}]
        assert system == ""

    def test_list_dict_messages_extracts_system(self, anthropic_adapter) -> None:
        messages, system = anthropic_adapter._build_messages(_list_dict_messages())
        # System messages are extracted separately
        assert system == "You are a helpful assistant."
        # Non-system messages remain
        assert len(messages) == 1
        assert messages[0]["role"] == "user"

    def test_list_typed_messages_extracts_system(self, anthropic_adapter) -> None:
        messages, system = anthropic_adapter._build_messages(_list_typed_messages())
        assert system == "You are a helpful assistant."
        assert len(messages) == 1
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "What is the capital of France?"

    def test_list_typed_messages_ai_role(self, anthropic_adapter) -> None:
        messages, system = anthropic_adapter._build_messages(_list_typed_messages_no_system())
        assert system == ""
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"

    def test_invalid_type_raises(self, anthropic_adapter) -> None:
        with pytest.raises(ValueError, match="Expected prompt to be"):
            anthropic_adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# GoogleGenAIAdapter._build_content
# ---------------------------------------------------------------------------


class TestGoogleBuildContent:
    def test_str_prompt(self, google_adapter) -> None:
        content, system_instruction = google_adapter._build_content(_str_prompt())
        assert content == "What is the capital of France?"
        assert system_instruction == ""

    def test_list_dict_messages_extracts_system(self, google_adapter) -> None:
        content, system_instruction = google_adapter._build_content(_list_dict_messages())
        assert system_instruction == "You are a helpful assistant."
        # Non-system messages converted to Google format
        assert isinstance(content, list)
        assert len(content) == 1
        assert content[0]["role"] == "user"

    def test_list_typed_messages_extracts_system(self, google_adapter) -> None:
        content, system_instruction = google_adapter._build_content(_list_typed_messages())
        assert system_instruction == "You are a helpful assistant."
        assert isinstance(content, list)
        assert len(content) == 1
        assert content[0]["role"] == "user"
        assert content[0]["parts"] == [{"text": "What is the capital of France?"}]

    def test_list_typed_messages_model_role(self, google_adapter) -> None:
        content, system_instruction = google_adapter._build_content(
            _list_typed_messages_no_system()
        )
        assert system_instruction == ""
        assert len(content) == 2
        assert content[0]["role"] == "user"
        # Google uses "model" instead of "assistant"
        assert content[1]["role"] == "model"

    def test_invalid_type_raises(self, google_adapter) -> None:
        with pytest.raises(ValueError, match="Expected prompt to be"):
            google_adapter._build_content(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# LiteLLMAdapter._build_messages
# ---------------------------------------------------------------------------


class TestLiteLLMBuildMessages:
    def test_str_prompt(self, litellm_adapter) -> None:
        result = litellm_adapter._build_messages(_str_prompt())
        assert result == [{"role": "user", "content": "What is the capital of France?"}]

    def test_list_dict_messages(self, litellm_adapter) -> None:
        msgs = _list_dict_messages()
        result = litellm_adapter._build_messages(msgs)
        assert result == msgs

    def test_list_typed_messages(self, litellm_adapter) -> None:
        result = litellm_adapter._build_messages(_list_typed_messages())
        assert len(result) == 2
        assert result[0]["role"] == "system"
        assert result[0]["content"] == "You are a helpful assistant."
        assert result[1]["role"] == "user"
        assert result[1]["content"] == "What is the capital of France?"

    def test_list_typed_messages_ai_role(self, litellm_adapter) -> None:
        result = litellm_adapter._build_messages(_list_typed_messages_no_system())
        assert result[0]["role"] == "user"
        assert result[1]["role"] == "assistant"

    def test_invalid_type_raises(self, litellm_adapter) -> None:
        with pytest.raises(ValueError, match="Expected prompt to be"):
            litellm_adapter._build_messages(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# LangChainModelAdapter._build_prompt
# ---------------------------------------------------------------------------


class TestLangChainBuildPrompt:
    def test_str_prompt(self, langchain_adapter) -> None:
        result = langchain_adapter._build_prompt(_str_prompt())
        assert result == "What is the capital of France?"

    def test_list_dict_messages(self, langchain_adapter) -> None:
        result = langchain_adapter._build_prompt(_list_dict_messages())
        # Returns LangChain message objects
        assert isinstance(result, list)
        assert len(result) == 2

    def test_list_typed_messages(self, langchain_adapter) -> None:
        result = langchain_adapter._build_prompt(_list_typed_messages())
        assert isinstance(result, list)
        assert len(result) == 2

    def test_invalid_type_raises(self, langchain_adapter) -> None:
        with pytest.raises(ValueError, match="Expected prompt to be"):
            langchain_adapter._build_prompt(42)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Content-part handling: List[Message] with List[ContentPart] content
# ---------------------------------------------------------------------------


class TestContentPartHandling:
    """Test that adapters correctly handle messages with structured content parts."""

    @staticmethod
    def _typed_messages_with_content_parts() -> List[Message]:
        return [
            Message(
                role=MessageRole.USER,
                content=[
                    {"type": "text", "text": "First part"},
                    {"type": "text", "text": "Second part"},
                ],
            ),
        ]

    def test_openai_content_parts(self, openai_adapter) -> None:
        result = openai_adapter._build_messages(self._typed_messages_with_content_parts())
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "First part\nSecond part"

    def test_anthropic_content_parts(self, anthropic_adapter) -> None:
        messages, system = anthropic_adapter._build_messages(
            self._typed_messages_with_content_parts()
        )
        assert len(messages) == 1
        assert messages[0]["role"] == "user"
        assert system == ""

    def test_google_content_parts(self, google_adapter) -> None:
        content, system_instruction = google_adapter._build_content(
            self._typed_messages_with_content_parts()
        )
        assert isinstance(content, list)
        assert len(content) == 1
        assert content[0]["role"] == "user"
        assert system_instruction == ""

    def test_litellm_content_parts(self, litellm_adapter) -> None:
        result = litellm_adapter._build_messages(self._typed_messages_with_content_parts())
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "First part\nSecond part"
