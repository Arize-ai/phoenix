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
            isOverride
            createdAt
            updatedAt
            tokenCost {
              input
              output
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
            isOverride
            createdAt
            updatedAt
            tokenCost {
              input
              output
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
            isOverride
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
                    {"tokenType": "input", "costPerToken": 0.001},
                    {"tokenType": "output", "costPerToken": 0.002},
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
        assert created_model.pop("isOverride") is True
        assert isinstance(created_model.pop("createdAt"), str)
        assert isinstance(created_model.pop("updatedAt"), str)
        token_cost = created_model.pop("tokenCost")
        assert not created_model
        assert token_cost.pop("input") == 0.001
        assert token_cost.pop("output") == 0.002
        assert not token_cost

        # Update model
        update_variables = {
            "input": {
                "id": model_id,
                "name": "updated-test-model",
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {"tokenType": "input", "costPerToken": 0.003},
                    {"tokenType": "output", "costPerToken": 0.004},
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
        assert updated_model.pop("isOverride") is True
        assert isinstance(updated_model.pop("createdAt"), str)
        assert isinstance(updated_model.pop("updatedAt"), str)
        token_cost = updated_model.pop("tokenCost")
        assert not updated_model
        assert token_cost.pop("input") == 0.003
        assert token_cost.pop("output") == 0.004
        assert not token_cost

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
        assert deleted_model.pop("isOverride") is True
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
                            {"tokenType": "output", "costPerToken": 0.002},
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
                            {"tokenType": "input", "costPerToken": 0.001},
                        ],
                    }
                },
                "output cost is required",
                id="missing-output-cost",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "default-model",
                        "provider": "openai",
                        "namePattern": "gpt-*",
                        "costs": [
                            {"tokenType": "input", "costPerToken": 0.001},
                            {"tokenType": "output", "costPerToken": 0.002},
                        ],
                    }
                },
                "Model with name 'default-model' already exists",
                id="duplicate-default-model",
            ),
            pytest.param(
                {
                    "input": {
                        "name": "test-model",
                        "provider": "openai",
                        "namePattern": "[",
                        "costs": [
                            {"tokenType": "input", "costPerToken": 0.001},
                            {"tokenType": "output", "costPerToken": 0.002},
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
        default_model: models.GenerativeModel,
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
                            {"tokenType": "input", "costPerToken": 0.001},
                            {"tokenType": "output", "costPerToken": 0.002},
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
                            {"tokenType": "input", "costPerToken": 0.001},
                            {"tokenType": "output", "costPerToken": 0.002},
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
                            {"tokenType": "output", "costPerToken": 0.002},
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
                            {"tokenType": "input", "costPerToken": 0.001},
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
                            {"tokenType": "input", "costPerToken": 0.001},
                            {"tokenType": "output", "costPerToken": 0.002},
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
                    {"tokenType": "input", "costPerToken": 0.003},
                    {"tokenType": "output", "costPerToken": 0.004},
                ],
            }
        }

        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == "Cannot update default model"
        assert result.data is None

    async def test_updating_model_to_conflicting_name_fails_with_expected_error(
        self,
        gql_client: AsyncGraphQLClient,
        default_model: models.GenerativeModel,
        custom_model: models.GenerativeModel,
    ) -> None:
        model_id = str(GlobalID(GenerativeModel.__name__, str(custom_model.id)))
        variables = {
            "input": {
                "id": model_id,
                "name": "default-model",  # conflicts with the default_model name
                "provider": "anthropic",
                "namePattern": "claude-*",
                "costs": [
                    {"tokenType": "input", "costPerToken": 0.003},
                    {"tokenType": "output", "costPerToken": 0.004},
                ],
            }
        }

        result = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
            operation_name="UpdateModelMutation",
        )
        assert len(result.errors) == 1
        assert result.errors[0].message == "Model with name 'default-model' already exists"
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
        assert result.errors[0].message == "Cannot delete default model"
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
            llm_name_pattern="gpt-*",
            is_override=False,
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
            llm_name_pattern="claude-*",
            is_override=True,
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
