from secrets import token_hex
from typing import Any

from strawberry.relay.types import GlobalID

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
            value
          }
        }
      }

      mutation UpsertSecretMutation($input: UpsertSecretMutationInput!) {
        upsertSecret(input: $input) {
          secret {
            id
            key
            value
          }
        }
      }

      mutation DeleteSecretMutation($input: DeleteSecretMutationInput!) {
        deleteSecret(input: $input) {
          id
        }
      }
    """

    async def test_all_secret_mutations_comprehensive(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Comprehensive test of all secret mutations to minimize server overhead.

        This single test covers:
        - Creating secrets (upsert with new key)
        - Updating secrets (upsert with existing key)
        - Retrieving secrets via node query
        - Deleting secrets (soft delete)
        - Resurrecting deleted secrets via upsert
        - Error cases (empty keys, empty values)
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
                    "key": secret_key_1,
                    "value": secret_value_1,
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert not create_result.errors
        assert create_result.data is not None
        created_secret = create_result.data["upsertSecret"]["secret"]
        assert created_secret["key"] == secret_key_1
        assert created_secret["value"] == secret_value_1

        # Verify via node query
        fetched_secret = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert fetched_secret is not None
        assert fetched_secret["key"] == secret_key_1
        assert fetched_secret["value"] == secret_value_1

        # Test 2: Update existing secret (upsert with same key)
        secret_value_1_updated = "updated-value-456"

        update_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": secret_key_1,
                    "value": secret_value_1_updated,
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert not update_result.errors
        assert update_result.data is not None
        updated_secret = update_result.data["upsertSecret"]["secret"]
        assert updated_secret["key"] == secret_key_1
        assert updated_secret["value"] == secret_value_1_updated

        # Verify update via node query
        fetched_updated = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert fetched_updated is not None
        assert fetched_updated["value"] == secret_value_1_updated

        # Test 3: Create another secret with special characters
        secret_key_2 = f"test-secret-special-{token_hex(4)}"
        secret_value_2 = "value!@#$%^&*()_+-=[]{}|;:',.<>?/~`"

        special_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": secret_key_2,
                    "value": secret_value_2,
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert not special_result.errors
        assert special_result.data is not None
        special_secret = special_result.data["upsertSecret"]["secret"]
        assert special_secret["key"] == secret_key_2
        assert special_secret["value"] == secret_value_2

        # Test 4: Create secret with whitespace in key and value (should be trimmed)
        secret_key_3_raw = f"  test-secret-whitespace-{token_hex(4)}  "
        secret_key_3 = secret_key_3_raw.strip()
        secret_value_3_raw = "  value with spaces  "
        secret_value_3 = secret_value_3_raw.strip()

        whitespace_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": secret_key_3_raw,
                    "value": secret_value_3_raw,
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert not whitespace_result.errors
        assert whitespace_result.data is not None
        whitespace_secret = whitespace_result.data["upsertSecret"]["secret"]
        assert whitespace_secret["key"] == secret_key_3
        assert whitespace_secret["value"] == secret_value_3

        # ===== ERROR CASE TESTS =====

        # Test 5: Empty key (should fail)
        empty_key_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": "",
                    "value": "some-value",
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert empty_key_result.errors is not None
        assert any("key cannot be empty" in e.message.lower() for e in empty_key_result.errors)

        # Test 6: Key with only whitespace (should fail)
        whitespace_key_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": "   ",
                    "value": "some-value",
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert whitespace_key_result.errors is not None
        assert any("key cannot be empty" in e.message.lower() for e in whitespace_key_result.errors)

        # Test 7: Empty value (should fail)
        empty_value_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": "valid-key",
                    "value": "",
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert empty_value_result.errors is not None
        assert any("value cannot be empty" in e.message.lower() for e in empty_value_result.errors)

        # Test 8: Value with only whitespace (should fail)
        whitespace_value_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": "valid-key",
                    "value": "   ",
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert whitespace_value_result.errors is not None
        assert any(
            "value cannot be empty" in e.message.lower() for e in whitespace_value_result.errors
        )

        # ===== DELETE TESTS =====

        # Test 9: Delete existing secret
        delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": secret_key_1}},
            operation_name="DeleteSecretMutation",
        )
        assert not delete_result.errors
        assert delete_result.data is not None
        deleted_id = delete_result.data["deleteSecret"]["id"]
        expected_id = str(GlobalID("Secret", secret_key_1))
        assert deleted_id == expected_id

        # Verify deletion via node query (soft delete: value should be None)
        deleted_fetch = await _fetch_secret_via_node_query(gql_client, secret_key_1, self.QUERY)
        assert deleted_fetch is not None
        assert deleted_fetch["key"] == secret_key_1
        assert deleted_fetch["value"] is None  # Soft deleted, no value accessible

        # Test 10: Resurrect deleted secret by upserting
        secret_value_1_resurrected = "resurrected-value-789"
        resurrect_result = await gql_client.execute(
            query=self.QUERY,
            variables={
                "input": {
                    "key": secret_key_1,
                    "value": secret_value_1_resurrected,
                }
            },
            operation_name="UpsertSecretMutation",
        )
        assert not resurrect_result.errors
        assert resurrect_result.data is not None
        resurrected_secret = resurrect_result.data["upsertSecret"]["secret"]
        assert resurrected_secret["key"] == secret_key_1
        assert resurrected_secret["value"] == secret_value_1_resurrected

        # Verify resurrection via node query
        fetched_resurrected = await _fetch_secret_via_node_query(
            gql_client, secret_key_1, self.QUERY
        )
        assert fetched_resurrected is not None
        assert fetched_resurrected["value"] == secret_value_1_resurrected

        # Test 11: Delete non-existent secret (idempotent - should succeed)
        nonexistent_key = f"nonexistent-secret-{token_hex(4)}"
        nonexistent_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": nonexistent_key}},
            operation_name="DeleteSecretMutation",
        )
        assert not nonexistent_delete_result.errors
        assert nonexistent_delete_result.data is not None
        expected_nonexistent_id = str(GlobalID("Secret", nonexistent_key))
        assert nonexistent_delete_result.data["deleteSecret"]["id"] == expected_nonexistent_id

        # Test 12: Delete with empty key (should fail)
        empty_key_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": ""}},
            operation_name="DeleteSecretMutation",
        )
        assert empty_key_delete_result.errors is not None
        assert any(
            "key cannot be empty" in e.message.lower() for e in empty_key_delete_result.errors
        )

        # Test 13: Delete with whitespace-only key (should fail)
        whitespace_delete_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": "   "}},
            operation_name="DeleteSecretMutation",
        )
        assert whitespace_delete_result.errors is not None
        assert any(
            "key cannot be empty" in e.message.lower() for e in whitespace_delete_result.errors
        )

        # Test 14: Delete second secret to clean up
        delete_2_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": secret_key_2}},
            operation_name="DeleteSecretMutation",
        )
        assert not delete_2_result.errors

        # Test 15: Delete third secret to clean up
        delete_3_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": secret_key_3}},
            operation_name="DeleteSecretMutation",
        )
        assert not delete_3_result.errors

        # Test 16: Delete resurrected secret to clean up
        delete_resurrected_result = await gql_client.execute(
            query=self.QUERY,
            variables={"input": {"key": secret_key_1}},
            operation_name="DeleteSecretMutation",
        )
        assert not delete_resurrected_result.errors
