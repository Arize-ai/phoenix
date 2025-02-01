from typing import Any

import pytest

from phoenix.server.api.helpers.prompts.models import (
    AnthropicToolDefinition,
    OpenAIToolDefinition,
    PromptFunctionToolV1,
    _anthropic_to_prompt_tool,
    _openai_to_prompt_tool,
    _prompt_to_anthropic_tool,
    _prompt_to_openai_tool,
)


@pytest.mark.parametrize(
    "anthropic_tool_schema,expected_prompt_tool_schema",
    [
        pytest.param(
            {
                "name": "tool-name",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="minimal-tool",
        ),
        pytest.param(
            {
                "name": "tool-name",
                "description": "tool-description",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "description": "tool-description",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="tool-with-description",
        ),
        pytest.param(
            {
                "name": "tool-name",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "cache_control": {
                    "type": "ephemeral",
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {
                    "cache_control": {
                        "type": "ephemeral",
                    },
                },
            },
            id="tool-with-ephemeral-cache-control",
        ),
        pytest.param(
            {
                "name": "tool-name",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "cache_control": None,
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {
                    "cache_control": None,
                },
            },
            id="tool-with-cache-control-set-to-none",
        ),
    ],
)
def test_anthropic_tool_normalization_and_round_tripping_preserves_data(
    anthropic_tool_schema: dict[str, Any],
    expected_prompt_tool_schema: dict[str, Any],
) -> None:
    anthropic_tool = AnthropicToolDefinition.model_validate(anthropic_tool_schema)
    prompt_tool = _anthropic_to_prompt_tool(anthropic_tool)
    prompt_tool_schema = prompt_tool.model_dump()
    assert prompt_tool_schema == expected_prompt_tool_schema
    rehydrated_prompt_tool = PromptFunctionToolV1.model_validate(prompt_tool_schema)
    rehydrated_anthropic_tool = _prompt_to_anthropic_tool(rehydrated_prompt_tool)
    assert rehydrated_anthropic_tool.model_dump() == anthropic_tool_schema


@pytest.mark.parametrize(
    "openai_tool_schema,expected_prompt_tool_schema",
    [
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "tool-name",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            }
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="minimal-tool",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "tool-name",
                    "description": "tool-description",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            }
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "description": "tool-description",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="tool-with-description",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "tool-name",
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "extra_parameters": {},
            },
            id="tool-with-no-parameters",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "tool-name",
                    "strict": True,
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "extra_parameters": {"strict": True},
            },
            id="tool-with-strict-set-to-bool",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "tool-name",
                    "strict": None,
                },
            },
            {
                "type": "function-tool-v1",
                "name": "tool-name",
                "extra_parameters": {"strict": None},
            },
            id="tool-with-strict-set-to-none",
        ),
    ],
)
def test_openai_tool_normalization_and_round_tripping_preserves_data(
    openai_tool_schema: dict[str, Any],
    expected_prompt_tool_schema: dict[str, Any],
) -> None:
    openai_tool = OpenAIToolDefinition.model_validate(openai_tool_schema)
    prompt_tool = _openai_to_prompt_tool(openai_tool)
    prompt_tool_schema = prompt_tool.model_dump()
    assert prompt_tool_schema == expected_prompt_tool_schema
    rehydrated_prompt_tool = PromptFunctionToolV1.model_validate(prompt_tool_schema)
    rehydrated_openai_tool = _prompt_to_openai_tool(rehydrated_prompt_tool)
    assert rehydrated_openai_tool.model_dump() == openai_tool_schema
