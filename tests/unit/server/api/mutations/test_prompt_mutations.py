from typing import Any, Optional

import pytest
from strawberry.relay.types import GlobalID

from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestPromptMutations:
    CREATE_CHAT_PROMPT_MUTATION = """
      mutation CreateChatPromptMutation($input: CreateChatPromptInput!) {
        createChatPrompt(input: $input) {
          id
          name
          description
          metadata
          createdAt
          promptVersions {
            edges {
              promptVersion: node {
                id
                createdAt
                description
                user {
                  id
                }
                templateType
                templateFormat
                template {
                  ... on PromptChatTemplate {
                    messages {
                        role
                        content {
                            ... on TextContentPart {
                                text {
                                    text
                                }
                            }
                        }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                responseFormat {
                  definition
                }
                modelName
                modelProvider
              }
            }
          }
        }
      }
    """
    CREATE_CHAT_PROMPT_VERSION_MUTATION = """
      mutation CreateChatPromptVersionMutation($input: CreateChatPromptVersionInput!) {
        createChatPromptVersion(input: $input) {
          id
          name
          description
          promptVersions {
            edges {
              promptVersion: node {
                id
                description
                user {
                  id
                }
                templateType
                templateFormat
                template {
                  ... on PromptChatTemplate {
                    messages {
                        role
                        content {
                            ... on TextContentPart {
                                text {
                                    text
                                }
                            }
                        }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                responseFormat {
                  definition
                }
                modelName
                modelProvider
              }
            }
          }
        }
      }
    """
    CLONE_PROMPT_MUTATION = """
      mutation ClonePromptMutation($input: ClonePromptInput!) {
        clonePrompt(input: $input) {
          id
          name
          description
          metadata
          createdAt
          promptVersions {
            edges {
              promptVersion: node {
                id
                createdAt
                description
                user {
                  id
                }
                templateType
                templateFormat
                template {
                  ... on PromptChatTemplate {
                    messages {
                        role
                        content {
                            ... on TextContentPart {
                                text {
                                    text
                                }
                            }
                        }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                responseFormat {
                  definition
                }
                modelName
                modelProvider
              }
            }
          }
        }
      }
    """

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="basic-input",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "description": "Get current temperature for a given location.",
                                            "parameters": {
                                                "type": "object",
                                                "properties": {
                                                    "location": {
                                                        "type": "string",
                                                        "description": "City and country e.g. Bogotá, Colombia",
                                                    }
                                                },
                                                "required": ["location"],
                                                "additionalProperties": False,
                                            },
                                            "strict": True,
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "parameters": {
                                                "type": "object",
                                                "properties": {"location": {"type": "string"}},
                                            },
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-valid-openai-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {
                                "max_tokens": 1024,
                                "temperature": 0.4,
                            },
                            "modelProvider": "ANTHROPIC",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-valid-anthropic-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "responseFormat": {
                                "definition": {
                                    "type": "json_schema",
                                    "json_schema": {
                                        "name": "response",
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "foo": {"type": "string"},
                                            },
                                            "required": ["foo"],
                                            "additionalProperties": False,
                                        },
                                        "strict": True,
                                    },
                                }
                            },
                        },
                    }
                },
                id="with-output-schema",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "metadata": {
                            "environment": "production",
                            "version": "1.0",
                            "tags": ["important"],
                        },
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                id="with-metadata",
            ),
        ],
    )
    async def test_create_chat_prompt_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
    ) -> None:
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_MUTATION, variables)
        assert not result.errors
        assert result.data is not None
        data = result.data["createChatPrompt"]
        assert data.pop("name") == "prompt-name"
        assert data.pop("description") == "prompt-description"
        expected_metadata = variables["input"].get("metadata", {})
        assert data.pop("metadata") == expected_metadata
        assert isinstance(data.pop("id"), str)
        assert isinstance(data.pop("createdAt"), str)
        prompt_version = data.pop("promptVersions")["edges"][0]["promptVersion"]
        assert not data

        # Verify prompt version
        assert prompt_version.pop("description") == "prompt-version-description"
        assert prompt_version.pop("user") is None
        assert prompt_version.pop("templateType") == "CHAT"
        assert prompt_version.pop("templateFormat") == "MUSTACHE"
        expected_model_provider = variables["input"]["promptVersion"]["modelProvider"]
        expected_model_name = variables["input"]["promptVersion"]["modelName"]
        assert prompt_version.pop("modelProvider") == expected_model_provider
        assert prompt_version.pop("modelName") == expected_model_name
        expected_invocation_parameters = variables["input"]["promptVersion"]["invocationParameters"]
        assert prompt_version.pop("invocationParameters") == expected_invocation_parameters
        expected_tools = variables["input"]["promptVersion"].get("tools", [])
        assert prompt_version.pop("tools") == expected_tools
        expected_response_format = variables["input"]["promptVersion"].get("responseFormat")
        assert prompt_version.pop("responseFormat") == expected_response_format
        assert isinstance(prompt_version.pop("createdAt"), str)
        assert isinstance(prompt_version.pop("id"), str)

        # Verify messages
        template = prompt_version.pop("template")
        assert len(template["messages"]) == 1
        message = template["messages"][0]
        assert message.pop("role") == "USER"
        content = message.pop("content")
        assert len(content) == 1
        part = content.pop(0)
        text = part.pop("text")
        assert text.pop("text") == "hello world"
        assert not text
        assert not part
        assert not content
        assert not message
        assert not template["messages"][0]
        assert not prompt_version

    async def test_create_chat_prompt_fails_on_name_conflict(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        variables: dict[str, Any] = {
            "input": {
                "name": "prompt-name",
                "description": "prompt-description",
                "promptVersion": {
                    "description": "prompt-version-description",
                    "templateFormat": "MUSTACHE",
                    "template": {
                        "messages": [
                            {
                                "role": "USER",
                                "content": [{"text": {"text": "hello world"}}],
                            }
                        ]
                    },
                    "invocationParameters": {"temperature": 0.4},
                    "modelProvider": "OPENAI",
                    "modelName": "o1-mini",
                },
            }
        }
        # Create first prompt
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_MUTATION, variables)
        assert not result.errors

        # Try to create prompt with same name
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_MUTATION, variables)
        assert len(result.errors) == 1
        assert result.errors[0].message == "A prompt named 'prompt-name' already exists"
        assert result.data is None

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "responseFormat": {
                                "definition": {"type": "object"},
                            },
                        },
                    }
                },
                id="invalid-template-messages",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "tools": [
                                {"definition": ["foo", "bar"]}
                            ],  # definition should be a dict
                        },
                    }
                },
                id="invalid-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "ANTHROPIC",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-invalid-anthropic-tools",
            ),
        ],
    )
    async def test_create_chat_prompt_fails_with_invalid_input(
        self, gql_client: AsyncGraphQLClient, variables: dict[str, Any]
    ) -> None:
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_MUTATION, variables)
        assert len(result.errors) == 1
        assert result.data is None

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="basic-input",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "description": "Get current temperature for a given location.",
                                            "parameters": {
                                                "type": "object",
                                                "properties": {
                                                    "location": {
                                                        "type": "string",
                                                        "description": "City and country e.g. Bogotá, Colombia",
                                                    }
                                                },
                                                "required": ["location"],
                                                "additionalProperties": False,
                                            },
                                            "strict": True,
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "parameters": {
                                                "type": "object",
                                                "properties": {"location": {"type": "string"}},
                                            },
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-valid-openai-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "responseFormat": {
                                "definition": {
                                    "type": "json_schema",
                                    "json_schema": {
                                        "name": "response",
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "foo": {"type": "string"},
                                            },
                                            "required": ["foo"],
                                            "additionalProperties": False,
                                        },
                                        "strict": True,
                                    },
                                }
                            },
                        },
                    }
                },
                id="with-output-schema",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {
                                "max_tokens": 1024,
                                "temperature": 0.4,
                            },
                            "modelProvider": "ANTHROPIC",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-valid-anthropic-tools",
            ),
        ],
    )
    async def test_create_chat_prompt_version_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
    ) -> None:
        # Create initial prompt
        create_prompt_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION,
            {
                "input": {
                    "name": "prompt-name",
                    "description": "prompt-description",
                    "promptVersion": {
                        "description": "initial-version",
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {
                                    "role": "USER",
                                    "content": [{"text": {"text": "initial"}}],
                                }
                            ]
                        },
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "OPENAI",
                        "modelName": "o1-mini",
                    },
                }
            },
        )
        assert not create_prompt_result.errors

        # Create new prompt version
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_VERSION_MUTATION, variables)
        assert not result.errors
        assert result.data is not None
        data = result.data["createChatPromptVersion"]
        assert data.pop("name") == "prompt-name"
        assert data.pop("description") == "prompt-description"
        assert isinstance(data.pop("id"), str)
        versions = data.pop("promptVersions")["edges"]
        assert len(versions) == 2
        latest_prompt_version = versions[0]["promptVersion"]

        # Verify prompt version
        assert latest_prompt_version.pop("description") == "prompt-version-description"
        assert latest_prompt_version.pop("user") is None
        assert latest_prompt_version.pop("templateType") == "CHAT"
        assert latest_prompt_version.pop("templateFormat") == "MUSTACHE"
        expected_model_provider = variables["input"]["promptVersion"]["modelProvider"]
        expected_model_name = variables["input"]["promptVersion"]["modelName"]
        assert latest_prompt_version.pop("modelProvider") == expected_model_provider
        assert latest_prompt_version.pop("modelName") == expected_model_name
        expected_invocation_parameters = variables["input"]["promptVersion"]["invocationParameters"]
        assert latest_prompt_version.pop("invocationParameters") == expected_invocation_parameters
        expected_tools = variables["input"]["promptVersion"].get("tools", [])
        assert latest_prompt_version.pop("tools") == expected_tools
        expected_response_format = variables["input"]["promptVersion"].get("responseFormat")
        assert latest_prompt_version.pop("responseFormat") == expected_response_format
        assert isinstance(latest_prompt_version.pop("id"), str)

        # Verify messages
        template = latest_prompt_version.pop("template")
        assert len(template["messages"]) == 1
        message = template["messages"][0]
        assert message.pop("role") == "USER"
        content = message.pop("content")
        assert len(content) == 1
        part = content[0]
        text = part.pop("text")
        assert text.pop("text") == "hello world"
        assert not text
        assert not part
        assert not message
        assert not template["messages"][0]
        assert not latest_prompt_version
        assert not data

    async def test_create_chat_prompt_version_fails_with_nonexistent_prompt_id(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        variables = {
            "input": {
                "promptId": str(GlobalID("Prompt", "100")),
                "promptVersion": {
                    "description": "prompt-version-description",
                    "templateFormat": "MUSTACHE",
                    "template": {
                        "messages": [
                            {
                                "role": "USER",
                                "content": [{"text": {"text": "hello world"}}],
                            }
                        ]
                    },
                    "invocationParameters": {"temperature": 0.4},
                    "modelProvider": "OPENAI",
                    "modelName": "o1-mini",
                },
            }
        }
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_VERSION_MUTATION, variables)
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message
        assert result.data is None

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="invalid-template-messages",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                            "tools": [
                                {"definition": ["foo", "bar"]}
                            ],  # definition should be a dict
                        },
                    }
                },
                id="invalid-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "hello world"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "anthropic",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-invalid-anthropic-tools",
            ),
        ],
    )
    async def test_create_chat_prompt_version_fails_with_invalid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
    ) -> None:
        # Create initial prompt
        create_prompt_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION,
            {
                "input": {
                    "name": "prompt-name",
                    "description": "prompt-description",
                    "promptVersion": {
                        "description": "initial-version",
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {
                                    "role": "USER",
                                    "content": [{"text": {"text": "initial"}}],
                                }
                            ]
                        },
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "OPENAI",
                        "modelName": "o1-mini",
                    },
                }
            },
        )
        assert not create_prompt_result.errors

        # Try to create invalid prompt version
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_VERSION_MUTATION, variables)
        assert len(result.errors) == 1
        assert result.data is None

    @pytest.mark.parametrize(
        "variables, initial_prompt_variables",
        [
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name-copy",
                        "description": "new prompt-description",
                        "promptId": str(GlobalID("Prompt", "1")),
                    }
                },
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "initial-version",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "initial"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="with-valid-input",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name-copy",
                        "description": "new prompt-description",
                        "metadata": {"cloned": True, "source": "original"},
                        "promptId": str(GlobalID("Prompt", "1")),
                    }
                },
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "metadata": {"environment": "staging", "version": "2.0"},
                        "promptVersion": {
                            "description": "initial-version",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "initial"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="with-metadata-override",
            ),
        ],
    )
    async def test_clone_prompt_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        initial_prompt_variables: dict[str, Any],
    ) -> None:
        # create initial prompt
        create_prompt_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION, initial_prompt_variables
        )
        assert not create_prompt_result.errors
        assert create_prompt_result.data is not None

        # clone prompt
        result = await gql_client.execute(self.CLONE_PROMPT_MUTATION, variables)

        created_prompt = create_prompt_result.data["createChatPrompt"]
        created_prompt_version = created_prompt["promptVersions"]["edges"][0]["promptVersion"]

        # assert prompt and prompt versions were cloned
        # prompt id, prompt version ids, dates, should be different
        # everything else should be the same
        assert result.data is not None
        data = result.data["clonePrompt"]
        assert data.pop("id") != created_prompt["id"]
        assert data.pop("name") != created_prompt["name"]
        assert data.pop("createdAt") is not None
        assert data.pop("description") != created_prompt["description"]
        # Metadata should be overridden if provided, otherwise copied from original
        expected_metadata = variables["input"].get("metadata", created_prompt["metadata"])
        assert data.pop("metadata") == expected_metadata
        cloned_prompt_version = data["promptVersions"]["edges"][0].pop("promptVersion")
        assert cloned_prompt_version.pop("id") != created_prompt_version["id"]
        assert cloned_prompt_version.pop("description") == created_prompt_version["description"]
        assert cloned_prompt_version.pop("createdAt") is not None
        assert cloned_prompt_version.pop("user") is None
        assert cloned_prompt_version.pop("templateType") == created_prompt_version["templateType"]
        assert (
            cloned_prompt_version.pop("templateFormat") == created_prompt_version["templateFormat"]
        )
        assert (
            cloned_prompt_version.pop("invocationParameters")
            == created_prompt_version["invocationParameters"]
        )
        assert cloned_prompt_version.pop("modelProvider") == created_prompt_version["modelProvider"]
        assert cloned_prompt_version.pop("modelName") == created_prompt_version["modelName"]
        assert cloned_prompt_version.pop("template") == created_prompt_version["template"]
        assert cloned_prompt_version.pop("tools") == created_prompt_version["tools"]
        assert (
            cloned_prompt_version.pop("responseFormat") == created_prompt_version["responseFormat"]
        )
        assert not data["promptVersions"]["edges"][0]
        assert not cloned_prompt_version
        assert data.pop("promptVersions") is not None
        assert not data

    @pytest.mark.parametrize(
        "variables, initial_prompt_variables",
        [
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "new prompt-description",
                        "promptId": str(GlobalID("Prompt", "1")),
                    }
                },
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "initial-version",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "initial"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "OPENAI",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="with-duplicate-name",
            ),
        ],
    )
    async def test_clone_prompt_fails_with_duplicate_name(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        initial_prompt_variables: dict[str, Any],
    ) -> None:
        # create initial prompt
        create_prompt_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION, initial_prompt_variables
        )
        assert not create_prompt_result.errors

        # clone prompt
        result = await gql_client.execute(self.CLONE_PROMPT_MUTATION, variables)
        assert len(result.errors) == 1
        assert (
            f"A prompt named '{variables['input']['name']}' already exists"
            in result.errors[0].message
        )
        assert result.data is None

    PATCH_PROMPT_MUTATION = """
      mutation PatchPromptMutation($input: PatchPromptInput!) {
        patchPrompt(input: $input) {
          id
          name
          description
          metadata
        }
      }
    """

    @pytest.mark.parametrize(
        "variables, initial_prompt_variables, expected_description, expected_metadata",
        [
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "description": "updated description",
                        "metadata": {"env": "staging", "version": "2.0"},
                    }
                },
                {
                    "input": {
                        "name": "test-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod", "version": "1.0"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "updated description",
                {"env": "staging", "version": "2.0"},
                id="update-both-fields",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "description": "only description updated",
                    }
                },
                {
                    "input": {
                        "name": "test-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "only description updated",
                {"env": "prod"},  # metadata unchanged
                id="update-description-only",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "metadata": {"new": "metadata"},
                    }
                },
                {
                    "input": {
                        "name": "test-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "original description",  # description unchanged
                {"new": "metadata"},
                id="update-metadata-only",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "description": None,
                        "metadata": None,
                    }
                },
                {
                    "input": {
                        "name": "test-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                None,  # cleared to null
                {},  # cleared to empty dict
                id="clear-both-with-null",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "metadata": None,
                    }
                },
                {
                    "input": {
                        "name": "test-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "original description",  # unchanged
                {},  # cleared
                id="clear-metadata-only",
            ),
        ],
    )
    async def test_patch_prompt_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        initial_prompt_variables: dict[str, Any],
        expected_description: Optional[str],
        expected_metadata: dict[str, Any],
    ) -> None:
        # Create initial prompt
        create_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION, initial_prompt_variables
        )
        assert not create_result.errors
        assert create_result.data is not None

        # Patch the prompt
        result = await gql_client.execute(self.PATCH_PROMPT_MUTATION, variables)
        assert not result.errors
        assert result.data is not None

        data = result.data["patchPrompt"]
        assert data["name"] == initial_prompt_variables["input"]["name"]
        assert data["description"] == expected_description
        assert data["metadata"] == expected_metadata
        assert isinstance(data["id"], str)

    async def test_patch_prompt_fails_with_no_fields(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        # Create initial prompt
        create_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION,
            {
                "input": {
                    "name": "test-prompt",
                    "description": "original",
                    "promptVersion": {
                        "description": "v1",
                        "templateFormat": "MUSTACHE",
                        "template": {
                            "messages": [
                                {
                                    "role": "USER",
                                    "content": [{"text": {"text": "test"}}],
                                }
                            ]
                        },
                        "invocationParameters": {"temperature": 0.5},
                        "modelProvider": "OPENAI",
                        "modelName": "gpt-4o",
                    },
                }
            },
        )
        assert not create_result.errors

        # Try to patch with no fields
        result = await gql_client.execute(
            self.PATCH_PROMPT_MUTATION,
            {"input": {"promptId": str(GlobalID("Prompt", "1"))}},
        )
        assert len(result.errors) == 1
        assert "No fields provided to update" in result.errors[0].message
        assert result.data is None

    async def test_patch_prompt_fails_with_nonexistent_prompt(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        result = await gql_client.execute(
            self.PATCH_PROMPT_MUTATION,
            {
                "input": {
                    "promptId": str(GlobalID("Prompt", "999")),
                    "description": "test",
                }
            },
        )
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()
        assert result.data is None

    @pytest.mark.parametrize(
        "variables, initial_prompt_variables, expected_description, expected_metadata",
        [
            pytest.param(
                {
                    "input": {
                        "name": "cloned-prompt",
                        "promptId": str(GlobalID("Prompt", "1")),
                    }
                },
                {
                    "input": {
                        "name": "original-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod", "version": "1.0"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "original description",  # inherited
                {"env": "prod", "version": "1.0"},  # inherited
                id="clone-inherit-both-fields",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "cloned-prompt",
                        "promptId": str(GlobalID("Prompt", "1")),
                        "description": None,
                    }
                },
                {
                    "input": {
                        "name": "original-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                None,  # cleared to null
                {"env": "prod"},  # inherited
                id="clone-clear-description-inherit-metadata",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "cloned-prompt",
                        "promptId": str(GlobalID("Prompt", "1")),
                        "metadata": None,
                    }
                },
                {
                    "input": {
                        "name": "original-prompt",
                        "description": "original description",
                        "metadata": {"env": "prod"},
                        "promptVersion": {
                            "description": "v1",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "USER",
                                        "content": [{"text": {"text": "test"}}],
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.5},
                            "modelProvider": "OPENAI",
                            "modelName": "gpt-4o",
                        },
                    }
                },
                "original description",  # inherited
                {},  # cleared
                id="clone-inherit-description-clear-metadata",
            ),
        ],
    )
    async def test_clone_prompt_unset_semantics(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        initial_prompt_variables: dict[str, Any],
        expected_description: Optional[str],
        expected_metadata: dict[str, Any],
    ) -> None:
        # Create initial prompt
        create_result = await gql_client.execute(
            self.CREATE_CHAT_PROMPT_MUTATION, initial_prompt_variables
        )
        assert not create_result.errors
        assert create_result.data is not None

        # Clone the prompt
        result = await gql_client.execute(self.CLONE_PROMPT_MUTATION, variables)
        assert not result.errors
        assert result.data is not None

        data = result.data["clonePrompt"]
        assert data["name"] == variables["input"]["name"]
        assert data["description"] == expected_description
        assert data["metadata"] == expected_metadata
        assert isinstance(data["id"], str)
