from __future__ import annotations

import httpx
from fastapi import FastAPI

from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY


class TestModelProviders:
    async def test_get_model_providers_returns_every_builtin_family(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
    ) -> None:
        """
        Test that the endpoint lists the built-in provider families.

        This test verifies that:
        1. The GET /model_providers endpoint returns a 200 status code
        2. Every allowed built-in provider family is present, keyed by its
           `provider` (the expectation is computed from the same allow-list
           snapshot the app serves from, so the test is robust to a
           PHOENIX_ALLOWED_PROVIDERS value in the ambient environment)
        3. The response is not paginated, since built-in families are a fixed enum
           rather than stored records
        """
        response = await httpx_client.get("v1/model_providers")
        assert response.status_code == 200, (
            f"GET /model_providers should return 200 status code, "
            f"got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain 'data' field"
        assert "next_cursor" not in data, (
            "Built-in families are a fixed enum, so the response should not be paginated"
        )

        entries = data["data"]
        assert isinstance(entries, list), "Response data should be a list"

        expected = {
            provider_key.to_model_provider().value: provider_key.value
            for provider_key in PLAYGROUND_CLIENT_REGISTRY.list_allowed_providers(
                app.state.allowed_provider_names
            )
        }
        assert expected, "The playground registry should have registered provider families"
        actual = {entry["provider"]: entry["name"] for entry in entries}
        assert actual == expected, (
            f"Built-in providers mismatch. Expected: {expected}, Got: {actual}"
        )

    async def test_get_model_providers_honors_allow_list(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
    ) -> None:
        """
        Test that the endpoint narrows the list to the configured allow-list.

        The allow-list (PHOENIX_ALLOWED_PROVIDERS) is snapshotted onto
        `app.state.allowed_provider_names` at app creation; overriding it here
        must hide every family outside the allow-list.
        """
        app.state.allowed_provider_names = frozenset({"OPENAI"})

        response = await httpx_client.get("v1/model_providers")
        assert response.status_code == 200, (
            f"GET /model_providers should return 200 status code, "
            f"got {response.status_code}: {response.text}"
        )

        entries = response.json()["data"]
        assert {entry["provider"] for entry in entries} == {"OPENAI"}, (
            f"Only the allowed provider family should be returned, got {entries}"
        )
        assert entries[0]["name"] == "OpenAI", (
            "The allowed family should carry its human-readable name"
        )

    async def test_get_model_providers_never_returns_custom_provider_fields(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test that custom providers are not reachable through this endpoint.

        Custom providers are a separate collection served by
        GET /custom_model_providers, so every entry here should carry only the
        built-in family fields, and in particular no `id` or `config`.
        """
        response = await httpx_client.get("v1/model_providers")
        assert response.is_success, (
            f"GET /model_providers failed with status code {response.status_code}: {response.text}"
        )

        for entry in response.json()["data"]:
            assert set(entry) == {"provider", "name"}, (
                f"A built-in family should carry only 'provider' and 'name': {entry}"
            )
