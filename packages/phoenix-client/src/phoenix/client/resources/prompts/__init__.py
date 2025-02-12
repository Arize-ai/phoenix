from typing import Optional, cast
from urllib.parse import quote_plus

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.config import _PYDANTIC_VERSION  # pyright: ignore[reportPrivateUsage]


class Prompts:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> v1.PromptVersionData:
        url = _url(prompt_version_id, prompt_identifier, tag)
        response = self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetPromptResponseBody, response.json())["data"]

    def create(
        self,
        *,
        version: v1.PromptVersion,
        name: str,
        description: Optional[str] = None,
    ) -> v1.PromptVersionData:
        url = "v1/prompts"
        prompt = v1.Prompt(name=name)
        if description:
            prompt["description"] = description
        if _PYDANTIC_VERSION.startswith("2"):
            import phoenix.client.__generated__.v1.models as m1

            json_ = cast(
                v1.CreatePromptRequestBody,
                m1.CreatePromptRequestBody.model_validate(
                    {"prompt": {"name": name, "description": description}, "version": version}
                ).model_dump(exclude_unset=True, exclude_defaults=True, by_alias=True),
            )
        else:
            json_ = v1.CreatePromptRequestBody(prompt=prompt, version=version)
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreatePromptResponseBody, response.json())["data"]


class AsyncPrompts:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> v1.PromptVersionData:
        url = _url(prompt_version_id, prompt_identifier, tag)
        response = await self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetPromptResponseBody, response.json())["data"]


def _url(
    prompt_version_id: Optional[str] = None,
    prompt_identifier: Optional[str] = None,
    tag: Optional[str] = None,
) -> str:
    if prompt_version_id is not None:
        assert isinstance(prompt_version_id, str)
        return f"v1/prompt_versions/{quote_plus(prompt_version_id)}"
    assert (
        prompt_identifier is not None
    ), "Must specify either `prompt_version_id` or `prompt_identifier`"
    assert isinstance(prompt_identifier, str)
    if tag is not None:
        assert isinstance(tag, str)
        return f"v1/prompts/{quote_plus(prompt_identifier)}/tags/{quote_plus(tag)}"
    return f"v1/prompts/{quote_plus(prompt_identifier)}/latest"
