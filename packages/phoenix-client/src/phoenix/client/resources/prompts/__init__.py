import httpx

from phoenix.client.types.v1 import GetPromptResponseBody, PromptVersion


class Prompts:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_version_by_id(self, version_id: str) -> PromptVersion:
        response = self._client.get(f"v1/prompt_versions/{version_id}")
        response.raise_for_status()
        return GetPromptResponseBody.model_validate_json(response.content).data

    def get_version_by_tag(self, prompt_identifier: str, tag: str) -> PromptVersion:
        response = self._client.get(f"v1/prompts/{prompt_identifier}/tags/{tag}")
        response.raise_for_status()
        return GetPromptResponseBody.model_validate_json(response.content).data


class AsyncPrompts:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get_version_by_id(self, version_id: str) -> PromptVersion:
        response = await self._client.get(f"v1/prompt_versions/{version_id}")
        response.raise_for_status()
        return GetPromptResponseBody.model_validate_json(response.content).data

    async def get_version_by_tag(self, prompt_identifier: str, tag: str) -> PromptVersion:
        response = await self._client.get(f"v1/prompts/{prompt_identifier}/tag/{tag}")
        response.raise_for_status()
        return GetPromptResponseBody.model_validate_json(response.content).data
