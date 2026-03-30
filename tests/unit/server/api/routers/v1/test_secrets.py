from __future__ import annotations

import httpx
import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.api.openapi.schema import get_openapi_schema
from phoenix.server.types import DbSessionFactory


class TestUpsertOrDeleteSecrets:
    """Validation and schema tests for PUT /v1/secrets."""

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
        assert "explicit null to delete" in value_schema["description"]
        assert "omitting it returns 422" in value_schema["description"]
