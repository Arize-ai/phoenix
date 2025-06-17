from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestModelMutations:
    CREATE_MODEL_MUTATION = """
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
    """

    UPDATE_MODEL_MUTATION = """
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
    """

    DELETE_MODEL_MUTATION = """
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
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Create model
        create_variables = {
            "input": {
                "name": "test-model",
                "provider": "OPENAI",
                "namePattern": "gpt-*",
                "costs": [
                    {"tokenType": "input", "costPerToken": 0.001},
                    {"tokenType": "output", "costPerToken": 0.002},
                ],
            }
        }

        create_result = await gql_client.execute(self.CREATE_MODEL_MUTATION, create_variables)
        assert not create_result.errors
        assert create_result.data is not None

        created_model = create_result.data["createModel"]["model"]
        model_id = created_model["id"]
        assert created_model["name"] == "test-model"
        assert created_model["provider"] == "OPENAI"
        assert created_model["namePattern"] == "gpt-*"
        assert created_model["isOverride"] is True
        assert created_model["tokenCost"]["input"] == 0.001
        assert created_model["tokenCost"]["output"] == 0.002
        assert isinstance(created_model["createdAt"], str)
        assert isinstance(created_model["updatedAt"], str)

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

        update_result = await gql_client.execute(self.UPDATE_MODEL_MUTATION, update_variables)
        assert not update_result.errors
        assert update_result.data is not None

        updated_model = update_result.data["updateModel"]["model"]
        assert updated_model["id"] == model_id
        assert updated_model["name"] == "updated-test-model"
        assert updated_model["provider"] == "anthropic"
        assert updated_model["namePattern"] == "claude-*"
        assert updated_model["isOverride"] is True
        assert updated_model["tokenCost"]["input"] == 0.003
        assert updated_model["tokenCost"]["output"] == 0.004

        # Delete model
        delete_variables = {
            "input": {
                "id": model_id,
            }
        }

        delete_result = await gql_client.execute(self.DELETE_MODEL_MUTATION, delete_variables)
        assert not delete_result.errors
        assert delete_result.data is not None

        deleted_model = delete_result.data["deleteModel"]["model"]
        assert deleted_model["id"] == model_id
        assert deleted_model["name"] == "updated-test-model"
        assert deleted_model["provider"] == "anthropic"
        assert deleted_model["namePattern"] == "claude-*"
        assert deleted_model["isOverride"] is True
