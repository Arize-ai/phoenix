from __future__ import annotations

import logging
from typing import Optional, cast
from urllib.parse import quote_plus

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.types.prompts import PromptVersion

logger = logging.getLogger(__name__)


class Prompts:
    """
    Provides methods for interacting with prompt resources.

    This class allows you to retrieve and create prompt versions.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> Client().prompts.get(prompt_identifier="my-prompt")
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    @property
    def tags(self) -> PromptVersionTags:
        return PromptVersionTags(self._client)

    def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> PromptVersion:
        """
        Retrieves a specific version of a prompt based on the provided identifiers.

        Args:
            prompt_version_id (Optional[str]): The unique identifier for the prompt version.
            prompt_identifier (Optional[str]): The unique identifier for the prompt.
            tag (Optional[str]): An optional tag to filter the prompt version.

        Returns:
            PromptVersion: The retrieved prompt version data.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example:
            Basic usage:
                >>> from phoenix.client import Client
                >>> Client().prompts.get(prompt_identifier="my-prompt")
        """
        url = _url(prompt_version_id, prompt_identifier, tag)
        response = self._client.get(url)
        response.raise_for_status()
        return PromptVersion._loads(cast(v1.GetPromptResponseBody, response.json())["data"])  # pyright: ignore[reportPrivateUsage]

    def create(
        self,
        *,
        version: PromptVersion,
        name: str,
        prompt_description: Optional[str] = None,
    ) -> PromptVersion:
        """
        Creates a new version for the prompt under the name specified. The prompt will
        be created if it doesn't already exist.

        Args:
            version (v1.PromptVersion): The version of the prompt to create.
            name (str): The identifier for the prompt. It can contain alphanumeric
                characters, hyphens and underscores, but must begin with an
                alphanumeric character.
            prompt_description (Optional[str]): An optional description for the prompt.
                If prompt already exists, this value is ignored by the server.

        Returns:
            PromptVersion: The created prompt version data.
        """
        url = "v1/prompts"
        prompt = v1.PromptData(name=name)
        if prompt_description:
            prompt["description"] = prompt_description
        json_ = v1.CreatePromptRequestBody(prompt=prompt, version=version._dumps())  # pyright: ignore[reportPrivateUsage]
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return PromptVersion._loads(cast(v1.CreatePromptResponseBody, response.json())["data"])  # pyright: ignore[reportPrivateUsage]


class PromptVersionTags:
    """
    Provides methods for interacting with prompt version tags.

    This class allows you to retrieve and create prompt version tags.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> Client().prompts.tags.get(prompt_version_id="...")
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def create(
        self,
        *,
        prompt_version_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> None:
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags"
        data = v1.PromptVersionTagData(name=name)
        if description:
            data["description"] = description
        response = self._client.post(url, json=data)
        response.raise_for_status()

    def get(
        self,
        *,
        prompt_version_id: str,
    ) -> list[v1.PromptVersionTag]:
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags"
        response = self._client.get(url)
        response.raise_for_status()
        return list(cast(v1.GetPromptVersionTagsResponseBody, response.json())["data"])


class AsyncPrompts:
    """
    Provides asynchronous methods for interacting with prompt resources.

    This class allows you to retrieve and create prompt versions.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> await AsyncClient().prompts.get(prompt_identifier="my-prompt")
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @property
    def tags(self) -> AsyncPromptVersionTags:
        return AsyncPromptVersionTags(self._client)

    async def get(
        self,
        *,
        prompt_version_id: Optional[str] = None,
        prompt_identifier: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> PromptVersion:
        """
        Retrieves a specific version of a prompt based on the provided identifiers.

        Args:
            prompt_version_id (Optional[str]): The unique identifier for the prompt version.
            prompt_identifier (Optional[str]): The unique identifier for the prompt.
            tag (Optional[str]): An optional tag to filter the prompt version.

        Returns:
            PromptVersion: The retrieved prompt version data.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example:
            Basic usage:
                >>> from phoenix.client import AsyncClient
                >>> await AsyncClient().prompts.get(prompt_identifier="my-prompt")
        """
        url = _url(prompt_version_id, prompt_identifier, tag)
        response = await self._client.get(url)
        response.raise_for_status()
        return PromptVersion._loads(cast(v1.GetPromptResponseBody, response.json())["data"])  # pyright: ignore[reportPrivateUsage]

    async def create(
        self,
        *,
        version: PromptVersion,
        name: str,
        prompt_description: Optional[str] = None,
    ) -> PromptVersion:
        """
        Creates a new version for the prompt under the name specified. The prompt will
        be created if it doesn't already exist.

        Args:
            version (v1.PromptVersion): The version of the prompt to create.
            name (str): The identifier for the prompt. It can contain alphanumeric
                characters, hyphens and underscores, but must begin with an
                alphanumeric character.
            prompt_description (Optional[str]): An optional description for the prompt.
                If prompt already exists, this value is ignored by the server.

        Returns:
            PromptVersion: The created prompt version data.
        """
        url = "v1/prompts"
        prompt = v1.PromptData(name=name)
        if prompt_description:
            prompt["description"] = prompt_description
        json_ = v1.CreatePromptRequestBody(prompt=prompt, version=version._dumps())  # pyright: ignore[reportPrivateUsage]
        response = await self._client.post(url=url, json=json_)
        response.raise_for_status()
        return PromptVersion._loads(cast(v1.CreatePromptResponseBody, response.json())["data"])  # pyright: ignore[reportPrivateUsage]


class AsyncPromptVersionTags:
    """
    Provides methods for interacting with prompt version tags.

    This class allows you to retrieve and create prompt version tags.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> await Client().prompts.tags.get(prompt_version_id="...")
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def create(
        self,
        *,
        prompt_version_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> None:
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags"
        data = v1.PromptVersionTagData(name=name)
        if description:
            data["description"] = description
        response = await self._client.post(url, json=data)
        response.raise_for_status()

    async def get(
        self,
        *,
        prompt_version_id: str,
    ) -> list[v1.PromptVersionTag]:
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags"
        response = await self._client.get(url)
        response.raise_for_status()
        return list(cast(v1.GetPromptVersionTagsResponseBody, response.json())["data"])


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
