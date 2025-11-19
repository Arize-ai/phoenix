from secrets import token_hex
from typing import Any

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
            ... on GenerativeModelCustomProviderOpenAI {
              config {
                ... on OpenAICustomProviderConfig {
                  interface
                  supportsStreaming
                  openaiAuthenticationMethod {
                    apiKey {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                  }
                  openaiClientKwargs {
                    baseUrl {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    organization {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    project {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    defaultHeaders
                  }
                }
              }
            }
            ... on GenerativeModelCustomProviderAzureOpenAI {
              config {
                ... on AzureOpenAICustomProviderConfig {
                  interface
                  supportsStreaming
                  azureOpenaiAuthenticationMethod {
                    apiKey {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    azureAdToken {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    azureAdTokenProvider {
                      azureTenantId {
                        ... on StringValue { stringValue }
                        ... on StringValueLookup { stringValueLookupKey }
                      }
                      azureClientId {
                        ... on StringValue { stringValue }
                        ... on StringValueLookup { stringValueLookupKey }
                      }
                      azureClientSecret {
                        ... on StringValue { stringValue }
                        ... on StringValueLookup { stringValueLookupKey }
                      }
                      scope {
                        ... on StringValue { stringValue }
                        ... on StringValueLookup { stringValueLookupKey }
                      }
                    }
                  }
                  azureOpenaiClientKwargs {
                    apiVersion {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    azureEndpoint {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    azureDeployment {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    defaultHeaders
                  }
                }
              }
            }
            ... on GenerativeModelCustomProviderAnthropic {
              config {
                ... on AnthropicCustomProviderConfig {
                  interface
                  supportsStreaming
                  anthropicAuthenticationMethod {
                    apiKey {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                  }
                  anthropicClientKwargs {
                    baseUrl {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    defaultHeaders
                  }
                }
              }
            }
            ... on GenerativeModelCustomProviderAWSBedrock {
              config {
                ... on AWSBedrockCustomProviderConfig {
                  awsBedrockClientInterface
                  supportsStreaming
                  awsBedrockAuthenticationMethod {
                    awsAccessKeyId {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    awsSecretAccessKey {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    awsSessionToken {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                  }
                  awsBedrockClientKwargs {
                    regionName {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                    endpointUrl {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                  }
                }
              }
            }
            ... on GenerativeModelCustomProviderGoogleGenAI {
              config {
                ... on GoogleGenAICustomProviderConfig {
                  interface
                  supportsStreaming
                  googleGenaiAuthenticationMethod {
                    apiKey {
                      ... on StringValue { stringValue }
                      ... on StringValueLookup { stringValueLookupKey }
                    }
                  }
                  googleGenaiClientKwargs {
                    httpOptions {
                      baseUrl {
                        ... on StringValue { stringValue }
                        ... on StringValueLookup { stringValueLookupKey }
                      }
                      headers
                    }
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
          deletedProviderId
        }
      }
    """

    async def test_all_provider_mutations_comprehensive(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Ultra-comprehensive test of all provider mutations to minimize server overhead.

        This single test covers:
        - All provider types (OpenAI, Azure, Anthropic, Google, AWS)
        - All authentication methods (API keys, Azure AD tokens, AWS credentials)
        - Value lookups vs direct values
        - Minimal configurations
        - Error cases (duplicate names, invalid inputs, multiple auth methods)
        - Patch operations (name, description, config)
        - Delete operations (existing and non-existent providers)

        By consolidating all tests into one, we minimize server initialization overhead
        from 20+ test sessions to just 1.
        """

        # ===== CREATE TESTS =====

        # Test 1: Create OpenAI provider with full config
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
                            "openaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "sk-test-key"}
                            },
                            "openaiClientKwargs": {
                                "baseUrl": {"stringValue": "https://api.openai.com/v1"},
                                "organization": {"stringValue": "org-123"},
                                "project": {"stringValue": "proj-456"},
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
        assert config["interface"] == "chat"
        assert config["supportsStreaming"] is True
        assert config["openaiAuthenticationMethod"]["apiKey"]["stringValue"] == "sk-test-key"
        assert config["openaiClientKwargs"]["baseUrl"]["stringValue"] == "https://api.openai.com/v1"
        assert config["openaiClientKwargs"]["organization"]["stringValue"] == "org-123"
        assert config["openaiClientKwargs"]["project"]["stringValue"] == "proj-456"

        # Test 2: Create Azure OpenAI provider with API key
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
                            "azureOpenaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "azure-key-123"}
                            },
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": {"stringValue": "https://test.openai.azure.com"},
                                "azureDeployment": {"stringValue": "gpt-4"},
                                "apiVersion": {"stringValue": "2024-02-15-preview"},
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
        assert azure_config["interface"] == "chat"
        assert (
            azure_config["azureOpenaiAuthenticationMethod"]["apiKey"]["stringValue"]
            == "azure-key-123"
        )
        assert azure_config["azureOpenaiAuthenticationMethod"]["azureAdTokenProvider"] is None
        assert (
            azure_config["azureOpenaiClientKwargs"]["azureEndpoint"]["stringValue"]
            == "https://test.openai.azure.com"
        )
        assert (
            azure_config["azureOpenaiClientKwargs"]["apiVersion"]["stringValue"]
            == "2024-02-15-preview"
        )
        assert azure_config["azureOpenaiClientKwargs"]["azureDeployment"]["stringValue"] == "gpt-4"

        # Test 3: Create Azure OpenAI provider with AD token
        azure_ad_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": f"test-azure-ad-provider-{token_hex(2)}",
                    "provider": "azure",
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {
                                "azureAdToken": {"stringValue": "token-123"}
                            },
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": {"stringValue": "https://test.openai.azure.com"},
                                "azureDeployment": {"stringValue": "gpt-4"},
                                "apiVersion": {"stringValue": "2024-02-15-preview"},
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not azure_ad_result.errors
        assert azure_ad_result.data is not None
        azure_ad_id = azure_ad_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify Azure AD token
        azure_ad_provider = await _fetch_provider_via_node_query(
            gql_client, azure_ad_id, self.QUERY
        )
        assert azure_ad_provider is not None
        assert (
            azure_ad_provider["config"]["azureOpenaiAuthenticationMethod"]["azureAdToken"][
                "stringValue"
            ]
            == "token-123"
        )
        assert (
            azure_ad_provider["config"]["azureOpenaiClientKwargs"]["azureEndpoint"]["stringValue"]
            == "https://test.openai.azure.com"
        )

        # Test 4: Create Azure OpenAI provider with AD token provider
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
                                    "azureTenantId": {"stringValue": "tenant-123"},
                                    "azureClientId": {"stringValue": "client-456"},
                                    "azureClientSecret": {"stringValue": "secret-789"},
                                    "scope": {
                                        "stringValue": "https://cognitiveservices.azure.com/.default"
                                    },
                                },
                            },
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": {"stringValue": "https://test.openai.azure.com"},
                                "azureDeployment": {"stringValue": "gpt-4"},
                                "apiVersion": {"stringValue": "2024-02-15-preview"},
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
        assert token_provider["azureTenantId"]["stringValue"] == "tenant-123"
        assert token_provider["azureClientId"]["stringValue"] == "client-456"
        assert token_provider["azureClientSecret"]["stringValue"] == "secret-789"
        assert (
            token_provider["scope"]["stringValue"] == "https://cognitiveservices.azure.com/.default"
        )

        # Test 5: Create Anthropic provider
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
                            "anthropicAuthenticationMethod": {
                                "apiKey": {"stringValue": "sk-ant-test-key"}
                            },
                            "anthropicClientKwargs": {
                                "baseUrl": {"stringValue": "https://api.anthropic.com"}
                            },
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
        assert anthropic_config["interface"] == "chat"
        assert anthropic_config["supportsStreaming"] is True
        assert (
            anthropic_config["anthropicAuthenticationMethod"]["apiKey"]["stringValue"]
            == "sk-ant-test-key"
        )
        assert (
            anthropic_config["anthropicClientKwargs"]["baseUrl"]["stringValue"]
            == "https://api.anthropic.com"
        )

        # Test 6: Create Google GenAI provider
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
                            "googleGenaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "google-api-key-123"}
                            },
                            "googleGenaiClientKwargs": {
                                "httpOptions": {
                                    "baseUrl": {
                                        "stringValue": "https://generativelanguage.googleapis.com"
                                    },
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
        assert google_config["interface"] == "chat"
        assert google_config["supportsStreaming"] is True
        assert (
            google_config["googleGenaiAuthenticationMethod"]["apiKey"]["stringValue"]
            == "google-api-key-123"
        )
        assert "httpOptions" in google_config["googleGenaiClientKwargs"]
        http_options = google_config["googleGenaiClientKwargs"]["httpOptions"]
        assert http_options["baseUrl"]["stringValue"] == "https://generativelanguage.googleapis.com"
        assert http_options["headers"] == {"X-Custom-Header": "value"}

        # Test 7: Create AWS Bedrock provider
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
                                "awsAccessKeyId": {"stringValue": "AKIAIOSFODNN7EXAMPLE"},
                                "awsSecretAccessKey": {
                                    "stringValue": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                },
                            },
                            "awsBedrockClientKwargs": {"regionName": {"stringValue": "us-east-1"}},
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
        assert aws_config["awsBedrockClientInterface"] == "converse"
        assert aws_config["supportsStreaming"] is True
        assert (
            aws_config["awsBedrockAuthenticationMethod"]["awsAccessKeyId"]["stringValue"]
            == "AKIAIOSFODNN7EXAMPLE"
        )
        assert (
            aws_config["awsBedrockAuthenticationMethod"]["awsSecretAccessKey"]["stringValue"]
            == "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        )
        assert aws_config["awsBedrockAuthenticationMethod"]["awsSessionToken"] is None
        assert aws_config["awsBedrockClientKwargs"]["regionName"]["stringValue"] == "us-east-1"

        # Test 8: Create AWS Bedrock provider with session token
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
                                "awsAccessKeyId": {"stringValue": "AKIAIOSFODNN7EXAMPLE"},
                                "awsSecretAccessKey": {
                                    "stringValue": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                },
                                "awsSessionToken": {"stringValue": "FwoGZXIvYXdzEBYaDExample"},
                            },
                            "awsBedrockClientKwargs": {"regionName": {"stringValue": "us-west-2"}},
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
        assert (
            aws_session_provider["config"]["awsBedrockAuthenticationMethod"]["awsSessionToken"][
                "stringValue"
            ]
            == "FwoGZXIvYXdzEBYaDExample"
        )
        assert (
            aws_session_provider["config"]["awsBedrockClientKwargs"]["regionName"]["stringValue"]
            == "us-west-2"
        )

        # Test 9: Create provider with value lookup keys
        lookup_name = f"test-value-lookup-provider-{token_hex(2)}"
        lookup_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": lookup_name,
                    "description": "Test provider with environment variable lookups",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {
                                "apiKey": {"stringValueLookupKey": "OPENAI_API_KEY"}
                            },
                            "openaiClientKwargs": {
                                "baseUrl": {"stringValueLookupKey": "OPENAI_BASE_URL"},
                                "organization": {"stringValueLookupKey": "OPENAI_ORG"},
                                "project": {"stringValue": "proj-direct-value"},
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not lookup_result.errors
        assert lookup_result.data is not None
        lookup_id = lookup_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify value lookup
        lookup_provider = await _fetch_provider_via_node_query(gql_client, lookup_id, self.QUERY)
        assert lookup_provider is not None
        assert lookup_provider["name"] == lookup_name
        assert lookup_provider["description"] == "Test provider with environment variable lookups"
        assert (
            lookup_provider["config"]["openaiAuthenticationMethod"]["apiKey"][
                "stringValueLookupKey"
            ]
            == "OPENAI_API_KEY"
        )
        assert (
            lookup_provider["config"]["openaiClientKwargs"]["baseUrl"]["stringValueLookupKey"]
            == "OPENAI_BASE_URL"
        )
        assert (
            lookup_provider["config"]["openaiClientKwargs"]["organization"]["stringValueLookupKey"]
            == "OPENAI_ORG"
        )
        assert (
            lookup_provider["config"]["openaiClientKwargs"]["project"]["stringValue"]
            == "proj-direct-value"
        )

        # Test 10: Create provider with minimal config
        minimal_name = f"minimal-provider-{token_hex(2)}"
        minimal_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": minimal_name,
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "sk-minimal-key"}
                            },
                            "openaiClientKwargs": {},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not minimal_result.errors
        assert minimal_result.data is not None
        minimal_id = minimal_result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        # Verify minimal config
        minimal_provider = await _fetch_provider_via_node_query(gql_client, minimal_id, self.QUERY)
        assert minimal_provider is not None
        assert minimal_provider["name"] == minimal_name
        assert minimal_provider["description"] is None
        assert minimal_provider["config"]["openaiClientKwargs"]["baseUrl"] is None
        assert minimal_provider["config"]["openaiClientKwargs"]["organization"] is None
        assert minimal_provider["config"]["openaiClientKwargs"]["project"] is None

        # ===== ERROR CASE TESTS =====

        # Test 11: Create duplicate provider (should fail)
        duplicate_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": openai_name,  # Duplicate name from Test 1
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": {"stringValue": "sk-key"}},
                            "openaiClientKwargs": {},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert duplicate_result.errors is not None
        assert any("already exists" in e.message for e in duplicate_result.errors)

        # Test 12: Create provider with missing client config (should fail)
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

        # Test 13: Create provider with multiple client configs (should fail)
        multiple_config_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": "test-provider",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": {"stringValue": ""}},
                            "openaiClientKwargs": {},
                        },
                        "anthropic": {
                            "anthropicAuthenticationMethod": {"apiKey": {"stringValue": "sk-key"}},
                            "anthropicClientKwargs": {},
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

        # Test 14: Create Azure provider with multiple auth methods (should fail)
        multiple_auth_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": "invalid-azure-provider",
                    "provider": "azure",
                    "clientConfig": {
                        "azureOpenai": {
                            "azureOpenaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "key-123"},
                                "azureAdToken": {"stringValue": "token-456"},
                            },
                            "azureOpenaiClientKwargs": {
                                "azureEndpoint": {"stringValue": "https://test.openai.azure.com"},
                                "azureDeployment": {"stringValue": "gpt-4"},
                                "apiVersion": {"stringValue": "2024-02-15-preview"},
                            },
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert multiple_auth_result.errors is not None

        # Test 15: Create with valid API key (one of the parameterized cases)
        valid_key_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "name": "valid-key-provider",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "non-empty-key"}
                            },
                            "openaiClientKwargs": {},
                        }
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not valid_key_result.errors
        assert valid_key_result.data is not None

        # ===== PATCH/UPDATE TESTS =====

        # Test 16: Patch provider name and description
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

        # Test 17: Patch provider config
        patch_config_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": openai_id,
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {
                                "apiKey": {"stringValue": "sk-updated-key"}
                            },
                            "openaiClientKwargs": {
                                "baseUrl": {"stringValue": "https://updated.openai.com"},
                                "organization": {"stringValue": "updated-org"},
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
        assert (
            updated_config["openaiAuthenticationMethod"]["apiKey"]["stringValue"]
            == "sk-updated-key"
        )
        assert (
            updated_config["openaiClientKwargs"]["baseUrl"]["stringValue"]
            == "https://updated.openai.com"
        )
        assert updated_config["openaiClientKwargs"]["organization"]["stringValue"] == "updated-org"

        # Test 18: Patch with duplicate name (should fail)
        duplicate_patch_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {"id": azure_id, "name": updated_openai_name}
            },  # Name already used in Test 16
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert duplicate_patch_result.errors is not None
        assert any(
            "already exists" in e.message.lower() or "conflict" in e.message.lower()
            for e in duplicate_patch_result.errors
        )

        # Test 19: Patch non-existent provider (should fail)
        nonexistent_patch_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "id": str(GlobalID("GenerativeModelCustomProviderOpenAI", "999999")),
                    "name": "new-name",
                }
            },
            operation_name="PatchGenerativeModelCustomProvider",
        )
        assert nonexistent_patch_result.errors is not None
        assert any("not found" in e.message.lower() for e in nonexistent_patch_result.errors)

        # ===== DELETE TESTS =====

        # Test 20: Delete provider
        delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"id": anthropic_id}},
            operation_name="DeleteGenerativeModelCustomProvider",
        )
        assert not delete_result.errors
        assert delete_result.data is not None
        assert (
            delete_result.data["deleteGenerativeModelCustomProvider"]["deletedProviderId"]
            == anthropic_id
        )

        # Test 21: Delete non-existent provider (idempotent - should succeed)
        nonexistent_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {"id": str(GlobalID("GenerativeModelCustomProviderOpenAI", "888888"))}
            },
            operation_name="DeleteGenerativeModelCustomProvider",
        )
        assert not nonexistent_delete_result.errors
        assert nonexistent_delete_result.data is not None
        assert nonexistent_delete_result.data["deleteGenerativeModelCustomProvider"][
            "deletedProviderId"
        ]
