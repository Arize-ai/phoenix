import json
from typing import Any

import pytest
from sqlalchemy import select, text

from phoenix.db.models import Prompt, PromptVersion
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptAnthropicInvocationParameters,
    PromptAnthropicInvocationParametersContent,
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
    denormalize_response_format,
    denormalize_tools,
    get_raw_invocation_parameters,
    normalize_response_format,
    normalize_tools,
    validate_invocation_parameters,
)
from phoenix.server.types import DbSessionFactory


async def test_chat_template_materializes_to_expected_format(
    db: DbSessionFactory,
    dialect: str,
) -> None:
    # create a template
    template = PromptChatTemplate(
        type="chat",
        messages=[
            PromptMessage(
                role="user",
                content=[
                    TextContentPart(
                        type="text",
                        text="foo",
                    ),
                    ToolCallContentPart(
                        type="tool_call",
                        tool_call_id="1234",
                        tool_call=ToolCallFunction(
                            type="function",
                            name="tool-name",
                            arguments="{}",
                        ),
                    ),
                    ToolResultContentPart(
                        type="tool_result",
                        tool_call_id="1234",
                        tool_result={"foo": "bar"},
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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=template,
            invocation_parameters=PromptAnthropicInvocationParameters(
                type="anthropic",
                anthropic=PromptAnthropicInvocationParametersContent(
                    max_tokens=1024,
                ),
            ),
            tools=None,
            response_format=None,
            model_provider=ModelProvider.ANTHROPIC,
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
        "type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "foo",
                    },
                    {
                        "type": "tool_call",
                        "tool_call_id": "1234",
                        "tool_call": {
                            "type": "function",
                            "name": "tool-name",
                            "arguments": "{}",
                        },
                    },
                    {
                        "type": "tool_result",
                        "tool_call_id": "1234",
                        "tool_result": {
                            "foo": "bar",
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
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Gets the current weather for a given city",
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
            id="tool-with-description",
        ),
    ],
)
async def test_anthropic_tool_are_round_tripped_without_data_loss(
    anthropic_tool_dict: dict[str, Any],
    expected_normalized_tool_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    model_provider = ModelProvider.ANTHROPIC
    # normalize tools
    normalized_tools = normalize_tools([anthropic_tool_dict], model_provider)

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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=PromptAnthropicInvocationParameters(
                type="anthropic",
                anthropic=PromptAnthropicInvocationParametersContent(
                    max_tokens=1024,
                ),
            ),
            tools=normalized_tools,
            response_format=None,
            model_provider=model_provider,
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
        "type": "tools",
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
    denormalized_tool_dicts, _ = denormalize_tools(rehydrated_tools, model_provider)
    assert len(denormalized_tool_dicts) == 1
    assert denormalized_tool_dicts[0] == anthropic_tool_dict


@pytest.mark.parametrize(
    "openai_tool_dict",
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
            id="tool-with-description",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "escalate_to_human_customer_support",
                },
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
                    "strict": False,
                },
            },
            id="tool-with-strict-set-to-false",
        ),
    ],
)
async def test_openai_tool_are_round_tripped_without_data_loss(
    openai_tool_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    expected_normalized_tool_dict = openai_tool_dict
    model_provider = ModelProvider.OPENAI
    # normalize tools
    normalized_tools = normalize_tools([openai_tool_dict], model_provider)

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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai",
                openai=PromptOpenAIInvocationParametersContent(),
            ),
            tools=normalized_tools,
            response_format=None,
            model_provider=model_provider,
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
        "type": "tools",
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
    denormalized_tool_dicts, _ = denormalize_tools(rehydrated_tools, model_provider)
    assert len(denormalized_tool_dicts) == 1
    assert denormalized_tool_dicts[0] == openai_tool_dict


@pytest.mark.parametrize(
    (
        "google_tool_dict",
        "expected_normalized_tool_dict",
    ),
    (
        pytest.param(
            {
                "name": "get_weather",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                        },
                    },
                },
            },
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
            id="minimal-tool",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "description": "Gets the current weather for a given city",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                        },
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Gets the current weather for a given city",
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
            id="tool-with-description",
        ),
    ),
)
async def test_google_tools_are_round_tripped_without_data_loss(
    google_tool_dict: dict[str, Any],
    expected_normalized_tool_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    model_provider = ModelProvider.GOOGLE
    normalized_tools = normalize_tools([google_tool_dict], model_provider)

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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=validate_invocation_parameters(
                {"max_output_tokens": 1024}, model_provider
            ),
            tools=normalized_tools,
            response_format=None,
            model_provider=model_provider,
            model_name="gemini-2.0-flash",
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
        "type": "tools",
        "tools": [expected_normalized_tool_dict],
    }

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize tools and check they match the input tools
    rehydrated_tools = rehydrated_prompt_version.tools
    assert rehydrated_tools is not None
    denormalized_tool_dicts, _ = denormalize_tools(rehydrated_tools, model_provider)
    assert len(denormalized_tool_dicts) == 1
    assert denormalized_tool_dicts[0] == google_tool_dict


@pytest.mark.parametrize(
    (
        "google_tool_choice",
        "expected_denormalized_tool_choice",
    ),
    (
        pytest.param(
            {"function_calling_config": {"mode": "auto"}},
            {"function_calling_config": {"mode": "auto"}},
            id="mode-auto-lowercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "any"}},
            {"function_calling_config": {"mode": "any"}},
            id="mode-any-lowercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "none"}},
            {"function_calling_config": {"mode": "none"}},
            id="mode-none-lowercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "AUTO"}},
            {"function_calling_config": {"mode": "auto"}},
            id="mode-AUTO-uppercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "ANY"}},
            {"function_calling_config": {"mode": "any"}},
            id="mode-ANY-uppercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "NONE"}},
            {"function_calling_config": {"mode": "none"}},
            id="mode-NONE-uppercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "any", "allowed_function_names": ["get_weather"]}},
            {"function_calling_config": {"mode": "any", "allowed_function_names": ["get_weather"]}},
            id="specific-function-name-lowercase",
        ),
        pytest.param(
            {"function_calling_config": {"mode": "ANY", "allowed_function_names": ["get_weather"]}},
            {"function_calling_config": {"mode": "any", "allowed_function_names": ["get_weather"]}},
            id="specific-function-name-uppercase",
        ),
    ),
)
async def test_google_tool_choice_is_round_tripped_without_data_loss(
    google_tool_choice: dict[str, Any],
    expected_denormalized_tool_choice: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    model_provider = ModelProvider.GOOGLE
    google_tool_dict = {
        "name": "get_weather",
        "description": "Gets the current weather for a given city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                },
            },
        },
    }
    normalized_tools = normalize_tools(
        [google_tool_dict], model_provider, tool_choice=google_tool_choice
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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=validate_invocation_parameters(
                {"max_output_tokens": 1024}, model_provider
            ),
            tools=normalized_tools,
            response_format=None,
            model_provider=model_provider,
            model_name="gemini-2.0-flash",
        )
        session.add(prompt_version)

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # denormalize tools and check tool choice matches input
    rehydrated_tools = rehydrated_prompt_version.tools
    assert rehydrated_tools is not None
    _, denormalized_tool_choice = denormalize_tools(rehydrated_tools, model_provider)
    assert denormalized_tool_choice == expected_denormalized_tool_choice


@pytest.mark.parametrize(
    "openai_response_format_dict",
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
                    "strict": False,
                },
            },
            id="with-strict-set-to-fase",
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
            id="with-description",
        ),
    ],
)
async def test_openai_response_format_are_round_tripped_without_data_loss(
    openai_response_format_dict: dict[str, Any],
    db: DbSessionFactory,
    dialect: str,
) -> None:
    expected_normalized_response_format_dict = openai_response_format_dict
    model_provider = ModelProvider.OPENAI
    # normalize output schema
    normalized_response_format = normalize_response_format(
        openai_response_format_dict, model_provider
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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai",
                openai=PromptOpenAIInvocationParametersContent(),
            ),
            tools=None,
            response_format=normalized_response_format,
            model_provider=model_provider,
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
        rehydrated_response_format, model_provider
    )
    assert denormalized_response_format_dict == openai_response_format_dict


@pytest.mark.parametrize(
    "input_invocation_parameters_dict,model_provider",
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
            ModelProvider.OPENAI,
            id="openai-parameters",
        ),
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
            ModelProvider.AZURE_OPENAI,
            id="azure-openai-parameters",
        ),
        pytest.param(
            {
                "max_tokens": 256,
                "temperature": 0.73,
                "stop_sequences": ["<|endoftext|>"],
                "top_p": 0.92,
            },
            ModelProvider.ANTHROPIC,
            id="anthropic-parameters",
        ),
        pytest.param(
            {
                "temperature": 0.73,
                "max_output_tokens": 256,
                "stop_sequences": ["<|endoftext|>"],
                "presence_penalty": 0.25,
                "frequency_penalty": 0.12,
                "top_p": 0.92,
                "top_k": 40,
            },
            ModelProvider.GOOGLE,
            id="google-parameters",
        ),
    ],
)
async def test_invocation_parameters_are_round_tripped_without_data_loss(
    input_invocation_parameters_dict: dict[str, Any],
    model_provider: ModelProvider,
    db: DbSessionFactory,
    dialect: str,
) -> None:
    # validate invocation parameters
    invocation_parameters = validate_invocation_parameters(
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
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat",
                messages=[],
            ),
            invocation_parameters=invocation_parameters,
            tools=None,
            response_format=None,
            model_provider=model_provider,
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
    model_provider_lower = model_provider.value.lower()
    assert materialized_invocation_parameters_dict == {
        "type": model_provider_lower,
        model_provider_lower: input_invocation_parameters_dict,
    }

    # fetch prompt version
    async with db() as session:
        rehydrated_prompt_version = await session.get(PromptVersion, prompt_version.id)
    assert rehydrated_prompt_version is not None

    # check it matches the input invocation parameters
    rehydrated_invocation_parameters = rehydrated_prompt_version.invocation_parameters
    assert rehydrated_invocation_parameters is not None
    assert rehydrated_invocation_parameters.type == model_provider_lower
    assert (
        get_raw_invocation_parameters(rehydrated_invocation_parameters)
        == input_invocation_parameters_dict
    )
