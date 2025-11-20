from secrets import token_hex

import pytest
from fastapi import FastAPI

from phoenix.server.daemons.secret_store import SecretStore
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestSecretStore:
    MUTATIONS = """
        mutation UpsertSecretMutation($input: UpsertSecretMutationInput!) {
            upsertSecret(input: $input) {
                secret {
                    key
                }
            }
        }

        mutation DeleteSecretMutation($input: DeleteSecretMutationInput!) {
            deleteSecret(input: $input) {
                id
            }
        }
    """

    async def test_secret_store_comprehensive(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        app: FastAPI,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Comprehensive test of SecretStore to minimize server overhead.

        This single test covers:
        - Initial fetch loads all secrets
        - Incremental fetch loads only updated/deleted secrets
        - get() returns cached values
        - get() falls back to environment variables
        - Soft delete removes secrets from store

        By consolidating all tests into one, we minimize server initialization overhead.
        """
        secret_store = SecretStore(
            db=db,
            decrypt=app.state.decrypt,
            refresh_interval_seconds=999999,  # Don't auto-refresh during test
        )

        # Test 1: Empty store returns None for missing key
        assert secret_store.get("NONEXISTENT_KEY") is None

        # Test 2: Fallback to environment variables
        env_key = f"TEST_ENV_VAR_{token_hex(4)}"
        env_value = "env-value-123"
        monkeypatch.setenv(env_key, env_value)
        assert secret_store.get(env_key) == env_value

        # Test 3: Initial fetch loads all secrets
        key1 = f"secret-key-1-{token_hex(4)}"
        value1 = "secret-value-1"
        key2 = f"secret-key-2-{token_hex(4)}"
        value2 = "secret-value-2"

        # Create secrets via GraphQL
        await gql_client.execute(
            query=self.MUTATIONS,
            variables={"input": {"key": key1, "value": value1}},
            operation_name="UpsertSecretMutation",
        )
        await gql_client.execute(
            query=self.MUTATIONS,
            variables={"input": {"key": key2, "value": value2}},
            operation_name="UpsertSecretMutation",
        )

        # Fetch secrets
        await secret_store._fetch()

        # Verify secrets are in store
        assert secret_store.get(key1) == value1
        assert secret_store.get(key2) == value2

        # Test 4: Update existing secret
        value1_updated = "secret-value-1-updated"
        await gql_client.execute(
            query=self.MUTATIONS,
            variables={"input": {"key": key1, "value": value1_updated}},
            operation_name="UpsertSecretMutation",
        )

        # Incremental fetch should pick up the update
        await secret_store._fetch()
        assert secret_store.get(key1) == value1_updated
        assert secret_store.get(key2) == value2  # unchanged

        # Test 5: Add new secret (incremental fetch)
        key3 = f"secret-key-3-{token_hex(4)}"
        value3 = "secret-value-3"
        await gql_client.execute(
            query=self.MUTATIONS,
            variables={"input": {"key": key3, "value": value3}},
            operation_name="UpsertSecretMutation",
        )

        await secret_store._fetch()
        assert secret_store.get(key3) == value3

        # Test 6: Soft delete removes secret from store
        await gql_client.execute(
            query=self.MUTATIONS,
            variables={"input": {"key": key2}},
            operation_name="DeleteSecretMutation",
        )

        await secret_store._fetch()
        assert secret_store.get(key2) is None  # Removed from store
        assert secret_store.get(key1) == value1_updated  # Still present
        assert secret_store.get(key3) == value3  # Still present
