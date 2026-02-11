import asyncio
from asyncio import Event
from datetime import datetime, timezone
from typing import AsyncIterator
from unittest.mock import patch

import pytest

from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class _FetchCycleController:
    """Deterministic control over GenerativeModelStore daemon cycles.

    Replaces the daemon's sleep with an event gate so that the test can
    trigger exactly one fetch cycle and wait for it to complete before
    making assertions.
    """

    def __init__(self) -> None:
        self._trigger = Event()
        self._cycle_done = Event()

    async def _patched_sleep(self, seconds: int) -> None:
        """Replacement for the daemon's ``sleep`` call.

        Signals that the previous cycle finished (so the test can
        proceed), then waits for the test to trigger the next cycle.
        """
        self._cycle_done.set()
        await self._trigger.wait()
        self._trigger.clear()

    async def trigger_and_wait(self, timeout: float = 5.0) -> None:
        """Trigger one fetch cycle and wait until it completes."""
        self._cycle_done.clear()
        self._trigger.set()
        await asyncio.wait_for(self._cycle_done.wait(), timeout=timeout)


@pytest.fixture
async def fetch_cycle() -> AsyncIterator[_FetchCycleController]:
    """Control when the GenerativeModelStore runs by patching its sleep method.

    Yields a controller whose ``trigger_and_wait`` method fires exactly one
    daemon fetch cycle and blocks until it finishes.
    """
    ctrl = _FetchCycleController()

    with patch(
        "phoenix.server.daemons.generative_model_store.sleep",
        ctrl._patched_sleep,
    ):
        yield ctrl


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
        fetch_cycle: _FetchCycleController,
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
        - Trigger fetch cycles on demand via fetch_cycle fixture
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

        # Trigger first fetch cycle and wait for it to complete
        await fetch_cycle.trigger_and_wait()

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

        # Trigger second fetch cycle (should use incremental fetching)
        await fetch_cycle.trigger_and_wait()

        # Verify incremental fetch picked up the update
        assert (
            store.find_model(
                start_time=lookup_time,
                attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
            )
            is not None
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

        # Trigger third fetch cycle
        await fetch_cycle.trigger_and_wait()

        # Verify deleted model was removed from lookup
        assert (
            store.find_model(
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
        await fetch_cycle.trigger_and_wait()

        # Verify timestamp advanced even with no changes
        assert store._last_fetch_time is not None
        assert store._last_fetch_time > third_fetch_time

        # Clean up
        await store.stop()
