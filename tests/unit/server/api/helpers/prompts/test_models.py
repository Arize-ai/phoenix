import json
from typing import Any

import pytest
from sqlalchemy import select, text

from phoenix.db.models import Prompt, PromptVersion
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.helpers.prompts.models import (
    ImageContentPart,
    ImageContentValue,
    PromptChatTemplateV1,
    PromptInvocationParameters,
    PromptInvocationParams,
    PromptMessage,
    PromptMessageRole,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
    denormalize_invocation_parameters,
    denormalize_response_format,
    denormalize_tools,
    normalize_invocation_parameters,
    normalize_response_format,
    normalize_tools,
)
from phoenix.server.types import DbSessionFactory


@pytest.fixture
def empty_invocation_parameters() -> PromptInvocationParameters:
    return PromptInvocationParameters(
        type="invocation-parameters", parameters=PromptInvocationParams(extra_parameters={})
    )


async def test_chat_template_materializes_to_expected_format(
    db: DbSessionFactory,
    dialect: str,
    empty_invocation_parameters: PromptInvocationParameters,
) -> None:
    # create a template
    template = PromptChatTemplateV1(
        version="chat-template-v1",
        messages=[
            PromptMessage(
                role=PromptMessageRole.USER,
                content=[
                    TextContentPart(
                        type="text",
                        text=TextContentValue(text="foo"),
                    ),
                    ImageContentPart(
                        type="image",
                        image=ImageContentValue(url="url"),
                    ),
                    ToolCallContentPart(
                        type="tool_call",
                        tool_call=ToolCallContentValue(
                            tool_call_id="1234",
                            tool_call=ToolCallFunction(
                                type="function",
                                name="tool-name",
                                arguments="{}",
                            ),
                        ),
                    ),
                    ToolResultContentPart(
                        type="tool_result",
                        tool_result=ToolResultContentValue(
                            tool_call_id="1234",
                            result={"foo": "bar"},
                        ),
                    ),
                ],
            )
        ],
    )

    # persist to db
    async with db() as session:
        prompt = Prompt(
            name=Identifier("prompt-name"),
            description=None,
            metadata_={},
        )
        prompt_version = PromptVersion(
            prompt=prompt,
            description=None,
            user_id=None,
            template_type="CHAT",
            template_format="MUSTACHE",
            template=template,
            invocation_parameters=empty_invocation_parameters,
            tools=None,
            response_format=None,
            model_provider="anthropic",
            model_name="claude-3-5-sonnet",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_template = await session.scalar(
            select(text("template"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_template_dict = json.loads(materialized_template)
    else:
        materialized_template_dict = materialized_template
    assert materialized_template_dict == {
        "version": "chat-template-v1",
        "messages": [
            {
                "role": "USER",
                "content": [
                    {
                        "type": "text",
                        "text": {
                            "text": "foo",
                        },
                    },
                    {
                        "type": "image",
                        "image": {
                            "url": "url",
                        },
                    },
                    {
                        "type": "tool_call",
                        "tool_call": {
                            "tool_call_id": "1234",
                            "tool_call": {
                                "type": "function",
                                "name": "tool-name",
                                "arguments": "{}",
                            },
                        },
                    },
                    {
                        "type": "tool_result",
                        "tool_result": {
                            "tool_call_id": "1234",
                            "result": {
                                "foo": "bar",
                            },
                        },
                    },
                ],
            }
        ],
    }

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize template and check it matches the input template
    rehydrated_template = rehydrated_prompt_version.template
    assert rehydrated_template is not None
    assert rehydrated_template.model_dump() == template.model_dump()


@pytest.mark.parametrize(
    "anthropic_tool_dict,expected_normalized_tool_dict",
    [
        pytest.param(
            {
                "name": "get_weather",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            },
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="minimal-tool",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "description": "Gets the current weather for a given city",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "description": "Gets the current weather for a given city",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            },
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="tool-with-description",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "city": {
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
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            },
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
                "name": "get_weather",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                        },
                    },
                },
                "cache_control": None,
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            },
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
async def test_anthropic_tool_are_round_tripped_without_data_loss(
    anthropic_tool_dict: dict[str, Any],
    expected_normalized_tool_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
    empty_invocation_parameters: PromptInvocationParameters,
) -> None:
    # normalize tools
    normalized_tools = normalize_tools([anthropic_tool_dict], "anthropic")

    # persist to db
    async with db() as session:
        prompt = Prompt(
            name=Identifier("prompt-name"),
            description=None,
            metadata_={},
        )
        prompt_version = PromptVersion(
            prompt=prompt,
            description=None,
            user_id=None,
            template_type="CHAT",
            template_format="MUSTACHE",
            template=PromptChatTemplateV1(
                version="chat-template-v1",
                messages=[],
            ),
            invocation_parameters=empty_invocation_parameters,
            tools=normalized_tools,
            response_format=None,
            model_provider="anthropic",
            model_name="claude-3-5-sonnet",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_tools = await session.scalar(
            select(text("tools"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_tool_dict = json.loads(materialized_tools)
    else:
        materialized_tool_dict = materialized_tools
    assert materialized_tool_dict == {
        "type": "tools-v1",
        "tools": [
            expected_normalized_tool_dict,
        ],
    }

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize tools and check they match the input tools
    rehydrated_tools = rehydrated_prompt_version.tools
    assert rehydrated_tools is not None
    denormalized_tool_dicts = denormalize_tools(rehydrated_tools, "anthropic")
    assert len(denormalized_tool_dicts) == 1
    assert denormalized_tool_dicts[0] == anthropic_tool_dict


@pytest.mark.parametrize(
    "openai_tool_dict,expected_normalized_tool_dict",
    [
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
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
                    "name": "get_weather",
                    "description": "Gets current weather for a given city",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                    },
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "description": "Gets current weather for a given city",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
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
                    "name": "escalate_to_human_customer_support",
                },
            },
            {
                "type": "function-tool-v1",
                "name": "escalate_to_human_customer_support",
                "extra_parameters": {},
            },
            id="tool-with-no-parameters",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                    "strict": True,
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                },
                "extra_parameters": {
                    "strict": True,
                },
            },
            id="tool-with-strict-set-to-bool",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                    "strict": None,
                },
            },
            {
                "type": "function-tool-v1",
                "name": "get_weather",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                            }
                        },
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                },
                "extra_parameters": {
                    "strict": None,
                },
            },
            id="tool-with-strict-set-to-none",
        ),
    ],
)
async def test_openai_tool_are_round_tripped_without_data_loss(
    openai_tool_dict: dict[str, Any],
    expected_normalized_tool_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
    empty_invocation_parameters: PromptInvocationParameters,
) -> None:
    # normalize tools
    normalized_tools = normalize_tools([openai_tool_dict], "openai")

    # persist to db
    async with db() as session:
        prompt = Prompt(
            name=Identifier("prompt-name"),
            description=None,
            metadata_={},
        )
        prompt_version = PromptVersion(
            prompt=prompt,
            description=None,
            user_id=None,
            template_type="CHAT",
            template_format="MUSTACHE",
            template=PromptChatTemplateV1(
                version="chat-template-v1",
                messages=[],
            ),
            invocation_parameters=empty_invocation_parameters,
            tools=normalized_tools,
            response_format=None,
            model_provider="openai",
            model_name="gpt-4o",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_tools = await session.scalar(
            select(text("tools"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_tool_dict = json.loads(materialized_tools)
    else:
        materialized_tool_dict = materialized_tools
    assert materialized_tool_dict == {
        "type": "tools-v1",
        "tools": [
            expected_normalized_tool_dict,
        ],
    }

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize tools and check they match the input tools
    rehydrated_tools = rehydrated_prompt_version.tools
    assert rehydrated_tools is not None
    denormalized_tool_dicts = denormalize_tools(rehydrated_tools, "openai")
    assert len(denormalized_tool_dicts) == 1
    assert denormalized_tool_dicts[0] == openai_tool_dict


@pytest.mark.parametrize(
    "openai_response_format_dict,expected_normalized_response_format_dict",
    [
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "classify_user_intent",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                    },
                },
            },
            {
                "type": "response-format-json-schema-v1",
                "name": "classify_user_intent",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                    },
                },
                "extra_parameters": {},
            },
            id="minimal-output-schema",
        ),
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "classify_user_intent",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                        "required": [
                            "user_intent",
                        ],
                        "additionalProperties": False,
                    },
                    "strict": True,
                },
            },
            {
                "type": "response-format-json-schema-v1",
                "name": "classify_user_intent",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            },
                        },
                        "required": [
                            "user_intent",
                        ],
                        "additionalProperties": False,
                    },
                },
                "extra_parameters": {
                    "strict": True,
                },
            },
            id="with-strict-set-to-bool",
        ),
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "classify_user_intent",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                        "required": [
                            "user_intent",
                        ],
                        "additionalProperties": False,
                    },
                    "strict": None,
                },
            },
            {
                "type": "response-format-json-schema-v1",
                "name": "classify_user_intent",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            },
                        },
                        "required": [
                            "user_intent",
                        ],
                        "additionalProperties": False,
                    },
                },
                "extra_parameters": {
                    "strict": None,
                },
            },
            id="with-strict-set-to-none",
        ),
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "classify_user_intent",
                    "description": "Classifies the user's intent into one of several categories",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                        "required": ["user_intent"],
                        "additionalProperties": False,
                    },
                    "strict": True,
                },
            },
            {
                "type": "response-format-json-schema-v1",
                "name": "classify_user_intent",
                "description": "Classifies the user's intent into one of several categories",
                "schema": {
                    "type": "json-schema-draft-7-object-schema",
                    "json": {
                        "type": "object",
                        "properties": {
                            "user_intent": {
                                "type": "string",
                                "enum": [
                                    "complaint",
                                    "query",
                                    "other",
                                ],
                            }
                        },
                        "required": ["user_intent"],
                        "additionalProperties": False,
                    },
                },
                "extra_parameters": {
                    "strict": True,
                },
            },
            id="with-description",
        ),
    ],
)
async def test_openai_response_format_are_round_tripped_without_data_loss(
    openai_response_format_dict: dict[str, Any],
    expected_normalized_response_format_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    # normalize output schema
    normalized_response_format = normalize_response_format(openai_response_format_dict, "openai")

    # persist to db
    async with db() as session:
        prompt = Prompt(
            name=Identifier("prompt-name"),
            description=None,
            metadata_={},
        )
        prompt_version = PromptVersion(
            prompt=prompt,
            description=None,
            user_id=None,
            template_type="CHAT",
            template_format="MUSTACHE",
            template=PromptChatTemplateV1(
                version="chat-template-v1",
                messages=[],
            ),
            invocation_parameters=PromptInvocationParameters(
                type="invocation-parameters", parameters=PromptInvocationParams(extra_parameters={})
            ),
            tools=None,
            response_format=normalized_response_format,
            model_provider="openai",
            model_name="gpt-4o",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_response_format = await session.scalar(
            select(text("response_format"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_response_format_dict = json.loads(materialized_response_format)
    else:
        materialized_response_format_dict = materialized_response_format
    assert materialized_response_format_dict == expected_normalized_response_format_dict

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize output schema and check it matches the input output schema
    rehydrated_response_format = rehydrated_prompt_version.response_format
    assert rehydrated_response_format is not None
    denormalized_response_format_dict = denormalize_response_format(
        rehydrated_response_format, "openai"
    )
    assert denormalized_response_format_dict == openai_response_format_dict


@pytest.mark.parametrize(
    "input_invocation_parameters_dict,expected_normalized_invocation_parameters_dict,model_provider",
    [
        pytest.param(
            {
                "temperature": 0.73,
                "max_tokens": 256,
                "frequency_penalty": 0.12,
                "presence_penalty": 0.25,
                "top_p": 0.92,
                "seed": 42,
                "reasoning_effort": "high",
            },
            {
                "type": "invocation-parameters",
                "parameters": {
                    "temperature": 0.73,
                    "max_completion_tokens": 256,
                    "frequency_penalty": 0.12,
                    "presence_penalty": 0.25,
                    "top_p": 0.92,
                    "random_seed": 42,
                    "extra_parameters": {
                        "reasoning_effort": "high",
                    },
                },
            },
            "openai",
            id="openai-parameters",
        ),
        pytest.param(
            {
                "max_tokens": 256,
                "temperature": 0.73,
                "stop_sequences": ["<|endoftext|>"],
                "top_p": 0.92,
            },
            {
                "type": "invocation-parameters",
                "parameters": {
                    "max_completion_tokens": 256,
                    "temperature": 0.73,
                    "stop_sequences": ["<|endoftext|>"],
                    "top_p": 0.92,
                    "extra_parameters": {},
                },
            },
            "anthropic",
            id="anthropic-parameters",
        ),
    ],
)
async def test_invocation_parameters_are_round_tripped_without_data_loss(
    input_invocation_parameters_dict: dict[str, Any],
    expected_normalized_invocation_parameters_dict: dict[str, Any],
    model_provider: str,
    db: DbSessionFactory,
    dialect: str,
) -> None:
    # normalize invocation parameters
    normalized_invocation_parameters = normalize_invocation_parameters(
        input_invocation_parameters_dict, model_provider
    )

    # persist to db
    async with db() as session:
        prompt = Prompt(
            name=Identifier("prompt-name"),
            description=None,
            metadata_={},
        )
        prompt_version = PromptVersion(
            prompt=prompt,
            description=None,
            user_id=None,
            template_type="CHAT",
            template_format="MUSTACHE",
            template=PromptChatTemplateV1(
                version="chat-template-v1",
                messages=[],
            ),
            invocation_parameters=normalized_invocation_parameters,
            tools=None,
            response_format=None,
            model_provider="openai",
            model_name="gpt-4o",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_invocation_parameters = await session.scalar(
            select(text("invocation_parameters"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_invocation_parameters_dict = json.loads(materialized_invocation_parameters)
    else:
        materialized_invocation_parameters_dict = materialized_invocation_parameters
    assert materialized_invocation_parameters_dict == expected_normalized_invocation_parameters_dict

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize invocation parameters and check it matches the input invocation parameters
    rehydrated_invocation_parameters = rehydrated_prompt_version.invocation_parameters
    assert rehydrated_invocation_parameters is not None
    denormalized_invocation_parameters_dict = denormalize_invocation_parameters(
        rehydrated_invocation_parameters, model_provider
    )
    assert denormalized_invocation_parameters_dict == input_invocation_parameters_dict
