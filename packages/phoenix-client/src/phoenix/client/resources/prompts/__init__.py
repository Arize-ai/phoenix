from __future__ import annotations

import logging
from typing import Optional, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.types.prompts import PromptVersion
from phoenix.client.utils.encode_path_param import encode_path_param

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

    This class allows you to retrieve and create prompt version tags. Tags are useful for
    organizing and categorizing different versions of prompts, making it easier to track
    and manage prompt versions.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> Client().prompts.tags.list(prompt_version_id="...")
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
        """
        Creates a new tag for a specific prompt version.

        Args:
            prompt_version_id (str): The unique identifier for the prompt version to tag.
            name (str): The name of the tag. Should be a descriptive identifier for the tag.
            description (Optional[str]): An optional description providing additional context
                about the tag's purpose or significance.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.
                This could happen if the prompt version doesn't exist or if there are
                permission issues.

        Example:
            >>> client.prompts.tags.create(
            ...     prompt_version_id="version-123",
            ...     name="staging",
            ...     description="Ready for staging environment"
            ... )
        """
        url = f"v1/prompt_versions/{encode_path_param(prompt_version_id)}/tags"
        data = v1.PromptVersionTagData(name=name)
        if description:
            data["description"] = description
        response = self._client.post(url, json=data)
        response.raise_for_status()

    def list(
        self,
        *,
        prompt_version_id: str,
    ) -> list[v1.PromptVersionTag]:
        """
        Retrieves all tags associated with a specific prompt version.

        Args:
            prompt_version_id (str): The unique identifier for the prompt version.

        Returns:
            list[v1.PromptVersionTag]: A list of tags associated with the prompt version.
            Each tag contains information such as name and description.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.
                This could happen if the prompt version doesn't exist or if there are
                permission issues.

        Example:
            >>> tags = client.prompts.tags.list(prompt_version_id="version-123")
            >>> for tag in tags:
            ...     print(f"Tag: {tag.name}, Description: {tag.description}")
        """
        url = f"v1/prompt_versions/{encode_path_param(prompt_version_id)}/tags"
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
    Provides asynchronous methods for interacting with prompt version tags.

    This class allows you to retrieve and create prompt version tags asynchronously. Tags are
    useful for organizing and categorizing different versions of prompts, making it easier to
    track and manage prompt versions in an asynchronous context.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> await Client().prompts.tags.list(prompt_version_id="...")
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
        """
        Asynchronously creates a new tag for a specific prompt version.

        Args:
            prompt_version_id (str): The unique identifier for the prompt version to tag.
            name (str): The name of the tag. Should be a descriptive identifier for the tag.
            description (Optional[str]): An optional description providing additional context
                about the tag's purpose or significance.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.
                This could happen if the prompt version doesn't exist or if there are
                permission issues.

        Example:
            >>> await client.prompts.tags.create(
            ...     prompt_version_id="version-123",
            ...     name="staging",
            ...     description="Ready for staging environment"
            ... )
        """
        url = f"v1/prompt_versions/{encode_path_param(prompt_version_id)}/tags"
        data = v1.PromptVersionTagData(name=name)
        if description:
            data["description"] = description
        response = await self._client.post(url, json=data)
        response.raise_for_status()

    async def list(
        self,
        *,
        prompt_version_id: str,
    ) -> list[v1.PromptVersionTag]:
        """
        Asynchronously retrieves all tags associated with a specific prompt version.

        Args:
            prompt_version_id (str): The unique identifier for the prompt version.

        Returns:
            list[v1.PromptVersionTag]: A list of tags associated with the prompt version.
            Each tag contains information such as name and description.

        Raises:
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.
                This could happen if the prompt version doesn't exist or if there are
                permission issues.

        Example:
            >>> tags = await client.prompts.tags.list(prompt_version_id="version-123")
            >>> for tag in tags:
            ...     print(f"Tag: {tag.name}, Description: {tag.description}")
        """
        url = f"v1/prompt_versions/{encode_path_param(prompt_version_id)}/tags"
        response = await self._client.get(url)
        response.raise_for_status()
        return list(cast(v1.GetPromptVersionTagsResponseBody, response.json())["data"])


def _url(
    prompt_version_id: Optional[str] = None,
    prompt_identifier: Optional[str] = None,
    tag: Optional[str] = None,
) -> str:
    """
    Constructs the appropriate URL for prompt-related API endpoints.

    This helper function builds the correct URL path based on the provided parameters.
    It supports three different URL patterns:
    1. Direct prompt version access
    2. Latest version of a prompt
    3. Tagged version of a prompt

    Args:
        prompt_version_id (Optional[str]): The unique identifier for a specific prompt version.
        prompt_identifier (Optional[str]): The unique identifier for a prompt.
        tag (Optional[str]): An optional tag to filter the prompt version.

    Returns:
        str: The constructed URL path for the API endpoint.

    Raises:
        AssertionError: If neither prompt_version_id nor prompt_identifier is provided,
            or if the provided values are not strings.

    Example:
        >>> _url(prompt_version_id="version-123")
        'v1/prompt_versions/version-123'
        >>> _url(prompt_identifier="my-prompt")
        'v1/prompts/my-prompt/latest'
        >>> _url(prompt_identifier="my-prompt", tag="production")
        'v1/prompts/my-prompt/tags/production'
    """
    if prompt_version_id is not None:
        assert isinstance(prompt_version_id, str)
        return f"v1/prompt_versions/{encode_path_param(prompt_version_id)}"
    assert (
        prompt_identifier is not None
    ), "Must specify either `prompt_version_id` or `prompt_identifier`"
    assert isinstance(prompt_identifier, str)
    if tag is not None:
        assert isinstance(tag, str)
        return f"v1/prompts/{encode_path_param(prompt_identifier)}/tags/{encode_path_param(tag)}"
    return f"v1/prompts/{encode_path_param(prompt_identifier)}/latest"
