from secrets import token_hex
from typing import Any

from pydantic import SecretStr
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.mutations.generative_model_custom_provider_mutations import (
    _redact_provider_error,
)
from phoenix.server.encryption import EncryptionService
from phoenix.server.redaction import Redactor
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

# Matches the redactor the test `app` fixture constructs: create_app is called
# without a secret, so the server-side Redactor is keyed off SecretStr("").
_REDACTOR = Redactor(secret=SecretStr(""))
_REDACTED_PREFIX = "\ue000REDACTED\ue000"


def _assert_redacted_equals(value: Any, expected: str) -> None:
    """Assert a RedactedString field was actually redacted on the wire AND un-redacts
    to the expected plaintext. Catches both missing-redaction regressions and
    key-mismatch regressions in a single line.
    """
    assert isinstance(value, str), f"expected str, got {type(value).__name__}: {value!r}"
    assert value.startswith(_REDACTED_PREFIX), f"field was not redacted on output: {value!r}"
    assert _REDACTOR.unredact(value) == expected, (
        f"redacted value did not round-trip to {expected!r}"
    )


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

    async def test_test_credentials_is_a_mutation_not_a_query(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Security regression: testGenerativeModelCustomProviderCredentials must be a
        mutation, not a query field. The
        resolver makes user-controlled outbound HTTP requests, which is an SSRF vector
        if exposed through the Query surface.
        """
        introspection = """
          query SchemaShape {
            queryType: __type(name: "Query") { fields { name } }
            mutationType: __type(name: "Mutation") { fields { name } }
          }
        """
        result = await gql_client.execute(query=introspection)
        assert not result.errors
        assert result.data is not None

        query_field_names = {f["name"] for f in result.data["queryType"]["fields"]}
        mutation_field_names = {f["name"] for f in result.data["mutationType"]["fields"]}

        assert "testGenerativeModelCustomProviderCredentials" not in query_field_names, (
            "testGenerativeModelCustomProviderCredentials must not be exposed as a Query "
            "field — it triggers user-controlled outbound HTTP and would be reachable "
            "without authentication."
        )
        assert "testGenerativeModelCustomProviderCredentials" in mutation_field_names

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
        _assert_redacted_equals(config["openaiAuthenticationMethod"]["apiKey"], "sk-test-key")
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
        _assert_redacted_equals(
            azure_config["azureOpenaiAuthenticationMethod"]["apiKey"], "azure-key-123"
        )
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
        _assert_redacted_equals(token_provider["azureClientSecret"], "secret-789")
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
        _assert_redacted_equals(
            anthropic_config["anthropicAuthenticationMethod"]["apiKey"], "sk-ant-test-key"
        )
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
        _assert_redacted_equals(
            google_config["googleGenaiAuthenticationMethod"]["apiKey"], "google-api-key-123"
        )
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
        _assert_redacted_equals(
            access_keys["awsSecretAccessKey"], "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        )
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
        _assert_redacted_equals(access_keys["awsSessionToken"], "FwoGZXIvYXdzEBYaDExample")
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
        assert missing_config_result.data is None

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
        assert multiple_config_result.data is None

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
        _assert_redacted_equals(
            updated_config["openaiAuthenticationMethod"]["apiKey"], "sk-updated-key"
        )
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
        _assert_redacted_equals(
            switched_config["azureOpenaiAuthenticationMethod"]["apiKey"], "azure-key-compat"
        )
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

    async def test_redacted_token_echo_preserves_secret(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        """A redacted apiKey — sent on create, or echoed back on patch — must
        un-redact to the original plaintext in the DB, not persist as [REDACTED]...

        The `app` fixture builds create_app without a secret, so the server's
        EncryptionService and Redactor are both keyed off SecretStr("").
        """
        encryption = EncryptionService(secret=SecretStr(""))

        async def stored_api_key(provider_id: str) -> str:
            rowid = int(GlobalID.from_id(provider_id).node_id)
            async with db() as session:
                blob = await session.scalar(
                    select(models.GenerativeModelCustomProvider.config).where(
                        models.GenerativeModelCustomProvider.id == rowid
                    )
                )
            assert blob is not None
            config = mp.OpenAICustomProviderConfig.model_validate_json(encryption.decrypt(blob))
            assert isinstance(config.openai_authentication_method, mp.AuthenticationMethodApiKey)
            return config.openai_authentication_method.api_key

        secret = token_hex(16)

        # Create with a client-redacted apiKey — server's parse_value must un-redact.
        created = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": f"test-redact-roundtrip-{token_hex(2)}",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": _REDACTOR.redact(secret)},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not created.errors
        assert created.data is not None
        provider_id = created.data["createGenerativeModelCustomProvider"]["provider"]["id"]
        assert await stored_api_key(provider_id) == secret

        # Echo the server-emitted redacted token back on patch — DB must still hold plaintext.
        read_back = await _fetch_provider_via_node_query(gql_client, provider_id, self.QUERY)
        echoed = read_back["config"]["openaiAuthenticationMethod"]["apiKey"]
        patched = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": provider_id,
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": echoed},
                        }
                    },
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert not patched.errors
        assert await stored_api_key(provider_id) == secret

    async def test_stale_redacted_token_surfaces_user_facing_error(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """A redacted token from a different redactor must produce a user-facing
        error, not the generic 'an unexpected error occurred' mask.
        """
        # Token minted by a DIFFERENT redactor, so the server's Fernet can't decrypt it.
        other_redactor = Redactor(secret=SecretStr("different-secret-than-server"))
        stale_token = other_redactor.redact("sk-original")

        result = await gql_client.execute(
            query="""
            mutation Create($input: CreateGenerativeModelCustomProviderMutationInput!) {
                createGenerativeModelCustomProvider(input: $input) { provider { id } }
            }
            """,
            variables={
                "input": {
                    "name": f"test-stale-{token_hex(4)}",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": stale_token},
                        }
                    },
                }
            },
            operation_name="Create",
        )
        assert result.errors, "expected a GraphQL error for a stale redacted token"
        assert len(result.errors) == 1
        message = result.errors[0].message
        # Must be the clean inner message — not the generic mask, and not the
        # graphql-core "Variable '$input' got invalid value ..." prefix that
        # leaks the raw submitted token and variable path.
        assert message == (
            "Invalid redacted string. Please fetch the correct redacted value from the server."
        ), message


class TestRedactProviderError:
    """Upstream LLM providers can echo the rejected credential back in error
    messages (e.g. OpenAI's "Incorrect API key provided: <key>"). The
    test-credentials mutation must scrub those secrets before returning the
    error to the client.
    """

    def test_openai_api_key_is_scrubbed(self) -> None:
        api_key = "sk-super-secret-1234567890"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.OpenAICustomProviderConfig(
                openai_authentication_method=mp.AuthenticationMethodApiKey(api_key=api_key),
            )
        )
        error = Exception(
            f"Error code: 401 - {{'error': {{'message': "
            f"'Incorrect API key provided: {api_key}.'}}}}"
        )

        result = _redact_provider_error(error, config)

        assert api_key not in result
        assert "[REDACTED]" in result
        # Diagnostic detail around the key is preserved.
        assert "401" in result
        assert "Incorrect API key provided" in result

    def test_anthropic_api_key_is_scrubbed(self) -> None:
        api_key = "sk-ant-abcdefg1234567890"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.AnthropicCustomProviderConfig(
                anthropic_authentication_method=mp.AuthenticationMethodApiKey(api_key=api_key),
            )
        )
        error = Exception(f"authentication_error: invalid x-api-key {api_key}")

        result = _redact_provider_error(error, config)

        assert api_key not in result
        assert "[REDACTED]" in result

    def test_google_genai_api_key_is_scrubbed(self) -> None:
        api_key = "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.GoogleGenAICustomProviderConfig(
                google_genai_authentication_method=mp.AuthenticationMethodApiKey(api_key=api_key),
            )
        )
        error = Exception(f"API key not valid. Please pass a valid API key. key={api_key}")

        result = _redact_provider_error(error, config)

        assert api_key not in result
        assert "[REDACTED]" in result

    def test_azure_openai_api_key_is_scrubbed(self) -> None:
        api_key = "azure-secret-key-xyz"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.AzureOpenAICustomProviderConfig(
                azure_openai_authentication_method=mp.AuthenticationMethodApiKey(api_key=api_key),
                azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(
                    azure_endpoint="https://test.openai.azure.com",
                ),
            )
        )
        error = Exception(f"Access denied due to invalid subscription key {api_key}")

        result = _redact_provider_error(error, config)

        assert api_key not in result
        assert "[REDACTED]" in result

    def test_azure_ad_token_provider_client_secret_is_scrubbed(self) -> None:
        client_secret = "azure-client-secret-zzz"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.AzureOpenAICustomProviderConfig(
                azure_openai_authentication_method=mp.AuthenticationMethodAzureADTokenProvider(
                    azure_tenant_id="tenant",
                    azure_client_id="client",
                    azure_client_secret=client_secret,
                ),
                azure_openai_client_kwargs=mp.AzureOpenAIClientKwargs(
                    azure_endpoint="https://test.openai.azure.com",
                ),
            )
        )
        error = Exception(f"AADSTS7000215: Invalid client secret provided: {client_secret}")

        result = _redact_provider_error(error, config)

        assert client_secret not in result
        assert "[REDACTED]" in result
        # Non-secret identifiers may remain in the message.
        assert "AADSTS7000215" in result

    def test_aws_bedrock_secret_and_session_token_are_scrubbed(self) -> None:
        secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        session_token = "FwoGZXIvYXdzEFAKE1234567890SESSIONTOKEN"
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.AWSBedrockCustomProviderConfig(
                aws_bedrock_authentication_method=mp.AWSBedrockAuthenticationMethodAccessKeys(
                    aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
                    aws_secret_access_key=secret_access_key,
                    aws_session_token=session_token,
                ),
                aws_bedrock_client_kwargs=mp.AWSBedrockClientKwargs(region_name="us-east-1"),
            )
        )
        error = Exception(
            f"InvalidSignatureException: signature mismatch using secret={secret_access_key} "
            f"token={session_token}"
        )

        result = _redact_provider_error(error, config)

        assert secret_access_key not in result
        assert session_token not in result
        assert result.count("[REDACTED]") == 2

    def test_default_credentials_have_no_secrets_to_scrub(self) -> None:
        """Default-credential auth methods carry no user-supplied secrets;
        the helper must not crash and must pass the message through unchanged.
        """
        config = mp.GenerativeModelCustomerProviderConfig(
            root=mp.AWSBedrockCustomProviderConfig(
                aws_bedrock_authentication_method=mp.AuthenticationMethodDefaultCredentials(),
                aws_bedrock_client_kwargs=mp.AWSBedrockClientKwargs(region_name="us-east-1"),
            )
        )
        error = Exception("NoCredentialsError: Unable to locate credentials")

        result = _redact_provider_error(error, config)

        assert result == "NoCredentialsError: Unable to locate credentials"
