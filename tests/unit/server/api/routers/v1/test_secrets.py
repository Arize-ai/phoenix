from __future__ import annotations

import httpx
import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.api.openapi.schema import get_openapi_schema
from phoenix.server.types import DbSessionFactory


class TestUpsertOrDeleteSecrets:
    """Tests for PUT /v1/secrets."""

    async def test_upsert_single_secret(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Creates a new secret and confirms it is returned in upserted_keys."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "OPENAI_API_KEY", "value": "sk-test-1234"}]},
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["upserted_keys"] == ["OPENAI_API_KEY"]
        assert data["deleted_keys"] == []

        # Verify the value is stored (encrypted) in the database.
        async with db() as session:
            secret = await session.scalar(
                sa.select(models.Secret).where(models.Secret.key == "OPENAI_API_KEY")
            )
        assert secret is not None
        # The stored value is encrypted bytes, not the plaintext.
        assert secret.value != b"sk-test-1234"

    async def test_update_existing_secret(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Updates an existing secret via a second PUT call."""
        await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "ANTHROPIC_API_KEY", "value": "sk-ant-original"}]},
        )
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "ANTHROPIC_API_KEY", "value": "sk-ant-updated"}]},
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["upserted_keys"] == ["ANTHROPIC_API_KEY"]
        assert data["deleted_keys"] == []

    async def test_delete_existing_secret(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Deletes a secret by setting value to null."""
        await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "OLD_KEY", "value": "old-value"}]},
        )
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "OLD_KEY", "value": None}]},
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["upserted_keys"] == []
        assert data["deleted_keys"] == ["OLD_KEY"]

        async with db() as session:
            secret = await session.scalar(
                sa.select(models.Secret).where(models.Secret.key == "OLD_KEY")
            )
        assert secret is None

    async def test_missing_value_field_returns_422_without_deleting_existing_secret(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Omitting value is rejected and leaves an existing secret untouched."""
        await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "OPENAI_API_KEY", "value": "sk-test-1234"}]},
        )

        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "OPENAI_API_KEY"}]},
        )

        assert response.status_code == 422, response.text

        async with db() as session:
            secret = await session.scalar(
                sa.select(models.Secret).where(models.Secret.key == "OPENAI_API_KEY")
            )
        assert secret is not None

    async def test_delete_nonexistent_secret_is_idempotent(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """Deleting a key that doesn't exist succeeds silently."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "NONEXISTENT_KEY", "value": None}]},
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["deleted_keys"] == ["NONEXISTENT_KEY"]

    async def test_batch_upsert_and_delete(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """Batch request with both upserts and deletes."""
        await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "TO_DELETE", "value": "v"}]},
        )
        response = await httpx_client.put(
            "v1/secrets",
            json={
                "secrets": [
                    {"key": "NEW_KEY_1", "value": "val1"},
                    {"key": "NEW_KEY_2", "value": "val2"},
                    {"key": "TO_DELETE", "value": None},
                ]
            },
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert set(data["upserted_keys"]) == {"NEW_KEY_1", "NEW_KEY_2"}
        assert data["deleted_keys"] == ["TO_DELETE"]

    async def test_duplicate_keys_last_wins(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """When the same key appears twice, the last occurrence wins."""
        response = await httpx_client.put(
            "v1/secrets",
            json={
                "secrets": [
                    {"key": "DUP_KEY", "value": "first-value"},
                    {"key": "DUP_KEY", "value": "last-value"},
                ]
            },
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["upserted_keys"] == ["DUP_KEY"]

    async def test_empty_secrets_list_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """An empty secrets list is rejected with 422."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": []},
        )
        assert response.status_code == 422, response.text

    async def test_empty_key_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """An empty (or whitespace-only) key is rejected with 422."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "   ", "value": "val"}]},
        )
        assert response.status_code == 422, response.text

    async def test_non_ascii_key_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """A non-ASCII key is rejected with 422."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "КЛЮЧ", "value": "val"}]},
        )
        assert response.status_code == 422, response.text

    async def test_empty_value_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """A whitespace-only value is rejected with 422."""
        response = await httpx_client.put(
            "v1/secrets",
            json={"secrets": [{"key": "SOME_KEY", "value": "   "}]},
        )
        assert response.status_code == 422, response.text

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({}, id="missing_secrets_field"),
            pytest.param({"secrets": "not-a-list"}, id="secrets_not_a_list"),
        ],
    )
    async def test_invalid_request_body_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
        payload: dict[str, object],
    ) -> None:
        """Malformed request bodies are rejected with 422."""
        response = await httpx_client.put("v1/secrets", json=payload)
        assert response.status_code == 422, response.text

    def test_openapi_marks_secret_value_as_required_and_nullable(self) -> None:
        """The generated schema requires value but still allows explicit null."""
        schema = get_openapi_schema()
        secret_key_value_schema = schema["components"]["schemas"]["SecretKeyValue"]

        assert set(secret_key_value_schema["required"]) == {"key", "value"}
        value_schema = secret_key_value_schema["properties"]["value"]
        assert {"type": "string"} in value_schema["anyOf"]
        assert {"type": "null"} in value_schema["anyOf"]
