import asyncio
from asyncio import Event, sleep
from datetime import datetime, timezone
from typing import AsyncIterator, Callable
from unittest.mock import patch

import pytest

from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def fetch_trigger() -> AsyncIterator[Event]:
    """Control when the GenerativeModelStore runs by patching its sleep method.

    Returns an event that can be set to trigger the store's next fetch cycle.
    The store will wait for this event instead of sleeping for the refresh interval.
    """
    event = Event()

    async def wait_for_event(seconds: int) -> None:
        await event.wait()
        event.clear()

    with patch("phoenix.server.daemons.generative_model_store.sleep", wait_for_event):
        yield event


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
        fetch_trigger: Event,
    ) -> None:
        """
        Test that GenerativeModelStore correctly manages model lifecycle through daemon cycles.

        This test verifies that the store:
        1. Loads initial models on first fetch cycle (full fetch when _last_fetch_time is None)
        2. Uses incremental fetching on subsequent cycles (queries with >= _last_fetch_time filter)
        3. Picks up model updates through incremental fetching
        4. Removes soft-deleted models from the lookup cache
        5. Advances _last_fetch_time after each successful fetch cycle
        6. Advances _last_fetch_time even when no models are changed (empty fetch)

        Test flow uses controlled daemon execution:
        - Start the daemon running in background via store.start()
        - wait_for_condition polls a predicate and triggers fetch cycles via fetch_trigger
        - Verify observable behavior (model lookups work correctly) after each cycle
        - Verify internal state (_last_fetch_time advances) to ensure incremental logic executes

        Note: The implementation applies a 2-second clock buffer (fetch_start_time = now - 2s)
        for clock skew tolerance, but this test does not verify the buffer's effectiveness
        as that would require time mocking to simulate the race condition.
        """

        # PHASE 1: Create initial models
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

        # Start the daemon
        store = GenerativeModelStore(db=db)
        await store.start()

        async def wait_for_condition(
            predicate: Callable[[], bool],
            timeout_seconds: float = 5.0,
            interval_seconds: float = 0.05,
        ) -> None:
            deadline = asyncio.get_running_loop().time() + timeout_seconds
            while True:
                if predicate():
                    return
                if asyncio.get_running_loop().time() >= deadline:
                    await store.stop()
                    pytest.fail("Timed out waiting for GenerativeModelStore condition")
                fetch_trigger.set()
                await sleep(interval_seconds)

        # Wait for initial fetch (polling loop triggers retries if auto-fetch fails)
        await wait_for_condition(lambda: store._last_fetch_time is not None)

        # Verify initial fetch loaded both models
        lookup_time = datetime.now(timezone.utc)
        fetched_model1 = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
        )
        assert fetched_model1 is not None
        assert fetched_model1.name == "gpt-3.5"
        assert len(fetched_model1.token_prices) == 2

        fetched_model2 = store.find_model(
            start_time=lookup_time,
            attributes={"llm": {"model_name": "claude-3", "provider": "anthropic"}},
        )
        assert fetched_model2 is not None
        assert fetched_model2.name == "claude-3"
        assert len(fetched_model2.token_prices) == 2

        # Verify _last_fetch_time was set (timestamp tracking works)
        assert store._last_fetch_time is not None
        first_fetch_time = store._last_fetch_time

        # PHASE 2: Update model and verify incremental fetch
        await asyncio.sleep(0.01)

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

        # Wait for incremental fetch to pick up the update
        await wait_for_condition(
            lambda: getattr(
                store.find_model(
                    start_time=lookup_time,
                    attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
                ),
                "name",
                None,
            )
            == "gpt-3.5-updated"
        )

        # Verify timestamp advanced
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > first_fetch_time
        second_fetch_time = store._last_fetch_time

        # PHASE 3: Delete model and verify removal
        await asyncio.sleep(0.01)

        delete_result = await gql_client.execute(
            query=self.MUTATIONS,
            operation_name="DeleteModel",
            variables={"input": {"id": model2_id}},
        )
        assert not delete_result.errors

        # Wait for fetch to pick up the delete
        await wait_for_condition(
            lambda: store.find_model(
                start_time=lookup_time,
                attributes={"llm": {"model_name": "claude-3", "provider": "anthropic"}},
            )
            is None
        )

        # Verify timestamp advanced
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > second_fetch_time

        # PHASE 4: Empty fetch still advances timestamp
        await asyncio.sleep(0.01)

        # Wait for empty fetch to advance timestamp
        third_fetch_time = store._last_fetch_time
        await wait_for_condition(lambda: store._last_fetch_time != third_fetch_time)

        # Verify timestamp advanced even with no changes
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > third_fetch_time

        # Clean up
        await store.stop()
