import re
from datetime import datetime, timezone
from typing import Any, Optional

import pytest
import sqlalchemy as sa
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.GenerativeModel import GenerativeModel
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestModelMutations:
    QUERY = """
      mutation CreateModelMutation($input: CreateModelMutationInput!) {
        createModel(input: $input) {
          model {
            id
            name
            provider
            namePattern
            kind
            modelType
            createdAt
            updatedAt
            tokenPrices {
              tokenType
              kind
              costPerToken
              costPerMillionTokens
            }
          }
        }
      }

      mutation UpdateModelMutation($input: UpdateModelMutationInput!) {
        updateModel(input: $input) {
          model {
            id
            name
            provider
            namePattern
            kind
            modelType
            createdAt
            updatedAt
            tokenPrices {
              tokenType
              kind
              costPerToken
              costPerMillionTokens
            }
          }
        }
      }

      mutation DeleteModelMutation($input: DeleteModelMutationInput!) {
        deleteModel(input: $input) {
          model {
            id
            name
            provider
            namePattern
            kind
            createdAt
            updatedAt
          }
        }
      }
    """

    async def test_model_crud_happy_path(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Create model
        create_variables = {
            "input": {
                "name": "test-model",
                "provider": "openai",
                "namePattern": "gpt-*",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 0.001 * 1_000_000,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 0.002 * 1_000_000,
                    },
                ],
            }
        }
        create_result = await gql_client.execute(
            query=self.QUERY,
            variables=create_variables,
            operation_name="CreateModelMutation",
        )
        assert not create_result.errors
        assert create_result.data is not None

        created_model = create_result.data["createModel"]["model"]
        model_id = created_model.pop("id")
        assert created_model.pop("name") == "test-model"
        assert created_model.pop("provider") == "openai"
        assert created_model.pop("namePattern") == "gpt-*"
        assert created_model.pop("kind") == "CUSTOM"
        assert created_model.pop("modelType") == "LLM"
        assert isinstance(created_model.pop("createdAt"), str)
        assert isinstance(created_model.pop("updatedAt"), str)
        token_prices = created_model.pop("tokenPrices")
        assert token_prices == [
            {
                "tokenType": "input",
                "kind": "PROMPT",
                "costPerToken": 0.001,
                "costPerMillionTokens": 0.001 * 1_000_000,
            },
            {
                "tokenType": "output",
                "kind": "COMPLETION",
                "costPerToken": 0.002,
                "costPerMillionTokens": 0.002 * 1_000_000,
            },
        ]
        assert not created_model

        # Update model
        update_variables = {
            "input": {
                "id": model_id,
                "name": "updated-test-model",
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 0.003 * 1_000_000,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 0.004 * 1_000_000,
                    },
                ],
            }
        }
        update_result = await gql_client.execute(
            query=self.QUERY,
            variables=update_variables,
            operation_name="UpdateModelMutation",
        )
        assert not update_result.errors
        assert update_result.data is not None

        updated_model = update_result.data["updateModel"]["model"]
        model_id = updated_model.pop("id")
        assert updated_model.pop("name") == "updated-test-model"
        assert updated_model.pop("provider") == "anthropic"
        assert updated_model.pop("namePattern") == "claude-*"
        assert updated_model.pop("kind") == "CUSTOM"
        assert updated_model.pop("modelType") == "LLM"
        assert isinstance(updated_model.pop("createdAt"), str)
        assert isinstance(updated_model.pop("updatedAt"), str)
        token_prices = updated_model.pop("tokenPrices")
        assert token_prices == [
            {
                "tokenType": "input",
                "kind": "PROMPT",
                "costPerToken": 0.003,
                "costPerMillionTokens": 0.003 * 1_000_000,
            },
            {
                "tokenType": "output",
                "kind": "COMPLETION",
                "costPerToken": 0.004,
                "costPerMillionTokens": 0.004 * 1_000_000,
            },
        ]

        # Delete model
        delete_variables = {
            "input": {
                "id": model_id,
            }
        }
        delete_result = await gql_client.execute(
            query=self.QUERY,
            variables=delete_variables,
            operation_name="DeleteModelMutation",
        )
        assert not delete_result.errors
        assert delete_result.data is not None

        deleted_model = delete_result.data["deleteModel"]["model"]
        assert deleted_model.pop("id") == model_id
        assert deleted_model.pop("name") == "updated-test-model"
        assert deleted_model.pop("provider") == "anthropic"
        assert deleted_model.pop("namePattern") == "claude-*"
        assert deleted_model.pop("kind") == "CUSTOM"
        assert isinstance(deleted_model.pop("createdAt"), str)
        assert isinstance(deleted_model.pop("updatedAt"), str)
        assert not deleted_model

    @pytest.mark.parametrize(
        "variables,expected_error_message",
        [
            pytest.param(
                {
                    "input": {
                        "name": "test-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "input cost is required",
                id="missing-input-cost",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "test-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                        ],
                    }
                },
                "output cost is required",
                id="missing-output-cost",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "custom-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "Model with name 'custom-model' already exists",
                id="duplicate-custom-model",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "test-model",
                        "provider": "openai",
                        "namePattern": "[",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "Invalid regex: unterminated character set at position 0",
                id="invalid-regex",
            ),
        ],
    )
    async def test_create_model_with_invalid_input_raises_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_error_message: str,
        custom_model: models.GenerativeModel,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="CreateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == expected_error_message
        assert result.data is None

    @pytest.mark.parametrize(
        "provider_input",
        [
            pytest.param({"provider": None}, id="explicit-null-provider"),
            pytest.param({}, id="omitted-provider"),
            pytest.param({"provider": ""}, id="empty-string-provider"),
        ],
    )
    async def test_create_model_without_provider_succeeds(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        provider_input: dict[str, Any],
        custom_model: models.GenerativeModel,
    ) -> None:
        """
        A null or omitted provider is a provider-agnostic model, not a conflict.

        Regression test for a bug where any name failed with "Model with name 'X'
        already exists" whenever the provider was null, because the non-nullable
        column raised an IntegrityError that was reported as a name conflict.
        """
        variables = {
            "input": {
                "name": "provider-agnostic-model",
                "namePattern": "^provider-agnostic-model$",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 1.0,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 2.0,
                    },
                ],
                **provider_input,
            }
        }
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        model = result.data["createModel"]["model"]
        assert model["name"] == "provider-agnostic-model"
        # A provider-agnostic model reads back as null (`provider or None`) and is
        # stored as the empty string the non-nullable column requires.
        assert model["provider"] is None
        async with db() as session:
            stored_provider = await session.scalar(
                sa.select(models.GenerativeModel.provider).where(
                    models.GenerativeModel.name == "provider-agnostic-model"
                )
            )
        assert stored_provider == ""

    async def test_create_model_reusing_name_pattern_reports_pattern_conflict(
        self,
        gql_client: AsyncGraphQLClient,
        custom_model: models.GenerativeModel,
    ) -> None:
        """
        A duplicate (name_pattern, provider) is reported as such rather than as a
        name conflict, which is what the blanket IntegrityError handler produced.
        """
        variables = {
            "input": {
                "name": "a-name-that-does-not-exist",
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 1.0,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 2.0,
                    },
                ],
            }
        }
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="CreateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == (
            "Model 'custom-model' already uses name pattern 'claude-*' with provider 'anthropic'"
        )
        assert result.data is None

    async def test_updating_model_to_its_own_values_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        custom_model: models.GenerativeModel,
    ) -> None:
        """The conflict pre-check must not treat a model as conflicting with itself."""
        variables = {
            "input": {
                "id": str(GlobalID(GenerativeModel.__name__, str(custom_model.id))),
                "name": "custom-model",
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 5.0,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 6.0,
                    },
                ],
            }
        }
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["updateModel"]["model"]["name"] == "custom-model"

    @pytest.mark.parametrize(
        "variables,expected_error_message",
        [
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(999))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                f'Model "{str(GlobalID(GenerativeModel.__name__, str(999)))}" not found',
                id="non-existent-model",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID("Project", str(1))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                f'Invalid model id: "{str(GlobalID("Project", str(1)))}"',
                id="invalid-global-id",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(1))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "input cost is required",
                id="missing-input-cost",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(1))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                        ],
                    }
                },
                "output cost is required",
                id="missing-output-cost",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(1))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "[",
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "Invalid regex: unterminated character set at position 0",
                id="invalid-regex",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(1))),
                        "name": "updated-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "modelType": None,
                        "costs": [
                            {
                                "tokenType": "input",
                                "kind": "PROMPT",
                                "costPerMillionTokens": 0.001 * 1_000_000,
                            },
                            {
                                "tokenType": "output",
                                "kind": "COMPLETION",
                                "costPerMillionTokens": 0.002 * 1_000_000,
                            },
                        ],
                    }
                },
                "modelType cannot be null",
                id="null-model-type",
            ),
        ],
    )
    async def test_updating_model_with_invalid_input_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_error_message: str,
        custom_model: models.GenerativeModel,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == expected_error_message
        assert result.data is None

    async def test_updating_default_model_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        default_model: models.GenerativeModel,
    ) -> None:
        model_id = str(GlobalID(GenerativeModel.__name__, str(default_model.id)))
        variables = {
            "input": {
                "id": model_id,
                "name": "updated-default-model",
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {
                        "tokenType": "input",
                        "kind": "PROMPT",
                        "costPerMillionTokens": 0.003 * 1_000_000,
                    },
                    {
                        "tokenType": "output",
                        "kind": "COMPLETION",
                        "costPerMillionTokens": 0.004 * 1_000_000,
                    },
                ],
            }
        }

        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == "Cannot update built-in model"
        assert result.data is None

    @pytest.mark.parametrize(
        "variables,expected_error_message",
        [
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID(GenerativeModel.__name__, str(999))),
                    }
                },
                f'Model "{str(GlobalID(GenerativeModel.__name__, str(999)))}" not found',
                id="non-existent-model",
            ),
            pytest.param(
                {
                    "input": {
                        "id": str(GlobalID("Project", str(1))),
                    }
                },
                f'Invalid model id: "{str(GlobalID("Project", str(1)))}"',
                id="invalid-global-id",
            ),
        ],
    )
    async def test_deleting_model_with_invalid_input_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_error_message: str,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="DeleteModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == expected_error_message
        assert result.data is None

    async def test_deleting_default_model_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        default_model: models.GenerativeModel,
    ) -> None:
        model_id = str(GlobalID(GenerativeModel.__name__, str(default_model.id)))
        variables = {
            "input": {
                "id": model_id,
            }
        }
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="DeleteModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == "Cannot delete built-in model"
        assert result.data is None

    @pytest.mark.parametrize(
        "provider,expected_stored_provider",
        [
            pytest.param("OpenAI", "openai", id="known-provider-is-lowercased"),
            pytest.param("Meta", "meta", id="form-preset-meta"),
            pytest.param("ZAI", "zai", id="form-preset-zai"),
            pytest.param("Groq", "groq", id="playground-provider-is-lowercased"),
            pytest.param(" AcmeAI  ", "AcmeAI", id="custom-provider-keeps-case-and-is-trimmed"),
            pytest.param("   ", "", id="whitespace-only-provider-is-provider-agnostic"),
        ],
    )
    async def test_create_model_normalizes_provider(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        provider: str,
        expected_stored_provider: str,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider=provider),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        async with db() as session:
            stored_provider = await session.scalar(
                sa.select(models.GenerativeModel.provider).where(
                    models.GenerativeModel.name == "my-model"
                )
            )
        assert stored_provider == expected_stored_provider

    async def test_create_model_normalizes_token_types(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Known token types are lowercased so `Input` satisfies the input requirement."""
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                costs=[
                    ("Input", "PROMPT"),
                    (" CacheRead ", "PROMPT"),
                    ("Cache_Write", "PROMPT"),
                    ("OUTPUT", "COMPLETION"),
                ]
            ),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        token_types = {
            (price["tokenType"], price["kind"])
            for price in result.data["createModel"]["model"]["tokenPrices"]
        }
        assert token_types == {
            ("input", "PROMPT"),
            ("CacheRead", "PROMPT"),
            ("cache_write", "PROMPT"),
            ("output", "COMPLETION"),
        }

    @pytest.mark.parametrize(
        "costs,model_type,expected_error_message",
        [
            pytest.param(
                [("input", "PROMPT"), ("Cache_Read", "PROMPT"), ("cache_read", "PROMPT")],
                None,
                "Duplicate prompt token type 'cache_read'",
                id="known-token-type-differing-in-case",
            ),
            pytest.param(
                [("input", "PROMPT"), ("CacheRead", "PROMPT"), ("cacheread", "PROMPT")],
                None,
                "Duplicate prompt token type 'cacheread'",
                id="custom-token-type-differing-in-case",
            ),
            pytest.param(
                [("input", "PROMPT"), ("output", "COMPLETION"), ("Output", "COMPLETION")],
                None,
                "Duplicate completion token type 'output'",
                id="completion-side",
            ),
            pytest.param(
                [("input", "PROMPT"), ("", "PROMPT"), ("output", "COMPLETION")],
                None,
                "token type is required",
                id="empty-token-type",
            ),
            pytest.param(
                [("input", "PROMPT"), ("output", "COMPLETION"), ("   ", "COMPLETION")],
                None,
                "token type is required",
                id="whitespace-only-token-type",
            ),
            pytest.param(
                [("input", "COMPLETION"), ("output", "COMPLETION")],
                None,
                "input cost is required",
                id="input-marked-as-completion",
            ),
            pytest.param(
                [("input", "PROMPT"), ("output", "PROMPT")],
                None,
                "output cost is required",
                id="output-marked-as-prompt",
            ),
            pytest.param(
                [("input", "PROMPT"), ("reasoning", "COMPLETION")],
                "EMBEDDING",
                "output cost is required",
                id="embedding-completion-without-output-fallback",
            ),
        ],
    )
    async def test_create_model_with_invalid_token_types_fails(
        self,
        gql_client: AsyncGraphQLClient,
        costs: list[tuple[str, str]],
        model_type: Optional[str],
        expected_error_message: str,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(costs=costs, model_type=model_type),
            operation_name="CreateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == expected_error_message
        assert result.data is None

    async def test_create_model_with_same_token_type_on_both_sides_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                costs=[
                    ("input", "PROMPT"),
                    ("audio", "PROMPT"),
                    ("output", "COMPLETION"),
                    ("audio", "COMPLETION"),
                ]
            ),
            operation_name="CreateModelMutation",
        )
        assert not result.errors

    async def test_create_model_with_case_only_provider_collision_fails(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        first = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(name="first-model", provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert not first.errors
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(name="second-model", provider="acmeai"),
            operation_name="CreateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == (
            "Model 'first-model' already uses name pattern '^my-model$' with provider 'AcmeAI'"
        )
        assert result.data is None

    async def test_update_model_with_case_only_provider_collision_fails(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        first = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(name="first-model", provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert not first.errors
        second = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                name="second-model", provider="acmeai", name_pattern="^other-model$"
            ),
            operation_name="CreateModelMutation",
        )
        assert second.data is not None
        variables = _create_model_variables(name="second-model", provider="acmeai")
        variables["input"]["id"] = second.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == (
            "Model 'first-model' already uses name pattern '^my-model$' with provider 'AcmeAI'"
        )
        assert result.data is None

    async def test_update_model_changing_only_its_provider_case_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """The collision check must not treat a model as colliding with itself."""
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider="acmeai"),
            operation_name="CreateModelMutation",
        )
        assert created.data is not None
        variables = _create_model_variables(provider="AcmeAI")
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["updateModel"]["model"]["provider"] == "AcmeAI"

    @pytest.mark.parametrize(
        "provider,expected_stored_provider",
        [
            pytest.param("OpenAI", "openai", id="known-provider-is-lowercased"),
            pytest.param("   ", "", id="whitespace-only-provider-is-provider-agnostic"),
        ],
    )
    async def test_update_model_normalizes_provider(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        provider: str,
        expected_stored_provider: str,
    ) -> None:
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert created.data is not None
        variables = _create_model_variables(provider=provider)
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert not result.errors
        async with db() as session:
            stored_provider = await session.scalar(
                sa.select(models.GenerativeModel.provider).where(
                    models.GenerativeModel.name == "my-model"
                )
            )
        assert stored_provider == expected_stored_provider

    async def test_update_model_normalizes_token_types(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(),
            operation_name="CreateModelMutation",
        )
        assert created.data is not None
        variables = _create_model_variables(
            costs=[("Input", "PROMPT"), (" CacheRead ", "PROMPT"), ("OUTPUT", "COMPLETION")]
        )
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        token_types = {
            (price["tokenType"], price["kind"])
            for price in result.data["updateModel"]["model"]["tokenPrices"]
        }
        assert token_types == {
            ("input", "PROMPT"),
            ("CacheRead", "PROMPT"),
            ("output", "COMPLETION"),
        }

    async def test_update_model_with_duplicate_token_types_fails(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(),
            operation_name="CreateModelMutation",
        )
        assert created.data is not None
        variables = _create_model_variables(
            costs=[("input", "PROMPT"), ("CacheRead", "PROMPT"), ("cacheread", "PROMPT")]
        )
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == "Duplicate prompt token type 'cacheread'"
        assert result.data is None

    @pytest.mark.parametrize(
        "is_built_in,is_deleted",
        [
            pytest.param(True, False, id="built-in-model"),
            pytest.param(False, True, id="soft-deleted-custom-model"),
        ],
    )
    async def test_create_model_ignores_built_in_and_deleted_models_for_provider_collision(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        is_built_in: bool,
        is_deleted: bool,
    ) -> None:
        async with db() as session:
            session.add(
                models.GenerativeModel(
                    name="existing-model",
                    provider="AcmeAI",
                    name_pattern=re.compile("^my-model$"),
                    is_built_in=is_built_in,
                    deleted_at=datetime.now(timezone.utc) if is_deleted else None,
                    token_prices=[],
                )
            )
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider="acmeai"),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["createModel"]["model"]["provider"] == "acmeai"

    @pytest.mark.parametrize("model_type", ["DECISION", "EMBEDDING"])
    async def test_create_model_sets_model_type(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        model_type: str,
    ) -> None:
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(model_type=model_type),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        model = result.data["createModel"]["model"]
        assert model["modelType"] == model_type
        assert model["kind"] == "CUSTOM"
        expected_tokens = ["input"] if model_type == "EMBEDDING" else ["input", "output"]
        assert [p["tokenType"] for p in model["tokenPrices"]] == expected_tokens
        async with db() as session:
            stored_type = await session.scalar(
                sa.select(models.GenerativeModel.type).where(
                    models.GenerativeModel.name == "my-model"
                )
            )
        assert stored_type == model_type

    async def test_update_model_input_only_embedding_costs(
        self,
        gql_client: AsyncGraphQLClient,
        custom_model: models.GenerativeModel,
    ) -> None:
        model_id = str(GlobalID(GenerativeModel.__name__, str(custom_model.id)))

        # Switching LLM -> EMBEDDING accepts input-only costs and drops the prior output price.
        to_embedding = _create_model_variables(
            model_type="EMBEDDING",
            costs=[("input", "PROMPT")],
        )
        to_embedding["input"]["id"] = model_id
        switched = await gql_client.execute(
            query=self.QUERY,
            variables=to_embedding,
            operation_name="UpdateModelMutation",
        )
        assert not switched.errors
        assert switched.data is not None
        assert switched.data["updateModel"]["model"]["modelType"] == "EMBEDDING"
        assert [p["tokenType"] for p in switched.data["updateModel"]["model"]["tokenPrices"]] == [
            "input"
        ]

        # Omitting modelType keeps the stored EMBEDDING type before validating costs.
        keep_embedding = _create_model_variables(costs=[("input", "PROMPT")])
        keep_embedding["input"]["id"] = model_id
        kept = await gql_client.execute(
            query=self.QUERY,
            variables=keep_embedding,
            operation_name="UpdateModelMutation",
        )
        assert not kept.errors
        assert kept.data is not None
        assert kept.data["updateModel"]["model"]["modelType"] == "EMBEDDING"

        # Switching EMBEDDING -> DECISION without an output price is rejected.
        to_decision = _create_model_variables(
            model_type="DECISION",
            costs=[("input", "PROMPT")],
        )
        to_decision["input"]["id"] = model_id
        rejected = await gql_client.execute(
            query=self.QUERY,
            variables=to_decision,
            operation_name="UpdateModelMutation",
        )
        assert len(rejected.errors) == 1
        assert rejected.errors[0].message == "output cost is required"

    async def test_create_model_with_same_name_and_different_type_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Type is part of both unique indexes, so one name can be priced per span kind."""
        first = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert not first.errors
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(provider="AcmeAI", model_type="DECISION"),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["createModel"]["model"]["modelType"] == "DECISION"

    async def test_create_model_with_case_only_provider_difference_and_different_type_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Spans are only priced by models of their own type, so the spellings can't compete."""
        first = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(name="first-model", provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert not first.errors
        result = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                name="second-model", provider="acmeai", model_type="EMBEDDING"
            ),
            operation_name="CreateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["createModel"]["model"]["provider"] == "acmeai"

    @pytest.mark.parametrize(
        "initial_provider,initial_type,update_provider,update_type,rejected",
        [
            pytest.param("acmeai", "DECISION", "acmeai", "LLM", True, id="type-into-collision"),
            pytest.param("other", "LLM", "acmeai", "EMBEDDING", False, id="type-away"),
        ],
    )
    async def test_update_model_checks_case_only_provider_collision_in_new_type(
        self,
        gql_client: AsyncGraphQLClient,
        initial_provider: str,
        initial_type: str,
        update_provider: str,
        update_type: str,
        rejected: bool,
    ) -> None:
        existing = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(name="first-model", provider="AcmeAI"),
            operation_name="CreateModelMutation",
        )
        assert not existing.errors
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                name="second-model", provider=initial_provider, model_type=initial_type
            ),
            operation_name="CreateModelMutation",
        )
        assert not created.errors
        assert created.data is not None
        variables = _create_model_variables(
            name="second-model", provider=update_provider, model_type=update_type
        )
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        if rejected:
            assert result.errors
            assert "already uses name pattern" in result.errors[0].message
        else:
            assert not result.errors

    @pytest.mark.parametrize(
        "update_kwargs,expected_error_message",
        [
            pytest.param(
                {"name": "custom-model", "name_pattern": "^other$", "model_type": "LLM"},
                "Model with name 'custom-model' already exists",
                id="name-conflict-in-target-type",
            ),
            pytest.param(
                {
                    "name": "other-name",
                    "provider": "anthropic",
                    "name_pattern": "claude-*",
                    "model_type": "LLM",
                },
                "Model 'custom-model' already uses name pattern 'claude-*' with provider 'anthropic'",
                id="pattern-conflict-in-target-type",
            ),
        ],
    )
    async def test_update_model_into_unique_index_conflict_preserves_existing_row(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        custom_model: models.GenerativeModel,
        update_kwargs: dict[str, Any],
        expected_error_message: str,
    ) -> None:
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(
                name="custom-model",
                provider="openai",
                name_pattern="^other$",
                model_type="DECISION",
            ),
            operation_name="CreateModelMutation",
        )
        assert not created.errors
        assert created.data is not None
        decision_id = created.data["createModel"]["model"]["id"]

        variables = _create_model_variables(**update_kwargs)
        variables["input"]["id"] = decision_id
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == expected_error_message
        assert result.data is None

        # The savepoint rollback keeps the DECISION model's type and token prices intact.
        node_rowid = int(GlobalID.from_id(decision_id).node_id)
        async with db() as session:
            preserved = await session.scalar(
                sa.select(models.GenerativeModel)
                .where(models.GenerativeModel.id == node_rowid)
                .options(sa.orm.joinedload(models.GenerativeModel.token_prices))
            )
            assert preserved is not None
            assert preserved.type == "DECISION"
            assert {p.token_type for p in preserved.token_prices} == {"input", "output"}

    @pytest.mark.parametrize(
        "model_type_input,expected_model_type",
        [
            pytest.param({}, "DECISION", id="omitted-keeps-stored-type"),
            pytest.param({"modelType": "EMBEDDING"}, "EMBEDDING", id="changes-type"),
        ],
    )
    async def test_update_model_model_type(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        model_type_input: dict[str, Any],
        expected_model_type: str,
    ) -> None:
        created = await gql_client.execute(
            query=self.QUERY,
            variables=_create_model_variables(model_type="DECISION"),
            operation_name="CreateModelMutation",
        )
        assert created.data is not None
        variables = _create_model_variables()
        variables["input"]["id"] = created.data["createModel"]["model"]["id"]
        variables["input"].update(model_type_input)
        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["updateModel"]["model"]["modelType"] == expected_model_type
        async with db() as session:
            stored_type = await session.scalar(
                sa.select(models.GenerativeModel.type).where(
                    models.GenerativeModel.name == "my-model"
                )
            )
        assert stored_type == expected_model_type


class TestGenerativeModelModelType:
    LIST_QUERY = """
      query {
        generativeModels {
          edges {
            node {
              name
              kind
              modelType
            }
          }
        }
      }
    """
    NODE_QUERY = """
      query ($id: ID!) {
        node(id: $id) {
          ... on GenerativeModel {
            name
            kind
            modelType
          }
        }
      }
    """

    async def test_generative_models_query_returns_model_type(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        default_model: models.GenerativeModel,
        custom_model: models.GenerativeModel,
    ) -> None:
        async with db() as session:
            await session.execute(
                sa.update(models.GenerativeModel)
                .where(models.GenerativeModel.id == custom_model.id)
                .values(type="EMBEDDING")
            )
            # Same (is_built_in, provider, name) inserted after EMBEDDING so `type` order
            # ("DECISION" before "EMBEDDING") differs from insertion/id order.
            session.add(
                models.GenerativeModel(
                    name=custom_model.name,
                    provider=custom_model.provider,
                    name_pattern=custom_model.name_pattern,
                    is_built_in=False,
                    type="DECISION",
                )
            )
        result = await gql_client.execute(query=self.LIST_QUERY)
        assert not result.errors
        assert result.data is not None
        nodes = [edge["node"] for edge in result.data["generativeModels"]["edges"]]
        assert nodes == [
            {
                "name": "custom-model",
                "kind": "CUSTOM",
                "modelType": "DECISION",
            },
            {
                "name": "custom-model",
                "kind": "CUSTOM",
                "modelType": "EMBEDDING",
            },
            {
                "name": "default-model",
                "kind": "BUILT_IN",
                "modelType": "LLM",
            },
        ]

    async def test_node_query_returns_model_type(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        custom_model: models.GenerativeModel,
    ) -> None:
        """The node resolver has no db record, so this goes through the dataloader."""
        async with db() as session:
            await session.execute(
                sa.update(models.GenerativeModel)
                .where(models.GenerativeModel.id == custom_model.id)
                .values(type="DECISION")
            )
        result = await gql_client.execute(
            query=self.NODE_QUERY,
            variables={"id": str(GlobalID(GenerativeModel.__name__, str(custom_model.id)))},
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["node"] == {
            "name": "custom-model",
            "kind": "CUSTOM",
            "modelType": "DECISION",
        }


def _create_model_variables(
    *,
    name: str = "my-model",
    provider: str = "",
    name_pattern: str = "^my-model$",
    costs: Optional[list[tuple[str, str]]] = None,
    model_type: Optional[str] = None,
) -> dict[str, Any]:
    """Builds create (or, with an added id, update) variables; `modelType` is sent only if set."""
    if costs is None:
        costs = (
            [("input", "PROMPT")]
            if model_type == "EMBEDDING"
            else [("input", "PROMPT"), ("output", "COMPLETION")]
        )
    input: dict[str, Any] = {
        "name": name,
        "provider": provider,
        "namePattern": name_pattern,
        "costs": [
            {"tokenType": token_type, "kind": kind, "costPerMillionTokens": 1.0}
            for token_type, kind in costs
        ],
    }
    if model_type is not None:
        input["modelType"] = model_type
    return {"input": input}


@pytest.fixture
async def default_model(db: DbSessionFactory) -> models.GenerativeModel:
    """
    Inserts a default model with input and output costs.
    """
    async with db() as session:
        model = models.GenerativeModel(
            name="default-model",
            provider="openai",
            name_pattern=re.compile("gpt-*"),
            is_built_in=True,
            token_prices=[
                models.TokenPrice(
                    token_type="input",
                    is_prompt=True,
                    base_rate=0.001,
                ),
                models.TokenPrice(
                    token_type="output",
                    is_prompt=False,
                    base_rate=0.002,
                ),
            ],
        )
        session.add(model)
        await session.flush()
    return model


@pytest.fixture
async def custom_model(db: DbSessionFactory) -> models.GenerativeModel:
    """
    Inserts a custom model with input and output costs.
    """
    async with db() as session:
        model = models.GenerativeModel(
            name="custom-model",
            provider="anthropic",
            name_pattern=re.compile("claude-*"),
            is_built_in=False,
            token_prices=[
                models.TokenPrice(
                    token_type="input",
                    is_prompt=True,
                    base_rate=0.003,
                ),
                models.TokenPrice(
                    token_type="output",
                    is_prompt=False,
                    base_rate=0.004,
                ),
            ],
        )
        session.add(model)
        await session.flush()
    return model
