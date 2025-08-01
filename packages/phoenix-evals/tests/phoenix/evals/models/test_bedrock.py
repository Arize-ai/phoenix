import asyncio
import json

import boto3
import pytest
from mypy_boto3_bedrock_runtime.type_defs import ConverseResponseTypeDef

from phoenix.evals import BedrockModel


def test_instantiation_by_positional_args_is_not_allowed():
    session = boto3.Session(region_name="us-west-2")
    with pytest.raises(AssertionError, match="positional arguments"):
        BedrockModel(session)


def test_bedrock_model_can_be_instantiated():
    session = boto3.Session(region_name="us-west-2")
    model = BedrockModel(session=session)
    assert model


def test_bedrock_async_propagates_errors():
    with pytest.raises(AttributeError, match="'NoneType' object has no attribute 'converse'"):
        session = boto3.Session(region_name="us-west-2")
        client = session.client("bedrock-runtime")
        model = BedrockModel(session=session, client=client)
        model.client = None
        asyncio.run(model._async_generate("prompt"))


class TestParseOutput:
    """Test cases for BedrockModel()._parse_output method."""

    @pytest.fixture
    def model(self) -> BedrockModel:
        """Fixture to create a BedrockModel with mocked dependencies."""

        # Create a mock client to avoid AWS authentication issues
        class MockClient:
            class exceptions:
                class ThrottlingException(Exception):
                    pass

        model = BedrockModel.__new__(BedrockModel)  # Create instance without calling __init__
        model.client = MockClient()
        return model

    def test_parse_simple_text_response(self, model: BedrockModel) -> None:
        """Test parsing a simple text response."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [{"text": "Hello, this is a simple response."}],
                }
            },
            "usage": {"inputTokens": 10, "outputTokens": 8, "totalTokens": 18},
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == "Hello, this is a simple response."
        assert usage is not None
        assert usage.prompt_tokens == 10
        assert usage.completion_tokens == 8
        assert usage.total_tokens == 18

    def test_parse_multiple_text_blocks(self, model: BedrockModel) -> None:
        """Test parsing response with multiple text blocks."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {"text": "First part of response."},
                        {"text": "Second part of response."},
                        {"text": "Third part of response."},
                    ],
                }
            },
            "usage": {"inputTokens": 15, "outputTokens": 12, "totalTokens": 27},
        }

        text, (usage, *_) = model._parse_output(response)

        expected_text = (
            "First part of response.\n\nSecond part of response.\n\nThird part of response."
        )
        assert text == expected_text
        assert usage is not None
        assert usage.prompt_tokens == 15
        assert usage.completion_tokens == 12
        assert usage.total_tokens == 27

    def test_parse_tool_use_response(self, model: BedrockModel) -> None:
        """Test parsing response with tool use."""
        tool_input = {"query": "What is the weather today?", "location": "San Francisco"}
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {
                            "toolUse": {
                                "toolUseId": "tool_123",
                                "name": "get_weather",
                                "input": tool_input,
                            }
                        }
                    ],
                }
            },
            "usage": {"inputTokens": 20, "outputTokens": 15, "totalTokens": 35},
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == json.dumps(tool_input)
        assert usage is not None
        assert usage.prompt_tokens == 20
        assert usage.completion_tokens == 15
        assert usage.total_tokens == 35

    def test_parse_mixed_content_with_tool_use_priority(self, model: BedrockModel) -> None:
        """Test that tool use takes priority over text when both are present."""
        tool_input = {"action": "search", "query": "test"}
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {"text": "I'll search for that."},
                        {
                            "toolUse": {
                                "toolUseId": "tool_456",
                                "name": "search",
                                "input": tool_input,
                            }
                        },
                        {"text": "Search completed."},
                    ],
                }
            }
        }

        text, (usage, *_) = model._parse_output(response)

        # Tool use should take priority and return first
        assert text == json.dumps(tool_input)
        assert usage is None  # No usage in this response

    def test_parse_output_without_usage(self, model: BedrockModel) -> None:
        """Test parsing response without usage information."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [{"text": "Response without usage data."}],
                }
            }
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == "Response without usage data."
        assert usage is None

    def test_parse_response_with_partial_usage(self, model: BedrockModel) -> None:
        """Test parsing response with partial usage data."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [{"text": "Response with partial usage."}],
                }
            },
            "usage": {
                "inputTokens": 5,
                "outputTokens": 7,
                # totalTokens missing
            },
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == "Response with partial usage."
        assert usage is not None
        assert usage.prompt_tokens == 5
        assert usage.completion_tokens == 7
        assert usage.total_tokens == 0  # Default value when missing

    def test_parse_empty_response(self, model: BedrockModel) -> None:
        """Test parsing completely empty response."""
        response: ConverseResponseTypeDef = {}

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is None

    def test_parse_response_missing_output(self, model: BedrockModel) -> None:
        """Test parsing response without output field."""
        response: ConverseResponseTypeDef = {
            "usage": {"inputTokens": 3, "outputTokens": 5, "totalTokens": 8}
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is not None
        assert usage.prompt_tokens == 3
        assert usage.completion_tokens == 5
        assert usage.total_tokens == 8

    def test_parse_response_missing_message(self, model: BedrockModel) -> None:
        """Test parsing response without message field."""
        response: ConverseResponseTypeDef = {
            "output": {},
            "usage": {"inputTokens": 2, "outputTokens": 3, "totalTokens": 5},
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is not None
        assert usage.prompt_tokens == 2
        assert usage.completion_tokens == 3
        assert usage.total_tokens == 5

    def test_parse_response_missing_content(self, model: BedrockModel) -> None:
        """Test parsing response without content field."""
        response: ConverseResponseTypeDef = {"output": {"message": {"role": "assistant"}}}

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is None

    def test_parse_response_empty_content_list(self, model: BedrockModel) -> None:
        """Test parsing response with empty content list."""
        response: ConverseResponseTypeDef = {
            "output": {"message": {"role": "assistant", "content": []}}
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is None

    def test_parse_response_non_text_content_blocks(self, model: BedrockModel) -> None:
        """Test parsing response with non-text content blocks."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {"image": {"format": "png", "source": {"bytes": b"fake_image_data"}}},
                        {"document": {"format": "pdf", "name": "test.pdf"}},
                    ],
                }
            }
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is None

    def test_parse_tool_use_without_input(self, model: BedrockModel) -> None:
        """Test parsing tool use block without input field."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {
                            "toolUse": {
                                "toolUseId": "tool_789",
                                "name": "no_input_tool",
                                # input field missing
                            }
                        },
                        {"text": "Fallback text"},
                    ],
                }
            }
        }

        text, (usage, *_) = model._parse_output(response)

        # Should fall through to text since tool use has no input
        assert text == "Fallback text"
        assert usage is None

    def test_parse_tool_use_with_empty_input(self, model: BedrockModel) -> None:
        """Test parsing tool use block with empty input."""
        response: ConverseResponseTypeDef = {
            "output": {
                "message": {
                    "role": "assistant",
                    "content": [
                        {"toolUse": {"toolUseId": "tool_empty", "name": "empty_tool", "input": {}}}
                    ],
                }
            }
        }

        text, (usage, *_) = model._parse_output(response)

        assert text == ""
        assert usage is None
