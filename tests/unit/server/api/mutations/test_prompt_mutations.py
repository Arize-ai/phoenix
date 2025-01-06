from typing import Any, Optional

import pytest
from strawberry.relay.types import GlobalID

from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestPromptMutations:
    CREATE_CHAT_PROMPT_MUTATION = """
      mutation CreateChatPromptMutation($input: CreateChatPromptInput!) {
        createChatPrompt(input: $input) {
          name
          description
          createdAt
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
    CREATE_CHAT_PROMPT_VERSION_MUTATION = """
      mutation CreateChatPromptVersionMutation($input: CreateChatPromptVersionInput!) {
        createChatPromptVersion(input: $input) {
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

    @pytest.mark.parametrize(
        "variables,expected_tools,expected_output_schema",
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
                [],
                None,
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
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "tools": [{"definition": {"foo": "bar"}}],
                        },
                    }
                },
                [{"definition": {"foo": "bar"}}],
                None,
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
                            "outputSchema": {"definition": {"foo": "bar"}},
                        },
                    }
                },
                [],
                {"definition": {"foo": "bar"}},
                id="with-output-schema",
            ),
        ],
    )
    async def test_create_chat_prompt_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_tools: list[dict[str, Any]],
        expected_output_schema: Optional[dict[str, Any]],
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
        assert prompt_version.pop("modelProvider") == "openai"
        assert prompt_version.pop("modelName") == "o1-mini"
        assert prompt_version.pop("invocationParameters") == {"temperature": 0.4}
        assert prompt_version.pop("tools") == expected_tools
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
        "variables,expected_error",
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
                "Input should be a valid dictionary",
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
                "Input should be a valid dictionary",
                id="invalid-output-schema",
            ),
        ],
    )
    async def test_create_chat_prompt_fails_with_invalid_input(
        self, gql_client: AsyncGraphQLClient, variables: dict[str, Any], expected_error: str
    ) -> None:
        result = await gql_client.execute(self.CREATE_CHAT_PROMPT_MUTATION, variables)
        assert len(result.errors) == 1
        assert expected_error in result.errors[0].message
        assert result.data is None

    @pytest.mark.parametrize(
        "variables,expected_tools,expected_output_schema",
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
                [],
                None,
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
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                            "tools": [{"definition": {"foo": "bar"}}],
                        },
                    }
                },
                [{"definition": {"foo": "bar"}}],
                None,
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
                            "outputSchema": {"definition": {"foo": "bar"}},
                        },
                    }
                },
                [],
                {"definition": {"foo": "bar"}},
                id="with-output-schema",
            ),
        ],
    )
    async def test_create_chat_prompt_version_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_tools: list[dict[str, Any]],
        expected_output_schema: Optional[dict[str, Any]],
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
        assert latest_prompt_version.pop("modelProvider") == "openai"
        assert latest_prompt_version.pop("modelName") == "o1-mini"
        assert latest_prompt_version.pop("invocationParameters") == {"temperature": 0.4}
        assert latest_prompt_version.pop("tools") == expected_tools
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
        "variables,expected_error",
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
                "Input should be a valid dictionary",
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
                "Input should be a valid dictionary",
                id="invalid-output-schema",
            ),
        ],
    )
    async def test_create_chat_prompt_version_fails_with_invalid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_error: str,
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
        assert expected_error in result.errors[0].message
        assert result.data is None
