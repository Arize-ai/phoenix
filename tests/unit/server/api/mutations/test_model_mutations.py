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
        model_id = created_model.pop("id")
        assert created_model.pop("name") == "test-model"
        assert created_model.pop("provider") == "OPENAI"
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
        update_result = await gql_client.execute(self.UPDATE_MODEL_MUTATION, update_variables)
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
        delete_result = await gql_client.execute(self.DELETE_MODEL_MUTATION, delete_variables)
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
