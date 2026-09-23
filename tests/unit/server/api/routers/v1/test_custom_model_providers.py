from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.GenerativeModelCustomProvider import GenerativeModelCustomProvider
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory


class TestCustomModelProviders:
    @pytest.mark.parametrize("num_custom_providers", [0, 3])
    async def test_get_custom_model_providers(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        num_custom_providers: int,
    ) -> None:
        """
        Test the first page, with and without custom providers in the database.

        This test verifies that:
        1. The GET /custom_model_providers endpoint returns a 200 status code
        2. Every seeded custom provider is returned with its stored fields
        3. Timestamps round-trip as ISO strings parseable by `datetime.fromisoformat`
        4. `next_cursor` is null because there is no further page
        """
        custom_providers = await self._insert_custom_providers(db, num_custom_providers)

        response = await httpx_client.get("v1/custom_model_providers")
        assert response.status_code == 200, (
            f"GET /custom_model_providers should return 200 status code, "
            f"got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain 'data' field"
        assert data["next_cursor"] is None, "A single page should not paginate"

        entries = data["data"]
        assert isinstance(entries, list), "Response data should be a list"

        entries_by_id = {entry["id"]: entry for entry in entries}
        assert len(entries_by_id) == num_custom_providers, (
            f"Expected {num_custom_providers} custom providers, got {len(entries_by_id)}"
        )
        for custom_provider in custom_providers:
            global_id = str(
                GlobalID(GenerativeModelCustomProvider.__name__, str(custom_provider.id))
            )
            assert global_id in entries_by_id, f"Custom provider {global_id} should be returned"
            self._compare_custom_provider(entries_by_id[global_id], custom_provider)

    async def test_get_custom_model_providers_never_returns_config(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that the encrypted `config` column is never exposed.

        The `config` column holds Fernet-encrypted provider credentials and must
        not be reachable through this endpoint under any key. This test verifies
        that:
        1. No entry carries a `config` key
        2. Neither the ciphertext nor the plaintext credential appears anywhere in
           the raw response body, not merely in the parsed response model
        """
        secret_api_key = "sk-super-secret-credential-value"
        plaintext_config = (
            '{"type":"openai","openai_authentication_method":'
            f'{{"type":"api_key","api_key":"{secret_api_key}"}}}}'
        ).encode()
        encrypted_config = EncryptionService().encrypt(plaintext_config)
        async with db() as session:
            custom_provider = models.GenerativeModelCustomProvider(
                name="provider-with-credentials",
                description="A provider whose credentials must never be returned",
                provider="openai",
                sdk="openai",
                config=encrypted_config,
            )
            session.add(custom_provider)
            await session.flush()

        response = await httpx_client.get("v1/custom_model_providers")
        assert response.is_success, (
            f"GET /custom_model_providers failed with status code "
            f"{response.status_code}: {response.text}"
        )

        entries = response.json()["data"]
        assert len(entries) == 1, "The seeded custom provider should be returned"
        for entry in entries:
            assert "config" not in entry, f"Response entry should not contain 'config': {entry}"

        raw_body = response.text
        assert "config" not in raw_body, (
            "The raw response body should not mention 'config' anywhere"
        )
        assert secret_api_key not in raw_body, (
            "The raw response body should not contain the plaintext credential"
        )
        assert encrypted_config.decode() not in raw_body, (
            "The raw response body should not contain the encrypted config"
        )

    async def test_get_custom_model_providers_paginates(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that the endpoint pages through custom providers.

        This test verifies that:
        1. Every page carries at most `limit` entries, `limit` included
        2. `next_cursor` is returned while custom providers remain
        3. Walking every page yields each custom provider exactly once
        """
        limit = 2
        custom_providers = await self._insert_custom_providers(db, 5)
        expected_ids = {
            str(GlobalID(GenerativeModelCustomProvider.__name__, str(p.id)))
            for p in custom_providers
        }

        seen_ids: list[str] = []
        cursor = None
        while True:
            params: dict[str, Any] = {"limit": limit}
            if cursor:
                params["cursor"] = cursor
            response = await httpx_client.get("v1/custom_model_providers", params=params)
            assert response.is_success, (
                f"GET /custom_model_providers failed with status code "
                f"{response.status_code}: {response.text}"
            )
            page = response.json()
            entries = page["data"]
            assert len(entries) <= limit, (
                f"A page should carry at most {limit} custom providers, got {len(entries)}"
            )
            seen_ids.extend(entry["id"] for entry in entries)
            cursor = page["next_cursor"]
            if not cursor:
                break

        assert len(seen_ids) == len(set(seen_ids)), "No custom provider should be returned twice"
        assert set(seen_ids) == expected_ids, (
            f"Custom provider IDs mismatch. Expected: {expected_ids}, Got: {set(seen_ids)}"
        )

    @pytest.mark.parametrize(
        "cursor",
        [
            pytest.param("not-a-global-id", id="not_a_global_id"),
            pytest.param(str(GlobalID("Project", "1")), id="global_id_of_another_node_type"),
            pytest.param(
                str(GlobalID(GenerativeModelCustomProvider.__name__, "not-an-int")),
                id="global_id_with_non_integer_node_id",
            ),
            pytest.param("", id="empty_string_is_treated_as_no_cursor"),
        ],
    )
    async def test_get_custom_model_providers_with_invalid_cursor(
        self,
        httpx_client: httpx.AsyncClient,
        cursor: str,
    ) -> None:
        """
        Test the endpoint's handling of malformed cursors.

        An empty cursor is indistinguishable from an omitted one and is treated as
        a request for the first page; any other value that is not a custom-provider
        GlobalID -- unparseable, a GlobalID for a different node type, or one whose
        node ID is not an integer -- is rejected with a 422.
        """
        response = await httpx_client.get("v1/custom_model_providers", params={"cursor": cursor})
        if not cursor:
            assert response.is_success, (
                f"An empty cursor should be treated as the first page, "
                f"got {response.status_code}: {response.text}"
            )
            return
        assert response.status_code == 422, (
            f"An invalid cursor should return 422, got {response.status_code}: {response.text}"
        )

    @staticmethod
    async def _insert_custom_providers(
        db: DbSessionFactory,
        num: int = 3,
    ) -> list[models.GenerativeModelCustomProvider]:
        """Seed `num` custom providers, each with an encrypted config."""
        encryption_service = EncryptionService()
        custom_providers = []
        async with db() as session:
            for i in range(num):
                custom_provider = models.GenerativeModelCustomProvider(
                    name=f"custom-provider-{i}",
                    description=f"Custom provider {i}",
                    provider="openai",
                    sdk="openai",
                    config=encryption_service.encrypt(b"{}"),
                )
                session.add(custom_provider)
                custom_providers.append(custom_provider)
            await session.flush()
        return custom_providers

    @staticmethod
    def _compare_custom_provider(
        entry: dict[str, Any],
        custom_provider: models.GenerativeModelCustomProvider,
    ) -> None:
        """Assert that a response entry matches the seeded database row."""
        assert entry["name"] == custom_provider.name
        assert entry["description"] == custom_provider.description
        assert entry["provider"] == custom_provider.provider
        assert entry["sdk"] == custom_provider.sdk
        assert datetime.fromisoformat(entry["created_at"]) == custom_provider.created_at
        assert datetime.fromisoformat(entry["updated_at"]) == custom_provider.updated_at
