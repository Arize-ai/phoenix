from typing import Any

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
                tools
                outputSchema
                modelName
                modelProvider
              }
            }
          }
        }
      }
    """

    async def test_create_prompt_succeeds_with_valid_input_and_fails_on_name_conflict_or_invalid_input(  # noqa: E501
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
        assert prompt_version.pop("tools") == {}
        assert prompt_version.pop("outputSchema") == {}
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

        # Verify error raised when prompt name already exists
        result = await gql_client.execute(self.MUTATION, variables)
        assert len(result.errors) == 1
        assert result.errors[0].message == "A prompt named 'prompt-name' already exists"
        assert result.data is None

        # Verify error raised when invalid input
        variables["input"]["promptVersion"]["template"]["messages"][0]["extra_key"] = "test_value"
        result = await gql_client.execute(self.MUTATION, variables)
        assert len(result.errors) == 1
        assert result.errors[0].message.startswith("Invalid prompt template")
        assert result.data is None
