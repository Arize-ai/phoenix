from typing import Optional

import httpx

from phoenix.client.__generated__.v1 import GetPromptResponseBody, PromptVersion


class Prompts:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> PromptVersion:
        if prompt_version_id is not None:
            response = self._client.get(f"v1/prompt_versions/{prompt_version_id}")
            response.raise_for_status()
            return GetPromptResponseBody.model_validate_json(response.content).data
        if prompt_identifier is not None and tag is not None:
            response = self._client.get(f"v1/prompts/{prompt_identifier}/tags/{tag}")
            response.raise_for_status()
            return GetPromptResponseBody.model_validate_json(response.content).data
        raise NotImplementedError


class AsyncPrompts:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> PromptVersion:
        if prompt_version_id is not None:
            response = await self._client.get(f"v1/prompt_versions/{prompt_version_id}")
            response.raise_for_status()
            return GetPromptResponseBody.model_validate_json(response.content).data
        if prompt_identifier is not None and tag is not None:
            response = await self._client.get(f"v1/prompts/{prompt_identifier}/tags/{tag}")
            response.raise_for_status()
            return GetPromptResponseBody.model_validate_json(response.content).data
        raise NotImplementedError
