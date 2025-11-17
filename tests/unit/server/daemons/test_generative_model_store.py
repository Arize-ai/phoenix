import asyncio
from datetime import datetime, timezone

from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestGenerativeModelStore:
    """Test cases for GenerativeModelStore daemon."""

    MUTATIONS = """
      mutation CreateModel($input: CreateModelMutationInput!) {
        createModel(input: $input) {
          model { id name updatedAt }
        }
      }

      mutation UpdateModel($input: UpdateModelMutationInput!) {
        updateModel(input: $input) {
          model { id name updatedAt }
        }
      }

      mutation DeleteModel($input: DeleteModelMutationInput!) {
        deleteModel(input: $input) {
          model { id name }
        }
      }
    """

    async def test_generative_model_store_lifecycle(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """
        Comprehensive test covering initial fetch, incremental updates, deletions,
        timestamp tracking, and model lookup delegation using real GraphQL mutations.
        """
        # PHASE 1: Create models using GraphQL mutations
        # Create model 1
        result1 = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="CreateModel",
            variables={
                "input": {
                    "name": "gpt-3.5",
                    "provider": "openai",
                    "namePattern": "gpt-3\\.5-turbo",
                    "costs": [
                        {
                            "tokenType": "input",
                            "kind": "PROMPT",
                            "costPerMillionTokens": 1000,
                        },
                        {
                            "tokenType": "output",
                            "kind": "COMPLETION",
                            "costPerMillionTokens": 2000,
                        },
                    ],
                }
            },
        )
        assert not result1.errors
        assert result1.data is not None
        model1_id = result1.data["createModel"]["model"]["id"]

        # Create model 2
        result2 = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="CreateModel",
            variables={
                "input": {
                    "name": "claude-3",
                    "provider": "anthropic",
                    "namePattern": "claude-.*",
                    "costs": [
                        {
                            "tokenType": "input",
                            "kind": "PROMPT",
                            "costPerMillionTokens": 2000,
                        },
                        {
                            "tokenType": "output",
                            "kind": "COMPLETION",
                            "costPerMillionTokens": 3000,
                        },
                    ],
                }
            },
        )
        assert not result2.errors
        assert result2.data is not None
        model2_id = result2.data["createModel"]["model"]["id"]

        store = GenerativeModelStore(db=db)
        await store._fetch_models()

        # Verify initial fetch loaded both models
        lookup_time = datetime.now(timezone.utc)
        fetched_model1 = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
        )
        assert fetched_model1 is not None
        assert fetched_model1.name == "gpt-3.5"
        # Verify selectinload worked: token_prices should be loaded
        assert len(fetched_model1.token_prices) == 2

        fetched_model2 = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "claude-3", "provider": "anthropic"}},
        )
        assert fetched_model2 is not None
        assert fetched_model2.name == "claude-3"
        # Verify selectinload worked: token_prices should be loaded
        assert len(fetched_model2.token_prices) == 2

        # Verify _last_fetch_time was set
        assert store._last_fetch_time is not None
        last_fetch_time = store._last_fetch_time

        # PHASE 2: Update model using GraphQL mutation
        # Sleep to ensure updated_at will be different
        await asyncio.sleep(0.001)

        update_result = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="UpdateModel",
            variables={
                "input": {
                    "id": model1_id,
                    "name": "gpt-3.5-updated",
                    "provider": "openai",
                    "namePattern": "gpt-3\\.5-turbo",
                    "costs": [
                        {
                            "tokenType": "input",
                            "kind": "PROMPT",
                            "costPerMillionTokens": 1500,
                        },
                        {
                            "tokenType": "output",
                            "kind": "COMPLETION",
                            "costPerMillionTokens": 2500,
                        },
                    ],
                }
            },
        )
        assert not update_result.errors

        await store._fetch_models()

        # Verify incremental fetch picked up the update
        result = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
        )
        assert result is not None
        assert result.name == "gpt-3.5-updated"
        # Verify that updated_at was automatically changed (mutation sets it explicitly)
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > last_fetch_time
        last_fetch_time = store._last_fetch_time

        # PHASE 3: Delete model using GraphQL mutation
        # Sleep to ensure deleted_at will be different
        await asyncio.sleep(0.001)

        delete_result = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="DeleteModel",
            variables={"input": {"id": model2_id}},
        )
        assert not delete_result.errors

        await store._fetch_models()

        # Verify deleted model was removed from lookup
        assert (
            store.find_model(
                start_time=lookup_time,
                attributes={"llm": {"model_name": "claude-3", "provider": "anthropic"}},
            )
            is None
        )
        # Verify that timestamp was updated
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > last_fetch_time
        last_fetch_time = store._last_fetch_time

        # PHASE 4: Empty fetch updates timestamp (uses query start time)
        # With the new strategy, _last_fetch_time is set to query start time,
        # not max from results, so it always advances even with no results.
        await asyncio.sleep(0.001)  # Ensure time advances
        await store._fetch_models()  # No changes in DB

        # Verify timestamp WAS updated (to query start time)
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > last_fetch_time
        last_fetch_time = store._last_fetch_time

        # PHASE 5: Verify idempotent refetching behavior
        # The new strategy uses >= comparison, which means models in the time window
        # will be refetched, but .merge() handles duplicates correctly.

        # Update a model
        await asyncio.sleep(0.001)
        result_refetch = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="UpdateModel",
            variables={
                "input": {
                    "id": model1_id,
                    "name": "gpt-3.5-refetch-test",
                    "provider": "openai",
                    "namePattern": "gpt-3\\.5-turbo",
                    "costs": [
                        {
                            "tokenType": "input",
                            "kind": "PROMPT",
                            "costPerMillionTokens": 1600,
                        },
                        {
                            "tokenType": "output",
                            "kind": "COMPLETION",
                            "costPerMillionTokens": 2600,
                        },
                    ],
                }
            },
        )
        assert not result_refetch.errors

        # First fetch after update
        await store._fetch_models()
        first_fetch_time = store._last_fetch_time

        # Immediate second fetch - may refetch the same model due to >=
        await asyncio.sleep(0.001)
        await store._fetch_models()
        second_fetch_time = store._last_fetch_time

        # Verify model is still accessible and correct (not broken by refetch)
        refetched_model = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
        )
        assert refetched_model is not None
        assert refetched_model.name == "gpt-3.5-refetch-test"

        # Verify timestamp advanced
        assert second_fetch_time > first_fetch_time

        # PHASE 6: Verify find_model returns None for non-matching attributes
        assert (
            store.find_model(
                start_time=lookup_time,
                attributes={"llm": {"model_name": "nonexistent", "provider": "openai"}},
            )
            is None
        )
