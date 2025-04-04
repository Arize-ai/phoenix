from __future__ import annotations

import logging
from typing import Optional, cast
from urllib.parse import quote_plus

import httpx

from phoenix.client.__generated__ import v1

logger = logging.getLogger(__name__)


class Projects:
    """Client for interacting with the Projects API endpoints.

    This class provides methods for creating, retrieving, updating, and deleting projects.
    It supports both synchronous and asynchronous operations.

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
        project_id: str,
    ) -> v1.Project:
        """Get a project by ID.

        Args:
            project_id: The ID of the project to retrieve.

        Returns:
            The project with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            project = client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"
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
        project_data = v1.ProjectData(name=name)
        if description:
            project_data["description"] = description
        json_ = v1.CreateProjectRequestBody(project=project_data)
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateProjectResponseBody, response.json())["data"]

    def update(
        self,
        *,
        project_id: str,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Update a project.

        Note:
            Project names cannot be changed. If a name is provided, it will be ignored.

        Args:
            project_id: The ID of the project to update.
            description: The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            project = client.projects.update(
                project_id="UHJvamVjdDoy",
                description="Updated project description",
            )
            print(f"Updated project description: {project['description']}")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"

        # First get the current project to preserve the name
        current_project = self.get(project_id=project_id)

        project_data = v1.ProjectData(name=current_project["name"])
        if description is not None:
            project_data["description"] = description
        elif "description" in current_project:
            project_data["description"] = current_project["description"]

        json_ = v1.UpdateProjectRequestBody(project=project_data)
        response = self._client.put(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateProjectResponseBody, response.json())["data"]

    def delete(
        self,
        *,
        project_id: str,
    ) -> None:
        """Delete a project.

        Args:
            project_id: The ID of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            client.projects.delete(project_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"
        response = self._client.delete(url)
        response.raise_for_status()


class AsyncProjects:
    """Asynchronous client for interacting with the Projects API endpoints.

    This class provides methods for creating, retrieving, updating, and deleting projects.
    It supports both synchronous and asynchronous operations.

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
        project_id: str,
    ) -> v1.Project:
        """Get a project by ID.

        Args:
            project_id: The ID of the project to retrieve.

        Returns:
            The project with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            project = await async_client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"
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
        project_data = v1.ProjectData(name=name)
        if description:
            project_data["description"] = description
        json_ = v1.CreateProjectRequestBody(project=project_data)
        response = await self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.CreateProjectResponseBody, response.json())["data"]

    async def update(
        self,
        *,
        project_id: str,
        description: Optional[str] = None,
    ) -> v1.Project:
        """Update a project.

        Note:
            Project names cannot be changed. If a name is provided, it will be ignored.

        Args:
            project_id: The ID of the project to update.
            description: The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            project = await async_client.projects.update(
                project_id="UHJvamVjdDoy",
                description="Updated project description",
            )
            print(f"Updated project description: {project['description']}")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"

        # First get the current project to preserve the name
        current_project = await self.get(project_id=project_id)

        project_data = v1.ProjectData(name=current_project["name"])
        if description is not None:
            project_data["description"] = description
        elif "description" in current_project:
            project_data["description"] = current_project["description"]

        json_ = v1.UpdateProjectRequestBody(project=project_data)
        response = await self._client.put(url=url, json=json_)
        response.raise_for_status()
        return cast(v1.UpdateProjectResponseBody, response.json())["data"]

    async def delete(
        self,
        *,
        project_id: str,
    ) -> None:
        """Delete a project.

        Args:
            project_id: The ID of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            await async_client.projects.delete(project_id="UHJvamVjdDoy")
            ```
        """  # noqa: E501
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await self._client.delete(url)
        response.raise_for_status()
