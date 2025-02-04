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
    PromptMessage,
    PromptMessageRole,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
    denormalize_output_schema,
    denormalize_tools,
    normalize_output_schema,
    normalize_tools,
)
from phoenix.server.types import DbSessionFactory


async def test_chat_template_materializes_to_expected_format(
    db: DbSessionFactory,
    dialect: str,
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
            invocation_parameters={},
            tools=None,
            output_schema=None,
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
            invocation_parameters={},
            tools=normalized_tools,
            output_schema=None,
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
            invocation_parameters={},
            tools=normalized_tools,
            output_schema=None,
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
    "openai_output_schema_dict,expected_normalized_output_schema_dict",
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
                "type": "output-schema-v1",
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
                "type": "output-schema-v1",
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
                "type": "output-schema-v1",
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
                "type": "output-schema-v1",
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
async def test_openai_output_schema_are_round_tripped_without_data_loss(
    openai_output_schema_dict: dict[str, Any],
    expected_normalized_output_schema_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    # normalize output schema
    normalized_output_schema = normalize_output_schema(openai_output_schema_dict, "openai")

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
            invocation_parameters={},
            tools=None,
            output_schema=normalized_output_schema,
            model_provider="openai",
            model_name="gpt-4o",
        )
        session.add(prompt_version)

    # check the materialized tools
    async with db() as session:
        materialized_output_schema = await session.scalar(
            select(text("output_schema"))
            .select_from(PromptVersion)
            .where(PromptVersion.id == prompt_version.id)
        )
    if dialect == "sqlite":
        materialized_output_schema_dict = json.loads(materialized_output_schema)
    else:
        materialized_output_schema_dict = materialized_output_schema
    assert materialized_output_schema_dict == expected_normalized_output_schema_dict

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize output schema and check it matches the input output schema
    rehydrated_output_schema = rehydrated_prompt_version.output_schema
    assert rehydrated_output_schema is not None
    denormalized_output_schema_dict = denormalize_output_schema(rehydrated_output_schema, "openai")
    assert denormalized_output_schema_dict == openai_output_schema_dict
