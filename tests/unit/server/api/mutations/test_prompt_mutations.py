from typing import Any

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
                      ... on TextPromptMessage {
                        role
                        content
                      }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                outputSchema {
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
                      ... on TextPromptMessage {
                        role
                        content
                      }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                outputSchema {
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
                      ... on TextPromptMessage {
                        role
                        content
                      }
                    }
                  }
                }
                invocationParameters
                tools {
                  definition
                }
                outputSchema {
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "unknown",
                            "modelName": "unknown",
                            "tools": [{"definition": {"foo": "bar"}}],
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "anthropic",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",  # noqa: E501
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",  # noqa: E501
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',  # noqa: E501
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "outputSchema": {"definition": {"foo": "bar"}},
                        },
                    }
                },
                id="with-output-schema",
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
        assert prompt_version.pop("invocationParameters") == {"temperature": 0.4}
        expected_tools = variables["input"]["promptVersion"].get("tools", [])
        assert prompt_version.pop("tools") == expected_tools
        expected_output_schema = variables["input"]["promptVersion"].get("outputSchema")
        assert prompt_version.pop("outputSchema") == expected_output_schema
        assert isinstance(prompt_version.pop("id"), str)

        # Verify messages
        template = prompt_version.pop("template")
        assert len(template["messages"]) == 1
        message = template["messages"][0]
        assert message.pop("role") == "USER"
        assert message.pop("content") == "hello world"
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
                    "templateType": "CHAT",
                    "templateFormat": "MUSTACHE",
                    "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                    "invocationParameters": {"temperature": 0.4},
                    "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "outputSchema": {
                                "definition": ["hello", "world"],  # definition should be a dict
                            },
                        },
                    }
                },
                id="invalid-output-schema",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "parameters": {
                                                "type": "invalid_type",  # invalid schema type
                                                "properties": {"location": {"type": "string"}},
                                            },
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-invalid-openai-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "anthropic",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",  # noqa: E501
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",  # noqa: E501
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',  # noqa: E501
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                        "cache_control": {
                                            "type": "invalid_type"
                                        },  # invalid cache control type
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "unknown",
                            "modelName": "unknown",
                            "tools": [{"definition": {"foo": "bar"}}],
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "outputSchema": {"definition": {"foo": "bar"}},
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "anthropic",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",  # noqa: E501
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",  # noqa: E501
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',  # noqa: E501
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
                        "templateType": "CHAT",
                        "templateFormat": "MUSTACHE",
                        "template": {"messages": [{"role": "USER", "content": "initial"}]},
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "openai",
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
        assert latest_prompt_version.pop("invocationParameters") == {"temperature": 0.4}
        expected_tools = variables["input"]["promptVersion"].get("tools", [])
        assert latest_prompt_version.pop("tools") == expected_tools
        expected_output_schema = variables["input"]["promptVersion"].get("outputSchema")
        assert latest_prompt_version.pop("outputSchema") == expected_output_schema
        assert isinstance(latest_prompt_version.pop("id"), str)

        # Verify messages
        template = latest_prompt_version.pop("template")
        assert len(template["messages"]) == 1
        message = template["messages"][0]
        assert message.pop("role") == "USER"
        assert message.pop("content") == "hello world"
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
                    "templateType": "CHAT",
                    "templateFormat": "MUSTACHE",
                    "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                    "invocationParameters": {"temperature": 0.4},
                    "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "outputSchema": {
                                "definition": ["hello", "world"],  # definition should be a dict
                            },
                        },
                    }
                },
                id="invalid-output-schema",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "tools": [
                                {
                                    "definition": {
                                        "type": "function",
                                        "function": {
                                            "name": "get_weather",
                                            "parameters": {
                                                "type": "invalid_type",  # invalid schema type
                                                "properties": {"location": {"type": "string"}},
                                            },
                                        },
                                    }
                                }
                            ],
                        },
                    }
                },
                id="with-invalid-openai-tools",
            ),
            pytest.param(
                {
                    "input": {
                        "promptId": str(GlobalID("Prompt", "1")),
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "hello world"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "anthropic",
                            "modelName": "claude-2",
                            "tools": [
                                {
                                    "definition": {
                                        "name": "get_weather",
                                        "description": "Get the current weather in a given location",  # noqa: E501
                                        "input_schema": {
                                            "type": "object",
                                            "properties": {
                                                "location": {
                                                    "type": "string",
                                                    "description": "The city and state, e.g. San Francisco, CA",  # noqa: E501
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "enum": ["celsius", "fahrenheit"],
                                                    "description": 'The unit of temperature, either "celsius" or "fahrenheit"',  # noqa: E501
                                                },
                                            },
                                            "required": ["location"],
                                        },
                                        "cache_control": {
                                            "type": "invalid_type"
                                        },  # invalid cache control type
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
                        "templateType": "CHAT",
                        "templateFormat": "MUSTACHE",
                        "template": {"messages": [{"role": "USER", "content": "initial"}]},
                        "invocationParameters": {"temperature": 0.4},
                        "modelProvider": "openai",
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
                        "name": "prompt-name (copy)",
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "initial"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                        },
                    }
                },
                id="with-valid-input",
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

        # assert prompt and prompt versions were cloned
        # prompt id, prompt version ids, dates, should be different
        # everything else should be the same
        assert result.data is not None
        data = result.data["clonePrompt"]
        assert data.pop("id") != create_prompt_result.data["createChatPrompt"]["id"]
        assert data.pop("name") != create_prompt_result.data["createChatPrompt"]["name"]
        assert data.pop("createdAt") is not None
        assert (
            data.pop("description") != create_prompt_result.data["createChatPrompt"]["description"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("id")
            != create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["id"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("description")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["description"]
        )
        # assert createdAt is not None
        # we can't do a comparison because the date is identical
        assert data["promptVersions"]["edges"][0]["promptVersion"].pop("createdAt") is not None
        assert data["promptVersions"]["edges"][0]["promptVersion"].pop("user") is None
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("templateType")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["templateType"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("templateFormat")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["templateFormat"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("invocationParameters")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["invocationParameters"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("modelProvider")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["modelProvider"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("modelName")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["modelName"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("template")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["template"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("tools")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["tools"]
        )
        assert (
            data["promptVersions"]["edges"][0]["promptVersion"].pop("outputSchema")
            == create_prompt_result.data["createChatPrompt"]["promptVersions"]["edges"][0][
                "promptVersion"
            ]["outputSchema"]
        )
        # assert all fields of promptVersions["edges"][0]["promptVersion"] have been popped
        assert not data["promptVersions"]["edges"][0]["promptVersion"]
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
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {"messages": [{"role": "USER", "content": "initial"}]},
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
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
        assert "constraint failed" in result.errors[0].message
        assert result.data is None
