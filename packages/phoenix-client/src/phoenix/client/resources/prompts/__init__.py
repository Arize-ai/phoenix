from __future__ import annotations

import logging
from typing import Any, Optional, cast

import httpx
from httpx import HTTPStatusError

from phoenix.client.__generated__ import v1
from phoenix.client.types.prompts import PromptVersion
from phoenix.client.utils.encode_path_param import encode_path_param

logger = logging.getLogger(__name__)


class Prompts:
    """Provides methods for interacting with prompt resources.

    This class allows you to retrieve and create prompt versions.

    Examples:
        Basic prompt operations::

            from phoenix.client import Client
            client = Client()

            # Get the latest version of a prompt
            prompt_version = client.prompts.get(prompt_identifier="my-prompt")
            print(f"Prompt template: {prompt_version.template}")

            # Get a specific version by ID
            specific_version = client.prompts.get(prompt_version_id="version-123")
            print(f"Model: {specific_version.model_name}")

            # Get a tagged version
            production_version = client.prompts.get(
                prompt_identifier="my-prompt",
                tag="production"
            )

            # Create a new prompt version
            from phoenix.client.types.prompts import PromptVersion
            new_version = client.prompts.create(
                name="sentiment-classifier",
                version=PromptVersion(
                    template="Classify the sentiment: {{text}}",
                    model_name="gpt-4",
                    model_provider="OPENAI"
                ),
                prompt_description="Sentiment classification prompt",
                metadata={"category": "classification", "version": "1.0"}
            )

        Working with tags::

            # List all tags for a prompt version
            tags = client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}")

            # Create a new tag
            client.prompts.tags.create(
                prompt_version_id="version-123",
                name="staging",
                description="Ready for staging deployment"
            )
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
            ValueError: If prompt identifier or prompt version id is not found.
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example::

            from phoenix.client import Client
            client = Client()

            # Get latest version of a prompt
            prompt_version = client.prompts.get(prompt_identifier="my-prompt")
            print(f"Template: {prompt_version.template}")

            # Get specific version by ID
            specific_version = client.prompts.get(prompt_version_id="version-123")

            # Get tagged version
            tagged_version = client.prompts.get(
                prompt_identifier="my-prompt",
                tag="production"
            )
        """
        url = _url(prompt_version_id, prompt_identifier, tag)
        try:
            prompt_response = self._client.get(url)
            prompt_response.raise_for_status()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Prompt not found: {prompt_version_id or prompt_identifier}")
            raise
        return PromptVersion._loads(cast(v1.GetPromptResponseBody, prompt_response.json())["data"])  # pyright: ignore[reportPrivateUsage]

    def create(
        self,
        *,
        version: PromptVersion,
        name: str,
        prompt_description: Optional[str] = None,
        prompt_metadata: Optional[dict[str, Any]] = None,
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
            prompt_metadata (Optional[dict[str, Any]]): An optional metadata dictionary
                for the prompt. If prompt already exists, this value is ignored by the server.

        Returns:
            PromptVersion: The created prompt version data.
        """
        url = "v1/prompts"
        prompt = v1.PromptData(name=name)
        if prompt_description:
            prompt["description"] = prompt_description
        if prompt_metadata:
            prompt["metadata"] = prompt_metadata
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

    Examples:
        Tag management operations::

            from phoenix.client import Client
            client = Client()

            # List all tags for a prompt version
            tags = client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}, Description: {tag['description']}")

            # Create a new tag
            client.prompts.tags.create(
                prompt_version_id="version-123",
                name="production",
                description="Production-ready version"
            )

            # Create multiple tags for different environments
            environments = [
                {"name": "staging", "description": "Staging environment"},
                {"name": "development", "description": "Development environment"},
            ]
            for env in environments:
                client.prompts.tags.create(
                    prompt_version_id="version-123",
                    **env
                )
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

        Example::

            from phoenix.client import Client
            client = Client()

            # Create a tag for a prompt version
            client.prompts.tags.create(
                prompt_version_id="version-123",
                name="staging",
                description="Ready for staging environment"
            )

            # Create a production tag
            client.prompts.tags.create(
                prompt_version_id="version-456",
                name="production",
                description="Production deployment"
            )
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

        Example::

            from phoenix.client import Client
            client = Client()

            # List all tags for a prompt version
            tags = client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}, Description: {tag['description']}")

            # Check if a specific tag exists
            production_tags = [tag for tag in tags if tag['name'] == 'production']
            if production_tags:
                print("Production version is available")
        """
        url = f"v1/prompt_versions/{encode_path_param(prompt_version_id)}/tags"
        response = self._client.get(url)
        response.raise_for_status()
        return list(cast(v1.GetPromptVersionTagsResponseBody, response.json())["data"])


class AsyncPrompts:
    """
    Provides asynchronous methods for interacting with prompt resources.

    This class allows you to retrieve and create prompt versions asynchronously.

    Examples:
        Basic prompt operations::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Get the latest version of a prompt
            prompt_version = await async_client.prompts.get(prompt_identifier="my-prompt")
            print(f"Prompt template: {prompt_version.template}")

            # Get a specific version by ID
            specific_version = await async_client.prompts.get(prompt_version_id="version-123")
            print(f"Model: {specific_version.model_name}")

            # Get a tagged version
            production_version = await async_client.prompts.get(
                prompt_identifier="my-prompt",
                tag="production"
            )

            # Create a new prompt version
            from phoenix.client.types.prompts import PromptVersion
            new_version = await async_client.prompts.create(
                name="sentiment-classifier",
                version=PromptVersion(
                    template="Classify the sentiment: {{text}}",
                    model_name="gpt-4",
                    model_provider="OPENAI"
                ),
                prompt_description="Sentiment classification prompt",
                prompt_metadata={"category": "classification"}
            )

        Working with tags::

            # List all tags for a prompt version
            tags = await async_client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}")

            # Create a new tag
            await async_client.prompts.tags.create(
                prompt_version_id="version-123",
                name="staging",
                description="Ready for staging deployment"
            )
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
            ValueError: If prompt identifier or prompt version id is not found.
            httpx.HTTPStatusError: If the HTTP request returned an unsuccessful status code.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Get latest version of a prompt
            prompt_version = await async_client.prompts.get(prompt_identifier="my-prompt")
            print(f"Template: {prompt_version.template}")

            # Get specific version by ID
            specific_version = await async_client.prompts.get(prompt_version_id="version-123")

            # Get tagged version
            tagged_version = await async_client.prompts.get(
                prompt_identifier="my-prompt",
                tag="production"
            )
        """
        url = _url(prompt_version_id, prompt_identifier, tag)
        try:
            prompt_response = await self._client.get(url)
            prompt_response.raise_for_status()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Prompt not found: {prompt_version_id or prompt_identifier}")
            raise
        return PromptVersion._loads(cast(v1.GetPromptResponseBody, prompt_response.json())["data"])  # pyright: ignore[reportPrivateUsage]

    async def create(
        self,
        *,
        version: PromptVersion,
        name: str,
        prompt_description: Optional[str] = None,
        prompt_metadata: Optional[dict[str, Any]] = None,
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
            prompt_metadata (Optional[dict[str, Any]]): An optional metadata dictionary
                for the prompt. If prompt already exists, this value is ignored by the server.

        Returns:
            PromptVersion: The created prompt version data.
        """
        url = "v1/prompts"
        prompt = v1.PromptData(name=name)
        if prompt_description:
            prompt["description"] = prompt_description
        if prompt_metadata:
            prompt["metadata"] = prompt_metadata
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

    Examples:
        Tag management operations::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # List all tags for a prompt version
            tags = await async_client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}, Description: {tag['description']}")

            # Create a new tag
            await async_client.prompts.tags.create(
                prompt_version_id="version-123",
                name="production",
                description="Production-ready version"
            )

            # Create multiple tags for different environments
            environments = [
                {"name": "staging", "description": "Staging environment"},
                {"name": "development", "description": "Development environment"},
            ]
            for env in environments:
                await async_client.prompts.tags.create(
                    prompt_version_id="version-123",
                    **env
                )
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

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Create a tag for a prompt version
            await async_client.prompts.tags.create(
                prompt_version_id="version-123",
                name="staging",
                description="Ready for staging environment"
            )

            # Create a production tag
            await async_client.prompts.tags.create(
                prompt_version_id="version-456",
                name="production",
                description="Production deployment"
            )
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

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # List all tags for a prompt version
            tags = await async_client.prompts.tags.list(prompt_version_id="version-123")
            for tag in tags:
                print(f"Tag: {tag['name']}, Description: {tag['description']}")

            # Check if a specific tag exists
            production_tags = [tag for tag in tags if tag['name'] == 'production']
            if production_tags:
                print("Production version is available")
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

    Example::

        # Get URL for specific prompt version
        url = _url(prompt_version_id="version-123")
        # Returns: 'v1/prompt_versions/version-123'

        # Get URL for latest version of a prompt
        url = _url(prompt_identifier="my-prompt")
        # Returns: 'v1/prompts/my-prompt/latest'

        # Get URL for tagged version of a prompt
        url = _url(prompt_identifier="my-prompt", tag="production")
        # Returns: 'v1/prompts/my-prompt/tags/production'
    """
    if prompt_version_id is not None:
        assert isinstance(prompt_version_id, str)
        return f"v1/prompt_versions/{encode_path_param(prompt_version_id)}"
    assert prompt_identifier is not None, (
        "Must specify either `prompt_version_id` or `prompt_identifier`"
    )
    assert isinstance(prompt_identifier, str)
    if tag is not None:
        assert isinstance(tag, str)
        return f"v1/prompts/{encode_path_param(prompt_identifier)}/tags/{encode_path_param(tag)}"
    return f"v1/prompts/{encode_path_param(prompt_identifier)}/latest"
