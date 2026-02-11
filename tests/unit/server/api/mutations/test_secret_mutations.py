from secrets import token_hex
from typing import Any

from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _fetch_secret_via_node_query(
    gql_client: AsyncGraphQLClient, secret_key: str, query: str
) -> dict[str, Any] | None:
    """Fetch secret details using the node query."""
    secret_id = str(GlobalID("Secret", secret_key))
    result = await gql_client.execute(
        query=query,
        variables={"id": secret_id},
        operation_name="GetSecret",
    )
    assert not result.errors
    assert result.data is not None
    return result.data["node"]  # type: ignore[no-any-return]


class TestSecretMutations:
    QUERY = """
      query GetSecret($id: ID!) {
        node(id: $id) {
          ... on Secret {
            id
            key
            value {
              ... on DecryptedSecret {
                value
              }
            }
          }
        }
      }

      mutation UpsertOrDeleteSecretsMutation($input: UpsertOrDeleteSecretsMutationInput!) {
        upsertOrDeleteSecrets(input: $input) {
          upsertedSecrets {
            id
            key
            value {
              ... on DecryptedSecret {
                value
              }
            }
          }
          deletedIds
        }
      }
    """

    async def test_all_secret_mutations_comprehensive(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Comprehensive test of all secret mutations to minimize server overhead.

        This single test covers:
        - Creating secrets (upsert with new key)
        - Updating secrets (upsert with existing key)
        - Retrieving secrets via node query
        - Duplicate keys in same request (last value wins)
        - Deleting secrets (hard delete, single and batch)
        - Re-creating secrets after deletion via upsert
        - Error cases for upsert (empty keys, empty values)
        - Idempotent deletion

        By consolidating all tests into one, we minimize server initialization overhead.
        """

        # ===== CREATE/UPSERT TESTS =====

        # Test 1: Create a new secret
        secret_key_1 = f"test-secret-{token_hex(4)}"
        secret_value_1 = "initial-value-123"

        create_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": secret_key_1, "value": secret_value_1}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not create_result.errors
        assert create_result.data is not None
        created_secrets = create_result.data["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(created_secrets) == 1
        assert created_secrets[0]["key"] == secret_key_1
        assert created_secrets[0]["value"]["value"] == secret_value_1

        # Verify via node query
        fetched_secret = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert fetched_secret is not None
        assert fetched_secret["key"] == secret_key_1
        assert fetched_secret["value"]["value"] == secret_value_1

        # Test 2: Update existing secret (upsert with same key)
        secret_value_1_updated = "updated-value-456"

        update_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": secret_key_1, "value": secret_value_1_updated}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not update_result.errors
        assert update_result.data is not None
        updated_secrets = update_result.data["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(updated_secrets) == 1
        assert updated_secrets[0]["key"] == secret_key_1
        assert updated_secrets[0]["value"]["value"] == secret_value_1_updated

        # Verify update via node query
        fetched_updated = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert fetched_updated is not None
        assert fetched_updated["value"]["value"] == secret_value_1_updated

        # Test 3: Batch create multiple secrets
        secret_key_2 = f"test-secret-special-{token_hex(4)}"
        secret_value_2 = "value!@#$%^&*()_+-=[]{}|;:',.<>?/~`"
        secret_key_3_raw = f"  test-secret-whitespace-{token_hex(4)}  "
        secret_key_3 = secret_key_3_raw.strip()
        secret_value_3_raw = "  value with spaces  "
        secret_value_3 = secret_value_3_raw.strip()

        batch_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [
                        {"key": secret_key_2, "value": secret_value_2},
                        {"key": secret_key_3_raw, "value": secret_value_3_raw},
                    ],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not batch_result.errors
        assert batch_result.data is not None
        batch_secrets = batch_result.data["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(batch_secrets) == 2
        # Check secrets (order is reversed due to deduplication logic)
        batch_secrets_by_key = {s["key"]: s for s in batch_secrets}
        # Check secret with special characters
        assert batch_secrets_by_key[secret_key_2]["value"]["value"] == secret_value_2
        # Check secret with whitespace trimmed
        assert batch_secrets_by_key[secret_key_3]["value"]["value"] == secret_value_3

        # Test 4: Duplicate keys in same request (last value wins)
        secret_key_4 = f"test-secret-duplicate-{token_hex(4)}"
        first_value = "first-value"
        last_value = "last-value-wins"

        duplicate_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [
                        {"key": secret_key_4, "value": first_value},
                        {"key": secret_key_4, "value": last_value},
                    ],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not duplicate_result.errors
        assert duplicate_result.data is not None
        duplicate_secrets = duplicate_result.data["upsertOrDeleteSecrets"]["upsertedSecrets"]
        # Only one secret should be returned (deduplicated)
        assert len(duplicate_secrets) == 1
        assert duplicate_secrets[0]["key"] == secret_key_4
        # The last value in the input list should win
        assert duplicate_secrets[0]["value"]["value"] == last_value

        # Verify via node query that the last value was persisted
        fetched_duplicate = await _fetch_secret_via_node_query(gql_client, secret_key_4, self.QUERY)
        assert fetched_duplicate is not None
        assert fetched_duplicate["value"]["value"] == last_value

        # Clean up the duplicate test secret
        cleanup_duplicate = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": secret_key_4, "value": None}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not cleanup_duplicate.errors

        # ===== ERROR CASE TESTS =====

        # Test 5: Empty secrets list (should fail)
        empty_list_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert empty_list_result.errors is not None
        assert any(
            "at least one secret is required" in e.message.lower() for e in empty_list_result.errors
        )

        # Test 6: Empty key (should fail)
        empty_key_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": "", "value": "some-value"}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert empty_key_result.errors is not None
        assert any("key cannot be empty" in e.message.lower() for e in empty_key_result.errors)

        # Test 7: Key with only whitespace (should fail)
        whitespace_key_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": "   ", "value": "some-value"}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert whitespace_key_result.errors is not None
        assert any("key cannot be empty" in e.message.lower() for e in whitespace_key_result.errors)

        # Test 8: Empty value (should fail)
        empty_value_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": "valid-key", "value": ""}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert empty_value_result.errors is not None
        assert any("value cannot be empty" in e.message.lower() for e in empty_value_result.errors)

        # Test 9: Value with only whitespace (should fail)
        whitespace_value_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": "valid-key", "value": "   "}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert whitespace_value_result.errors is not None
        assert any(
            "value cannot be empty" in e.message.lower() for e in whitespace_value_result.errors
        )

        # ===== DELETE TESTS =====

        # Test 10: Delete existing secret (by passing value: null)
        delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": secret_key_1, "value": None}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not delete_result.errors
        assert delete_result.data is not None
        deleted_ids = delete_result.data["upsertOrDeleteSecrets"]["deletedIds"]
        expected_id = str(GlobalID("Secret", secret_key_1))
        assert deleted_ids == [expected_id]

        # Verify deletion via database (hard delete: secret should not exist)
        async with db() as session:
            deleted_secret = await session.get(models.Secret, secret_key_1)
        assert deleted_secret is None  # Hard deleted, secret no longer exists

        # Test 11: Re-create secret after deletion by upserting
        secret_value_1_recreated = "recreated-value-789"
        recreate_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": secret_key_1, "value": secret_value_1_recreated}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not recreate_result.errors
        assert recreate_result.data is not None
        recreated_secrets = recreate_result.data["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(recreated_secrets) == 1
        assert recreated_secrets[0]["key"] == secret_key_1
        assert recreated_secrets[0]["value"]["value"] == secret_value_1_recreated

        # Verify re-creation via node query
        fetched_recreated = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert fetched_recreated is not None
        assert fetched_recreated["value"]["value"] == secret_value_1_recreated

        # Test 12: Delete non-existent secret (idempotent - should succeed)
        nonexistent_key = f"nonexistent-secret-{token_hex(4)}"
        nonexistent_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [{"key": nonexistent_key, "value": None}],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not nonexistent_delete_result.errors
        assert nonexistent_delete_result.data is not None
        expected_nonexistent_id = str(GlobalID("Secret", nonexistent_key))
        assert nonexistent_delete_result.data["upsertOrDeleteSecrets"]["deletedIds"] == [
            expected_nonexistent_id
        ]

        # Test 13: Batch delete multiple secrets to clean up
        batch_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "secrets": [
                        {"key": secret_key_1, "value": None},
                        {"key": secret_key_2, "value": None},
                        {"key": secret_key_3, "value": None},
                    ],
                }
            },
            operation_name="UpsertOrDeleteSecretsMutation",
        )
        assert not batch_delete_result.errors
        assert batch_delete_result.data is not None
        batch_deleted_ids = set(batch_delete_result.data["upsertOrDeleteSecrets"]["deletedIds"])
        expected_batch_ids = {
            str(GlobalID("Secret", secret_key_1)),
            str(GlobalID("Secret", secret_key_2)),
            str(GlobalID("Secret", secret_key_3)),
        }
        assert batch_deleted_ids == expected_batch_ids
