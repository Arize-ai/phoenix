import re
from typing import Any

import pytest
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
        ],
    )
    async def test_updating_model_with_invalid_input_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
        expected_error_message: str,
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
