from __future__ import annotations

import httpx

from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY


class TestModelProviders:
    async def test_get_model_providers_returns_every_builtin_family(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test that the endpoint lists the built-in provider families.

        This test verifies that:
        1. The GET /model_providers endpoint returns a 200 status code
        2. Every built-in provider family is present, keyed by its `provider`
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
            for provider_key in PLAYGROUND_CLIENT_REGISTRY.list_all_providers()
        }
        actual = {entry["provider"]: entry["name"] for entry in entries}
        assert actual == expected, (
            f"Built-in providers mismatch. Expected: {expected}, Got: {actual}"
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
