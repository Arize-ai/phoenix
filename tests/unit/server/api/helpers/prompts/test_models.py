import json
from typing import Any

import pytest
from sqlalchemy import select, text

from phoenix.db.models import Prompt, PromptVersion
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    denormalize_output_schema,
    denormalize_tools,
    normalize_output_schema,
    normalize_tools,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize(
    "anthropic_tool_dict,expected_normalized_tool_dict",
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
def test_openai_tool_normalization_and_denormalization_preserves_data(
    openai_tool_dict: dict[str, Any],
    expected_normalized_tool_dict: dict[str, Any],
) -> None:
    normalized_tools = normalize_tools([openai_tool_dict], "openai")
    assert len(normalized_tools.tools) == 1
    normalized_tool_dict = normalized_tools.tools[0].model_dump()
    assert normalized_tool_dict == expected_normalized_tool_dict
    denormalized_tools_dicts = denormalize_tools(normalized_tools, "openai")
    assert len(denormalized_tools_dicts) == 1
    assert denormalized_tools_dicts[0] == openai_tool_dict


@pytest.mark.parametrize(
    "openai_output_schema_dict,expected_normalized_output_schema_dict",
    [
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "output-schema-name",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "foo",
                        ],
                    },
                },
            },
            {
                "type": "output-schema-v1",
                "name": "output-schema-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "foo",
                    ],
                },
                "extra_parameters": {},
            },
            id="minimal-output-schema",
        ),
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "output-schema-name",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "foo",
                        ],
                    },
                    "strict": True,
                },
            },
            {
                "type": "output-schema-v1",
                "name": "output-schema-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "foo",
                    ],
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
                    "name": "output-schema-name",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "foo",
                        ],
                    },
                    "strict": None,
                },
            },
            {
                "type": "output-schema-v1",
                "name": "output-schema-name",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "foo",
                    ],
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
                    "name": "output-schema-name",
                    "description": "output-schema-description",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "foo": {
                                "type": "string",
                            },
                        },
                        "required": [
                            "foo",
                        ],
                    },
                    "strict": True,
                },
            },
            {
                "type": "output-schema-v1",
                "name": "output-schema-name",
                "description": "output-schema-description",
                "schema": {
                    "type": "object",
                    "properties": {
                        "foo": {
                            "type": "string",
                        },
                    },
                    "required": [
                        "foo",
                    ],
                },
                "extra_parameters": {
                    "strict": True,
                },
            },
            id="with-description",
        ),
        pytest.param(
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "output-schema-name",
                },
            },
            {
                "type": "output-schema-v1",
                "name": "output-schema-name",
                "extra_parameters": {},
            },
            id="without-schema",
        ),
    ],
)
def test_openai_output_schema_normalization_and_denormalization_preserves_data(
    openai_output_schema_dict: dict[str, Any],
    expected_normalized_output_schema_dict: dict[str, Any],
) -> None:
    normalized_output_schema = normalize_output_schema(openai_output_schema_dict, "openai")
    normalized_output_schema_dict = normalized_output_schema.model_dump()
    assert normalized_output_schema_dict == expected_normalized_output_schema_dict
    denormalized_output_schema_dict = denormalize_output_schema(normalized_output_schema, "openai")
    assert denormalized_output_schema_dict == openai_output_schema_dict
