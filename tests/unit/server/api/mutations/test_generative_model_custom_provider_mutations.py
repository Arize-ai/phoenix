from secrets import token_hex
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from tests.unit.graphql import AsyncGraphQLClient


async def _fetch_provider_via_node_query(
    gql_client: AsyncGraphQLClient, provider_id: str, query: str
) -> dict[str, Any]:
    """Fetch provider details using the node query."""
    result = await gql_client.execute(
        query=query,
        variables={"id": provider_id},
        operation_name="GetGenerativeModelCustomProvider",
    )
    assert not result.errors
    assert result.data is not None
    provider = result.data["node"]
    assert provider is not None
    return provider  # type: ignore[no-any-return]


class TestGenerativeModelCustomProviderMutations:
    QUERY = """
      query GetGenerativeModelCustomProvider($id: ID!) {
        node(id: $id) {
          ... on GenerativeModelCustomProvider {
            id
            name
            description
            provider
            createdAt
            updatedAt
            config {
              ... on OpenAICustomProviderConfig {
                openaiAuthenticationMethod {
                  apiKey
                }
                openaiClientKwargs {
                  baseUrl
                  organization
                  project
                  defaultHeaders
                }
              }
              ... on AzureOpenAICustomProviderConfig {
                azureOpenaiAuthenticationMethod {
                  apiKey
                  azureAdTokenProvider {
                    azureTenantId
                    azureClientId
                    azureClientSecret
                    scope
                  }
                  defaultCredentials
                }
                azureOpenaiClientKwargs {
                  azureEndpoint
                  defaultHeaders
                }
              }
              ... on AnthropicCustomProviderConfig {
                anthropicAuthenticationMethod {
                  apiKey
                }
                anthropicClientKwargs {
                  baseUrl
                  defaultHeaders
                }
              }
              ... on AWSBedrockCustomProviderConfig {
                awsBedrockAuthenticationMethod {
                  accessKeys {
                    awsAccessKeyId
                    awsSecretAccessKey
                    awsSessionToken
                  }
                  defaultCredentials
                }
                awsBedrockClientKwargs {
                  regionName
                  endpointUrl
                }
              }
              ... on GoogleGenAICustomProviderConfig {
                googleGenaiAuthenticationMethod {
                  apiKey
                }
                googleGenaiClientKwargs {
                  httpOptions {
                    baseUrl
                    headers
                  }
                }
              }
            }
          }
        }
      }

      mutation CreateGenerativeModelCustomProviderMutation($input: CreateGenerativeModelCustomProviderMutationInput!) {
        createGenerativeModelCustomProvider(input: $input) {
          provider {
            id
          }
        }
      }

      mutation PatchGenerativeModelCustomProvider($input: PatchGenerativeModelCustomProviderMutationInput!) {
        patchGenerativeModelCustomProvider(input: $input) {
          provider {
            id
          }
        }
      }

      mutation DeleteGenerativeModelCustomProvider($input: DeleteGenerativeModelCustomProviderMutationInput!) {
        deleteGenerativeModelCustomProvider(input: $input) {
          id
        }
      }
    """

    async def test_all_provider_mutations_comprehensive(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Comprehensive test of all provider mutations to minimize server overhead.

        This single test covers:
        - All provider types (OpenAI, Azure, Anthropic, Google, AWS)
        - All authentication methods (API keys, Azure AD token provider, AWS credentials)
        - Minimal configurations with defaults
        - Error cases (duplicate names, invalid inputs)
        - Patch operations (name, description, config)
        - Delete operations (existing and non-existent providers)
        """

        # ===== CREATE TESTS =====

        # Create OpenAI provider with full config
        openai_name = f"test-openai-provider-{token_hex(2)}"
        openai_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": openai_name,
                    "description": "Test OpenAI provider",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "sk-test-key"},
                            "openaiClientKwargs": {
                                "baseUrl": "https://api.openai.com/v1",
                                "organization": "org-123",
                                "project": "proj-456",
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not openai_result.errors
        assert openai_result.data is not None
        openai_id = openai_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify OpenAI provider
        openai_provider = await _fetch_provider_via_node_query(gql_client, openai_id, self.QUERY)
        assert openai_provider is not None
        assert openai_provider["name"] == openai_name
        assert openai_provider["description"] == "Test OpenAI provider"
        assert openai_provider["provider"] == "openai"
        assert isinstance(openai_provider["createdAt"], str)
        assert isinstance(openai_provider["updatedAt"], str)
        config = openai_provider["config"]
        assert config["openaiAuthenticationMethod"]["apiKey"] == "sk-test-key"
        assert config["openaiClientKwargs"]["baseUrl"] == "https://api.openai.com/v1"
        assert config["openaiClientKwargs"]["organization"] == "org-123"
        assert config["openaiClientKwargs"]["project"] == "proj-456"

        # Create Azure OpenAI provider with API key
        azure_name = f"test-azure-provider-{token_hex(2)}"
        azure_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": azure_name,
                    "description": "Test Azure OpenAI provider",
                    "provider": "azure",
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {"apiKey": "azure-key-123"},
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": "https://test.openai.azure.com",
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not azure_result.errors
        assert azure_result.data is not None
        azure_id = azure_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify Azure provider
        azure_provider = await _fetch_provider_via_node_query(gql_client, azure_id, self.QUERY)
        assert azure_provider is not None
        assert azure_provider["name"] == azure_name
        assert azure_provider["description"] == "Test Azure OpenAI provider"
        assert azure_provider["provider"] == "azure"
        azure_config = azure_provider["config"]
        assert azure_config["azureOpenaiAuthenticationMethod"]["apiKey"] == "azure-key-123"
        assert azure_config["azureOpenaiAuthenticationMethod"]["azureAdTokenProvider"] is None
        assert (
            azure_config["azureOpenaiClientKwargs"]["azureEndpoint"]
            == "https://test.openai.azure.com"
        )

        # Create Azure OpenAI provider with AD token provider
        azure_ad_provider_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": f"test-azure-ad-provider-creds-{token_hex(2)}",
                    "provider": "azure",
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {
                                "azureAdTokenProvider": {
                                    "azureTenantId": "tenant-123",
                                    "azureClientId": "client-456",
                                    "azureClientSecret": "secret-789",
                                    "scope": "https://cognitiveservices.azure.com/.default",
                                },
                            },
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": "https://test.openai.azure.com",
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not azure_ad_provider_result.errors
        assert azure_ad_provider_result.data is not None
        azure_ad_provider_id = azure_ad_provider_result.data["createGenerativeModelCustomProvider"][
            "provider"
        ]["id"]

        # Verify Azure AD token provider
        azure_ad_provider_obj = await _fetch_provider_via_node_query(
            gql_client, azure_ad_provider_id, self.QUERY
        )
        assert azure_ad_provider_obj is not None
        token_provider = azure_ad_provider_obj["config"]["azureOpenaiAuthenticationMethod"][
            "azureAdTokenProvider"
        ]
        assert token_provider["azureTenantId"] == "tenant-123"
        assert token_provider["azureClientId"] == "client-456"
        assert token_provider["azureClientSecret"] == "secret-789"
        assert token_provider["scope"] == "https://cognitiveservices.azure.com/.default"

        # Create Anthropic provider
        anthropic_name = f"test-anthropic-provider-{token_hex(2)}"
        anthropic_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": anthropic_name,
                    "description": "Test Anthropic provider",
                    "provider": "anthropic",
                    "clientConfig": {
                        "anthropic": {
                            "anthropicAuthenticationMethod": {"apiKey": "sk-ant-test-key"},
                            "anthropicClientKwargs": {"baseUrl": "https://api.anthropic.com"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not anthropic_result.errors
        assert anthropic_result.data is not None
        anthropic_id = anthropic_result.data["createGenerativeModelCustomProvider"]["provider"][
            "id"
        ]

        # Verify Anthropic provider
        anthropic_provider = await _fetch_provider_via_node_query(
            gql_client, anthropic_id, self.QUERY
        )
        assert anthropic_provider is not None
        assert anthropic_provider["name"] == anthropic_name
        assert anthropic_provider["description"] == "Test Anthropic provider"
        assert anthropic_provider["provider"] == "anthropic"
        anthropic_config = anthropic_provider["config"]
        assert anthropic_config["anthropicAuthenticationMethod"]["apiKey"] == "sk-ant-test-key"
        assert anthropic_config["anthropicClientKwargs"]["baseUrl"] == "https://api.anthropic.com"

        # Create Google GenAI provider
        google_name = f"test-google-provider-{token_hex(2)}"
        google_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": google_name,
                    "description": "Test Google GenAI provider",
                    "provider": "google",
                    "clientConfig": {
                        "googleGenai": {
                            "googleGenaiAuthenticationMethod": {"apiKey": "google-api-key-123"},
                            "googleGenaiClientKwargs": {
                                "httpOptions": {
                                    "baseUrl": "https://generativelanguage.googleapis.com",
                                    "headers": {"X-Custom-Header": "value"},
                                },
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not google_result.errors
        assert google_result.data is not None
        google_id = google_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify Google provider
        google_provider = await _fetch_provider_via_node_query(gql_client, google_id, self.QUERY)
        assert google_provider is not None
        assert google_provider["name"] == google_name
        assert google_provider["description"] == "Test Google GenAI provider"
        assert google_provider["provider"] == "google"
        google_config = google_provider["config"]
        assert google_config["googleGenaiAuthenticationMethod"]["apiKey"] == "google-api-key-123"
        assert "httpOptions" in google_config["googleGenaiClientKwargs"]
        http_options = google_config["googleGenaiClientKwargs"]["httpOptions"]
        assert http_options["baseUrl"] == "https://generativelanguage.googleapis.com"
        assert http_options["headers"] == {"X-Custom-Header": "value"}

        # Create AWS Bedrock provider
        aws_name = f"test-aws-provider-{token_hex(2)}"
        aws_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": aws_name,
                    "description": "Test AWS Bedrock provider",
                    "provider": "aws",
                    "clientConfig": {
                        "awsBedrock": {
                            "awsBedrockAuthenticationMethod": {
                                "accessKeys": {
                                    "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
                                    "awsSecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                                }
                            },
                            "awsBedrockClientKwargs": {"regionName": "us-east-1"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not aws_result.errors
        assert aws_result.data is not None
        aws_id = aws_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify AWS provider
        aws_provider = await _fetch_provider_via_node_query(gql_client, aws_id, self.QUERY)
        assert aws_provider is not None
        assert aws_provider["name"] == aws_name
        assert aws_provider["description"] == "Test AWS Bedrock provider"
        assert aws_provider["provider"] == "aws"
        aws_config = aws_provider["config"]
        access_keys = aws_config["awsBedrockAuthenticationMethod"]["accessKeys"]
        assert access_keys["awsAccessKeyId"] == "AKIAIOSFODNN7EXAMPLE"
        assert access_keys["awsSecretAccessKey"] == "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        assert access_keys["awsSessionToken"] is None
        assert aws_config["awsBedrockClientKwargs"]["regionName"] == "us-east-1"

        # Create AWS Bedrock provider with session token
        aws_session_name = f"test-aws-provider-with-session-{token_hex(2)}"
        aws_session_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": aws_session_name,
                    "description": "Test AWS Bedrock provider with session token",
                    "provider": "aws",
                    "clientConfig": {
                        "awsBedrock": {
                            "awsBedrockAuthenticationMethod": {
                                "accessKeys": {
                                    "awsAccessKeyId": "AKIAIOSFODNN7EXAMPLE",
                                    "awsSecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                                    "awsSessionToken": "FwoGZXIvYXdzEBYaDExample",
                                }
                            },
                            "awsBedrockClientKwargs": {"regionName": "us-west-2"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not aws_session_result.errors
        assert aws_session_result.data is not None
        aws_session_id = aws_session_result.data["createGenerativeModelCustomProvider"]["provider"][
            "id"
        ]

        # Verify AWS session token
        aws_session_provider = await _fetch_provider_via_node_query(
            gql_client, aws_session_id, self.QUERY
        )
        assert aws_session_provider is not None
        assert aws_session_provider["name"] == aws_session_name
        access_keys = aws_session_provider["config"]["awsBedrockAuthenticationMethod"]["accessKeys"]
        assert access_keys["awsSessionToken"] == "FwoGZXIvYXdzEBYaDExample"
        assert aws_session_provider["config"]["awsBedrockClientKwargs"]["regionName"] == "us-west-2"

        # ===== DEFAULT CREDENTIALS TESTS =====

        # Create Azure OpenAI provider with default credentials (Managed Identity)
        azure_default_creds_name = f"test-azure-default-creds-{token_hex(2)}"
        azure_default_creds_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": azure_default_creds_name,
                    "description": "Azure with default credentials",
                    "provider": "azure",
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {"defaultCredentials": True},
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": "https://default-creds.openai.azure.com",
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not azure_default_creds_result.errors
        assert azure_default_creds_result.data is not None
        azure_default_creds_id = azure_default_creds_result.data[
            "createGenerativeModelCustomProvider"
        ]["provider"]["id"]

        # Verify Azure default credentials provider
        azure_default_creds_provider = await _fetch_provider_via_node_query(
            gql_client, azure_default_creds_id, self.QUERY
        )
        assert azure_default_creds_provider is not None
        assert azure_default_creds_provider["name"] == azure_default_creds_name
        azure_auth = azure_default_creds_provider["config"]["azureOpenaiAuthenticationMethod"]
        assert azure_auth["defaultCredentials"] is True
        assert azure_auth["apiKey"] is None
        assert azure_auth["azureAdTokenProvider"] is None

        # Create AWS Bedrock provider with default credentials (IAM role)
        aws_default_creds_name = f"test-aws-default-creds-{token_hex(2)}"
        aws_default_creds_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": aws_default_creds_name,
                    "description": "AWS with default credentials",
                    "provider": "aws",
                    "clientConfig": {
                        "awsBedrock": {
                            "awsBedrockAuthenticationMethod": {"defaultCredentials": True},
                            "awsBedrockClientKwargs": {"regionName": "us-east-1"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not aws_default_creds_result.errors
        assert aws_default_creds_result.data is not None
        aws_default_creds_id = aws_default_creds_result.data["createGenerativeModelCustomProvider"][
            "provider"
        ]["id"]

        # Verify AWS default credentials provider
        aws_default_creds_provider = await _fetch_provider_via_node_query(
            gql_client, aws_default_creds_id, self.QUERY
        )
        assert aws_default_creds_provider is not None
        assert aws_default_creds_provider["name"] == aws_default_creds_name
        aws_auth = aws_default_creds_provider["config"]["awsBedrockAuthenticationMethod"]
        assert aws_auth["defaultCredentials"] is True
        assert aws_auth["accessKeys"] is None

        # Create provider with minimal config (optional fields omitted)
        minimal_name = f"minimal-provider-{token_hex(2)}"
        minimal_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": minimal_name,
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "sk-minimal-key"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not minimal_result.errors
        assert minimal_result.data is not None
        minimal_id = minimal_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify minimal config - optional fields are None
        minimal_provider = await _fetch_provider_via_node_query(gql_client, minimal_id, self.QUERY)
        assert minimal_provider is not None
        assert minimal_provider["name"] == minimal_name
        assert minimal_provider["description"] is None
        assert minimal_provider["config"]["openaiClientKwargs"] is None

        # ===== ERROR CASE TESTS =====

        # Create duplicate provider (should fail)
        duplicate_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": openai_name,  # Duplicate name
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "sk-key"},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert duplicate_result.errors is not None
        assert any("already exists" in e.message for e in duplicate_result.errors)

        # Create provider with missing client config (should fail)
        missing_config_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {"name": "test-provider", "provider": "openai", "clientConfig": {}}
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert missing_config_result.errors is not None
        assert any(
            "must specify exactly one key" in e.message for e in missing_config_result.errors
        )

        # Create provider with multiple client configs (should fail)
        multiple_config_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": "test-provider",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "sk-key"},
                        },
                        "anthropic": {
                            "anthropicAuthenticationMethod": {"apiKey": "sk-key"},
                        },
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert multiple_config_result.errors is not None
        assert any(
            "must specify exactly one key" in e.message for e in multiple_config_result.errors
        )

        # ===== PATCH/UPDATE TESTS =====

        # Patch provider name and description
        updated_openai_name = f"updated-openai-provider-{token_hex(2)}"
        patch_name_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": openai_id,
                    "name": updated_openai_name,
                    "description": "Updated description",
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert not patch_name_result.errors
        updated_openai = await _fetch_provider_via_node_query(gql_client, openai_id, self.QUERY)
        assert updated_openai is not None
        assert updated_openai["name"] == updated_openai_name
        assert updated_openai["description"] == "Updated description"

        # Patch provider config
        patch_config_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": openai_id,
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "sk-updated-key"},
                            "openaiClientKwargs": {
                                "baseUrl": "https://updated.openai.com",
                                "organization": "updated-org",
                            },
                        }
                    },
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert not patch_config_result.errors
        updated_provider_config = await _fetch_provider_via_node_query(
            gql_client, openai_id, self.QUERY
        )
        assert updated_provider_config is not None
        updated_config = updated_provider_config["config"]
        assert updated_config["openaiAuthenticationMethod"]["apiKey"] == "sk-updated-key"
        assert updated_config["openaiClientKwargs"]["baseUrl"] == "https://updated.openai.com"
        assert updated_config["openaiClientKwargs"]["organization"] == "updated-org"

        # Patch with duplicate name (should fail)
        duplicate_patch_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"id": azure_id, "name": updated_openai_name}},
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert duplicate_patch_result.errors is not None
        assert any(
            "already exists" in e.message.lower() or "conflict" in e.message.lower()
            for e in duplicate_patch_result.errors
        )

        # Patch non-existent provider (should fail)
        nonexistent_patch_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": str(GlobalID("GenerativeModelCustomProvider", "999999")),
                    "name": "new-name",
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert nonexistent_patch_result.errors is not None
        assert any("not found" in e.message.lower() for e in nonexistent_patch_result.errors)

        # Patch provider to change SDK type (OpenAI -> Anthropic)
        # This should FAIL because incompatible SDK changes are blocked
        patch_incompatible_sdk_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": minimal_id,  # This was an OpenAI provider
                    "clientConfig": {
                        "anthropic": {
                            "anthropicAuthenticationMethod": {"apiKey": "sk-ant-switched-key"},
                            "anthropicClientKwargs": {"baseUrl": "https://api.anthropic.com"},
                        }
                    },
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert patch_incompatible_sdk_result.errors is not None
        assert any(
            "cannot change sdk" in e.message.lower() for e in patch_incompatible_sdk_result.errors
        )

        # Patch provider to change SDK type (OpenAI -> Azure OpenAI)
        # This should SUCCEED because openai and azure_openai are compatible SDKs
        switched_sdk_name = f"switched-sdk-provider-{token_hex(2)}"
        patch_compatible_sdk_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": minimal_id,  # This was an OpenAI provider
                    "name": switched_sdk_name,
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {"apiKey": "azure-key-compat"},
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": "https://compat.openai.azure.com",
                            },
                        }
                    },
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert not patch_compatible_sdk_result.errors
        assert patch_compatible_sdk_result.data is not None
        switched_id = patch_compatible_sdk_result.data["patchGenerativeModelCustomProvider"][
            "provider"
        ]["id"]

        # Verify the SDK was switched to Azure OpenAI
        switched_provider = await _fetch_provider_via_node_query(
            gql_client, switched_id, self.QUERY
        )
        assert switched_provider is not None
        assert switched_provider["name"] == switched_sdk_name
        # Verify Azure OpenAI config is present
        switched_config = switched_provider["config"]
        assert switched_config["azureOpenaiAuthenticationMethod"]["apiKey"] == "azure-key-compat"
        assert (
            switched_config["azureOpenaiClientKwargs"]["azureEndpoint"]
            == "https://compat.openai.azure.com"
        )

        # ===== DELETE TESTS =====

        # Delete provider
        delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"id": anthropic_id}},
            operation_name="DeleteGenerativeModelCustomProvider",
        )
        assert not delete_result.errors
        assert delete_result.data is not None
        assert delete_result.data["deleteGenerativeModelCustomProvider"]["id"] == anthropic_id

        # Verify delete is idempotent - deleting the same provider again should succeed
        delete_again_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"id": anthropic_id}},
            operation_name="DeleteGenerativeModelCustomProvider",
        )
        assert not delete_again_result.errors
        assert delete_again_result.data is not None

        # Delete non-existent provider (idempotent - should succeed)
        nonexistent_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"id": str(GlobalID("GenerativeModelCustomProvider", "888888"))}},
            operation_name="DeleteGenerativeModelCustomProvider",
        )
        assert not nonexistent_delete_result.errors
        assert nonexistent_delete_result.data is not None
        assert nonexistent_delete_result.data["deleteGenerativeModelCustomProvider"]["id"]
