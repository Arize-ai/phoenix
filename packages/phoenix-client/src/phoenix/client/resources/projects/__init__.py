from __future__ import annotations

import logging
from typing import Optional, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.encode_path_param import encode_path_param

logger = logging.getLogger(__name__)


class Projects:
    """Client for interacting with the Projects API endpoints.

    This class provides synchronous methods for creating, retrieving, updating, and deleting projects.

    Example:
        ```python
        from phoenix.client import Client

        client = Client()
        projects = client.projects.list()
        project = client.projects.get(project_id="UHJvamVjdDoy")
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.Client) -> None:
        """Initialize the Projects client.

        Args:
            client: The httpx client to use for making requests.
        """
        self._client = client

    def get(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> v1.Project:
        """Get a project by ID or name.

        Args:
            project_id: The ID of the project to retrieve.
            project_name: The name of the project to retrieve.

        Returns:
            The project with the specified ID or name.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            # Get by ID
            project = client.projects.get(project_id="UHJvamVjdDoy")
            # Get by name
            project = client.projects.get(project_name="My Project")
            print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        response = self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetProjectResponseBody, response.json())["data"]

    def list(
        self,
    ) -> list[v1.Project]:
        """List all projects.

        Returns:
            A list of all projects.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            projects = client.projects.list()
            for project in projects:
                print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        all_projects: list[v1.Project] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/projects"
            params = {"cursor": next_cursor} if next_cursor else {}
            response = self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetProjectsResponseBody, response.json())
            all_projects.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_projects

    def create(
        self,
        *,
        name: str,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Create a new project.

        Args:
            name: The name of the project.
            description: An optional description of the project.

        Returns:
            The newly created project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            project = client.projects.create(
                name="My Project",
                description="A description of my project",
            )
            print(f"Created project with ID: {project['id']}")
            ```
        """  # noqa: E501
        url = "v1/projects"
        json_ = v1.CreateProjectRequestBody(name=name)
        if description:
            json_["description"] = description
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateProjectResponseBody, response.json())["data"]

    def update(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Update a project by ID or name.

        Note:
            Project names cannot be changed. If a name is provided, it will be ignored.

        Args:
            project_id: The ID of the project to update.
            project_name: The name of the project to update.
            description: The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            # Update by ID
            project = client.projects.update(
                project_id="UHJvamVjdDoy",
                description="Updated project description",
            )
            # Update by name
            project = client.projects.update(
                project_name="My Project",
                description="Updated project description",
            )
            print(f"Updated project description: {project['description']}")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        if description is None:
            raise ValueError("description must be provided.")
        json_ = v1.UpdateProjectRequestBody(description=description)
        response = self._client.put(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateProjectResponseBody, response.json())["data"]

    def delete(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> None:
        """Delete a project by ID or name.

        Args:
            project_id: The ID of the project to delete.
            project_name: The name of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            # Delete by ID
            client.projects.delete(project_id="UHJvamVjdDoy")
            # Delete by name
            client.projects.delete(project_name="My Project")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        response = self._client.delete(url)
        response.raise_for_status()


class AsyncProjects:
    """Asynchronous client for interacting with the Projects API endpoints.

    This class provides asynchronous methods for creating, retrieving, updating, and deleting projects.

    Example:
        ```python
        from phoenix.client import AsyncClient

        async_client = AsyncClient()
        projects = await async_client.projects.list()
        project = await async_client.projects.get(project_id="UHJvamVjdDoy")
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.AsyncClient) -> None:
        """Initialize the AsyncProjects client.

        Args:
            client: The httpx async client to use for making requests.
        """
        self._client = client

    async def get(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> v1.Project:
        """Get a project by ID or name.

        Args:
            project_id: The ID of the project to retrieve.
            project_name: The name of the project to retrieve.

        Returns:
            The project with the specified ID or name.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            project = await async_client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        response = await self._client.get(url)
        response.raise_for_status()
        return cast(v1.GetProjectResponseBody, response.json())["data"]

    async def list(
        self,
    ) -> list[v1.Project]:
        """List all projects.

        Returns:
            A list of all projects.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            projects = await async_client.projects.list()
            for project in projects:
                print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        all_projects: list[v1.Project] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/projects"
            params = {"cursor": next_cursor} if next_cursor else {}
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetProjectsResponseBody, response.json())
            all_projects.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_projects

    async def create(
        self,
        *,
        name: str,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Create a new project.

        Args:
            name: The name of the project.
            description: An optional description of the project.

        Returns:
            The newly created project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            project = await async_client.projects.create(
                name="My Project",
                description="A description of my project",
            )
            print(f"Created project with ID: {project['id']}")
            ```
        """  # noqa: E501
        url = "v1/projects"
        json_ = v1.CreateProjectRequestBody(name=name)
        if description:
            json_["description"] = description
        response = await self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateProjectResponseBody, response.json())["data"]

    async def update(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Update a project by ID or name.

        Note:
            Project names cannot be changed. If a name is provided, it will be ignored.

        Args:
            project_id: The ID of the project to update.
            project_name: The name of the project to update.
            description: The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            # Update by ID
            project = await async_client.projects.update(
                project_id="UHJvamVjdDoy",
                description="Updated project description",
            )
            # Update by name
            project = await async_client.projects.update(
                project_name="My Project",
                description="Updated project description",
            )
            print(f"Updated project description: {project['description']}")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        if description is None:
            raise ValueError("description must be provided.")
        json_ = v1.UpdateProjectRequestBody(description=description)
        response = await self._client.put(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateProjectResponseBody, response.json())["data"]

    async def delete(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> None:
        """Delete a project by ID or name.

        Args:
            project_id: The ID of the project to delete.
            project_name: The name of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither project_id nor project_name is provided.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            # Delete by ID
            await async_client.projects.delete(project_id="UHJvamVjdDoy")
            # Delete by name
            await async_client.projects.delete(project_name="My Project")
            ```
        """  # noqa: E501
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        if project_name:
            project_identifier = project_name
        else:
            assert project_id
            project_identifier = project_id
        url = f"v1/projects/{encode_path_param(project_identifier)}"
        response = await self._client.delete(url)
        response.raise_for_status()
