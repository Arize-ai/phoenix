from typing import Any, Optional

import pytest

from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestPromptMutations:
    MUTATION = """
      mutation CreatePromptMutation($input: CreatePromptInput!) {
        createPrompt(input: $input) {
          name
          description
          createdAt
          promptVersions {
            edges {
              promptVersion: node {
                id
                description
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
                            "template": {"messages": [{"role": "user", "content": "hello world"}]},
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
                            "template": {"messages": [{"role": "user", "content": "hello world"}]},
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
                            "template": {"messages": [{"role": "user", "content": "hello world"}]},
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
    async def test_create_prompt_succeeds_with_valid_input(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_tools: list[dict[str, Any]],
        expected_output_schema: Optional[dict[str, Any]],
    ) -> None:
        result = await gql_client.execute(self.MUTATION, variables)
        assert not result.errors
        assert result.data is not None
        data = result.data["createPrompt"]
        assert data.pop("name") == "prompt-name"
        assert data.pop("description") == "prompt-description"
        assert isinstance(data.pop("createdAt"), str)
        prompt_version = data.pop("promptVersions")["edges"][0]["promptVersion"]
        assert not data

        # Verify prompt version
        assert prompt_version.pop("description") == "prompt-version-description"
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

    async def test_create_prompt_fails_on_name_conflict(
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
                    "template": {"messages": [{"role": "user", "content": "hello world"}]},
                    "invocationParameters": {"temperature": 0.4},
                    "modelProvider": "openai",
                    "modelName": "o1-mini",
                },
            }
        }
        # Create first prompt
        result = await gql_client.execute(self.MUTATION, variables)
        assert not result.errors

        # Try to create prompt with same name
        result = await gql_client.execute(self.MUTATION, variables)
        assert len(result.errors) == 1
        assert result.errors[0].message == "A prompt named 'prompt-name' already exists"
        assert result.data is None

    @pytest.mark.parametrize(
        "variables,expected_error",
        [
            pytest.param(
                {
                    "input": {
                        "name": "another-prompt-name",
                        "description": "prompt-description",
                        "promptVersion": {
                            "description": "prompt-version-description",
                            "templateType": "CHAT",
                            "templateFormat": "MUSTACHE",
                            "template": {
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": "hello world",
                                        "extra_key": "test_value",
                                    }
                                ]
                            },
                            "invocationParameters": {"temperature": 0.4},
                            "modelProvider": "openai",
                            "modelName": "o1-mini",
                        },
                    }
                },
                "extra_key",
                id="extra-key-in-message",
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
                            "template": {"messages": [{"role": "user", "content": "hello world"}]},
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
                            "template": {"messages": [{"role": "user", "content": "hello world"}]},
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
    async def test_create_prompt_fails_with_invalid_input(
        self, gql_client: AsyncGraphQLClient, variables: dict[str, Any], expected_error: str
    ) -> None:
        result = await gql_client.execute(self.MUTATION, variables)
        assert len(result.errors) == 1
        assert expected_error in result.errors[0].message
        assert result.data is None
