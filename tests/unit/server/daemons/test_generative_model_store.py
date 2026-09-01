import asyncio
from asyncio import Event, wait_for
from datetime import datetime, timezone
from typing import AsyncIterator
from unittest.mock import patch

import pytest

from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_CYCLE_TIMEOUT_SECONDS = 30.0


class _DaemonCycleController:
    """Steps the store's fetch loop one cycle at a time through its patched sleep.

    The loop assigns _last_fetch_time before it sleeps, so entering sleep marks a
    finished cycle: the patched sleep signals completion, then parks the loop until
    the test releases the next cycle. Each release runs exactly one cycle -- a
    failed fetch is not retried, it surfaces in the next assertion.
    """

    def __init__(self) -> None:
        self._cycle_completed = Event()
        self._release_next = Event()

    async def sleep(self, seconds: float) -> None:
        self._cycle_completed.set()
        await self._release_next.wait()
        self._release_next.clear()

    async def wait_for_cycle(self, phase: str) -> None:
        # The timeout is a watchdog for a wedged fetch; it is sized to absorb
        # multi-second scheduling stalls on oversubscribed CI runners.
        try:
            await wait_for(self._cycle_completed.wait(), timeout=_CYCLE_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            pytest.fail(f"Fetch cycle did not finish within {_CYCLE_TIMEOUT_SECONDS}s: {phase}")
        self._cycle_completed.clear()

    async def run_cycle(self, phase: str) -> None:
        self._release_next.set()
        await self.wait_for_cycle(phase)


@pytest.fixture
async def daemon_cycles() -> AsyncIterator[_DaemonCycleController]:
    controller = _DaemonCycleController()
    with patch("phoenix.server.daemons.generative_model_store.sleep", controller.sleep):
        yield controller


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
        daemon_cycles: _DaemonCycleController,
    ) -> None:
        """
        Drive the daemon through controlled fetch cycles and verify that:

        1. The first cycle loads existing models into the lookup.
        2. A later cycle picks up a model update.
        3. A later cycle removes a soft-deleted model from the lookup.
        4. Every successful cycle advances _last_fetch_time, including a cycle
           with no new mutations.

        The incremental where-clause is not observable here: its 10-second
        clock-skew buffer refetches every row this test touches, so phase 4
        asserts cursor advancement only, and a full-refetch implementation
        would pass this test as well.
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

        # Start the daemon; its first cycle runs without a release.
        store = GenerativeModelStore(db=db)
        await store.start()
        try:
            await daemon_cycles.wait_for_cycle("initial fetch")

            # Verify the initial fetch loaded both models
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

            assert store._last_fetch_time is not None
            first_fetch_time = store._last_fetch_time

            # PHASE 2: Update a model; the next cycle must pick up the change
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

            await daemon_cycles.run_cycle("fetch after model update")

            updated_model = store.find_model(
                start_time=lookup_time,
                attributes={"llm": {"model_name": "gpt-3.5-turbo", "provider": "openai"}},
            )
            assert updated_model is not None
            assert updated_model.name == "gpt-3.5-updated"

            assert store._last_fetch_time is not None
            assert store._last_fetch_time > first_fetch_time
            second_fetch_time = store._last_fetch_time

            # PHASE 3: Delete a model; the next cycle must drop it from the lookup
            await asyncio.sleep(0.01)

            delete_result = await gql_client.execute(
                query=self.MUTATIONS,
                operation_name="DeleteModel",
                variables={"input": {"id": model2_id}},
            )
            assert not delete_result.errors

            await daemon_cycles.run_cycle("fetch after model delete")

            assert (
                store.find_model(
                    start_time=lookup_time,
                    attributes={"llm": {"model_name": "claude-3", "provider": "anthropic"}},
                )
                is None
            )

            assert store._last_fetch_time is not None
            assert store._last_fetch_time > second_fetch_time
            third_fetch_time = store._last_fetch_time

            # PHASE 4: A cycle with no new mutations still advances the cursor
            await asyncio.sleep(0.01)

            await daemon_cycles.run_cycle("fetch with no new mutations")

            assert store._last_fetch_time is not None
            assert store._last_fetch_time > third_fetch_time
        finally:
            await store.stop()
