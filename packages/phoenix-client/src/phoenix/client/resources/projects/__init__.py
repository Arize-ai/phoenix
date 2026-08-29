from __future__ import annotations

import logging
from typing import Optional, Sequence, Union, cast

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

logger = logging.getLogger(__name__)

AnnotationConfig = Union[
    v1.CategoricalAnnotationConfig,
    v1.ContinuousAnnotationConfig,
    v1.FreeformAnnotationConfig,
]
"""One of the annotation config shapes the REST API returns."""

AnnotationConfigList = list[AnnotationConfig]
"""A list of annotation configs.

Aliased at module scope because ``Projects.list`` and ``AsyncProjects.list`` shadow the
``list`` builtin inside their class bodies, so a ``list[...]`` annotation on any method
declared after them would resolve to the method rather than the builtin.
"""


def _project_identifier(project_id: Optional[str], project_name: Optional[str]) -> str:
    """Resolve the project path segment from exactly one of an ID or a name."""
    if not project_id and not project_name:
        raise ValueError("Either project_id or project_name must be provided.")
    if project_id and project_name:
        raise ValueError("Only one of project_id or project_name can be provided.")
    return project_name or cast(str, project_id)


class Projects:
    """Client for interacting with the Projects API endpoints.

    This class provides synchronous methods for creating, retrieving, updating,
    and deleting projects.

    Examples:
        Basic project operations::

            from phoenix.client import Client
            client = Client()

            # List all projects
            projects = client.projects.list()
            for project in projects:
                print(f"Project: {project['name']}")

            # Get a specific project
            project = client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")

            # Create a new project
            new_project = client.projects.create(
                name="My Project",
                description="A description of my project"
            )

            # Update a project
            updated_project = client.projects.update(
                project_id=new_project["id"],
                description="Updated description"
            )

            # Delete a project
            client.projects.delete(project_id=new_project["id"])
    """

    def __init__(
        self,
        client: httpx.Client,
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        """Initialize the Projects client.

        Args:
            client (httpx.Client): The httpx client to use for making requests.
        """
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)

    def get(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> v1.Project:
        """Get a project by ID or name.

        Args:
            project_id (Optional[str]): The ID of the project to retrieve.
            project_name (Optional[str]): The name of the project to retrieve.

        Returns:
            The project with the specified ID or name.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Get by ID
            project = client.projects.get(project_id="UHJvamVjdDoy")

            # Get by name
            project = client.projects.get(project_name="My Project")
            print(f"Project name: {project['name']}")
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
        *,
        name_contains: Optional[str] = None,
    ) -> list[v1.Project]:
        """List all projects.

        Args:
            name_contains (Optional[str]): If provided, only return projects whose
                name contains this substring (case-insensitive).

        Returns:
            A list of all projects.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example::

            from phoenix.client import Client
            client = Client()

            projects = client.projects.list()
            for project in projects:
                print(f"Project name: {project['name']}")

            # Filter by a substring of the project name
            projects = client.projects.list(name_contains="agent")
        """  # noqa: E501
        all_projects: list[v1.Project] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/projects"
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            if name_contains:
                params["name_contains"] = name_contains
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
            name (str): The name of the project.
            description (Optional[str]): An optional description of the project.

        Returns:
            The newly created project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example::

            from phoenix.client import Client
            client = Client()

            project = client.projects.create(
                name="My Project",
                description="A description of my project",
            )
            print(f"Created project with ID: {project['id']}")
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
            project_id (Optional[str]): The ID of the project to update.
            project_name (Optional[str]): The name of the project to update.
            description (Optional[str]): The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example::

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
            project_id (Optional[str]): The ID of the project to delete.
            project_name (Optional[str]): The name of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither project_id nor project_name is provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Delete by ID
            client.projects.delete(project_id="UHJvamVjdDoy")

            # Delete by name
            client.projects.delete(project_name="My Project")
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

    def list_annotation_configs(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfigList:
        """List the annotation configs assigned to a project.

        Cursor pagination is followed to completion, so every assigned config is returned.

        Args:
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation configs currently assigned to the project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import Client
            client = Client()

            configs = client.projects.list_annotation_configs(project_name="My Project")
            for config in configs:
                print(f"Annotation config: {config['name']}")
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = f"v1/projects/{encode_path_param(identifier)}/annotation_configs"
        all_configs: list[AnnotationConfig] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            response = self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetProjectAnnotationConfigsResponseBody, response.json())
            all_configs.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_configs

    def assign_annotation_config(
        self,
        *,
        annotation_config_identifier: str,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfig:
        """Assign an annotation config to a project.

        The assignment is idempotent: assigning a config that is already assigned succeeds
        and returns the same config rather than raising or creating a duplicate.

        Args:
            annotation_config_identifier (str): The ID or name of the annotation config.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation config that is now assigned to the project.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when the project or the
                annotation config does not exist.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import Client
            client = Client()

            config = client.projects.assign_annotation_config(
                project_name="My Project",
                annotation_config_identifier="quality",
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = (
            f"v1/projects/{encode_path_param(identifier)}"
            f"/annotation_configs/{encode_path_param(annotation_config_identifier)}"
        )
        response = self._client.put(url)
        response.raise_for_status()
        return cast(v1.AssignAnnotationConfigToProjectResponseBody, response.json())["data"]

    def unassign_annotation_config(
        self,
        *,
        annotation_config_identifier: str,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> None:
        """Remove an annotation config from a project.

        The annotation config itself is not deleted, only its assignment to this project.

        Args:
            annotation_config_identifier (str): The ID or name of the annotation config.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import Client
            client = Client()

            client.projects.unassign_annotation_config(
                project_name="My Project",
                annotation_config_identifier="quality",
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = (
            f"v1/projects/{encode_path_param(identifier)}"
            f"/annotation_configs/{encode_path_param(annotation_config_identifier)}"
        )
        response = self._client.delete(url)
        response.raise_for_status()

    def set_annotation_configs(
        self,
        *,
        annotation_config_ids: Sequence[str],
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfigList:
        """Replace a project's entire annotation config set.

        Any config not named here is unassigned from the project. Passing an empty sequence
        clears the project's annotation configs. The configs themselves are never deleted.

        Args:
            annotation_config_ids (Sequence[str]): The IDs of the annotation configs the
                project should have after this call.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation configs assigned to the project after the replacement.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Replace the set
            configs = client.projects.set_annotation_configs(
                project_name="My Project",
                annotation_config_ids=["QW5ub3RhdGlvbkNvbmZpZzox"],
            )

            # Clear every assignment
            client.projects.set_annotation_configs(
                project_name="My Project", annotation_config_ids=[]
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = f"v1/projects/{encode_path_param(identifier)}/annotation_configs"
        json_ = v1.SetProjectAnnotationConfigsRequestBody(
            annotation_config_ids=list(annotation_config_ids)
        )
        response = self._client.put(url=url, json=json_)
        response.raise_for_status()
        return list(cast(v1.SetProjectAnnotationConfigsResponseBody, response.json())["data"])


class AsyncProjects:
    """Asynchronous client for interacting with the Projects API endpoints.

    This class provides asynchronous methods for creating, retrieving, updating,
    and deleting projects.

    Examples:
        Basic project operations::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # List all projects
            projects = await async_client.projects.list()
            for project in projects:
                print(f"Project: {project['name']}")

            # Get a specific project
            project = await async_client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")

            # Create a new project
            new_project = await async_client.projects.create(
                name="My Project",
                description="A description of my project"
            )

            # Update a project
            updated_project = await async_client.projects.update(
                project_id=new_project["id"],
                description="Updated description"
            )

            # Delete a project
            await async_client.projects.delete(project_id=new_project["id"])
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        """Initialize the AsyncProjects client.

        Args:
            client (httpx.AsyncClient): The httpx async client to use for making requests.
        """
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)

    async def get(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> v1.Project:
        """Get a project by ID or name.

        Args:
            project_id (Optional[str]): The ID of the project to retrieve.
            project_name (Optional[str]): The name of the project to retrieve.

        Returns:
            The project with the specified ID or name.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Get by ID
            project = await async_client.projects.get(project_id="UHJvamVjdDoy")
            print(f"Project name: {project['name']}")

            # Get by name
            project = await async_client.projects.get(project_name="My Project")
            print(f"Project name: {project['name']}")
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
        *,
        name_contains: Optional[str] = None,
    ) -> list[v1.Project]:
        """List all projects.

        Args:
            name_contains (Optional[str]): If provided, only return projects whose
                name contains this substring (case-insensitive).

        Returns:
            A list of all projects.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            projects = await async_client.projects.list()
            for project in projects:
                print(f"Project name: {project['name']}")

            # Filter by a substring of the project name
            projects = await async_client.projects.list(name_contains="agent")
        """  # noqa: E501
        all_projects: list[v1.Project] = []
        next_cursor: Optional[str] = None
        while True:
            url = "v1/projects"
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            if name_contains:
                params["name_contains"] = name_contains
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
            name (str): The name of the project.
            description (Optional[str]): An optional description of the project.

        Returns:
            The newly created project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            project = await async_client.projects.create(
                name="My Project",
                description="A description of my project",
            )
            print(f"Created project with ID: {project['id']}")
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
            project_id (Optional[str]): The ID of the project to update.
            project_name (Optional[str]): The name of the project to update.
            description (Optional[str]): The new description for the project.

        Returns:
            The updated project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if neither project_id nor project_name is provided.

        Example::

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
            project_id (Optional[str]): The ID of the project to delete.
            project_name (Optional[str]): The name of the project to delete.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither project_id nor project_name is provided.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Delete by ID
            await async_client.projects.delete(project_id="UHJvamVjdDoy")

            # Delete by name
            await async_client.projects.delete(project_name="My Project")
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

    async def list_annotation_configs(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfigList:
        """List the annotation configs assigned to a project.

        Cursor pagination is followed to completion, so every assigned config is returned.

        Args:
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation configs currently assigned to the project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            configs = await client.projects.list_annotation_configs(project_name="My Project")
            for config in configs:
                print(f"Annotation config: {config['name']}")
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = f"v1/projects/{encode_path_param(identifier)}/annotation_configs"
        all_configs: list[AnnotationConfig] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, str] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data = cast(v1.GetProjectAnnotationConfigsResponseBody, response.json())
            all_configs.extend(data["data"])
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_configs

    async def assign_annotation_config(
        self,
        *,
        annotation_config_identifier: str,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfig:
        """Assign an annotation config to a project.

        The assignment is idempotent: assigning a config that is already assigned succeeds
        and returns the same config rather than raising or creating a duplicate.

        Args:
            annotation_config_identifier (str): The ID or name of the annotation config.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation config that is now assigned to the project.

        Raises:
            httpx.HTTPError: If the request fails, including a 404 when the project or the
                annotation config does not exist.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            config = await client.projects.assign_annotation_config(
                project_name="My Project",
                annotation_config_identifier="quality",
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = (
            f"v1/projects/{encode_path_param(identifier)}"
            f"/annotation_configs/{encode_path_param(annotation_config_identifier)}"
        )
        response = await self._client.put(url)
        response.raise_for_status()
        return cast(v1.AssignAnnotationConfigToProjectResponseBody, response.json())["data"]

    async def unassign_annotation_config(
        self,
        *,
        annotation_config_identifier: str,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> None:
        """Remove an annotation config from a project.

        The annotation config itself is not deleted, only its assignment to this project.

        Args:
            annotation_config_identifier (str): The ID or name of the annotation config.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            await client.projects.unassign_annotation_config(
                project_name="My Project",
                annotation_config_identifier="quality",
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = (
            f"v1/projects/{encode_path_param(identifier)}"
            f"/annotation_configs/{encode_path_param(annotation_config_identifier)}"
        )
        response = await self._client.delete(url)
        response.raise_for_status()

    async def set_annotation_configs(
        self,
        *,
        annotation_config_ids: Sequence[str],
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> AnnotationConfigList:
        """Replace a project's entire annotation config set.

        Any config not named here is unassigned from the project. Passing an empty sequence
        clears the project's annotation configs. The configs themselves are never deleted.

        Args:
            annotation_config_ids (Sequence[str]): The IDs of the annotation configs the
                project should have after this call.
            project_id (Optional[str]): The ID of the project.
            project_name (Optional[str]): The name of the project.

        Returns:
            The annotation configs assigned to the project after the replacement.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If neither or both of project_id and project_name are provided.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Replace the set
            configs = await client.projects.set_annotation_configs(
                project_name="My Project",
                annotation_config_ids=["QW5ub3RhdGlvbkNvbmZpZzox"],
            )

            # Clear every assignment
            await client.projects.set_annotation_configs(
                project_name="My Project", annotation_config_ids=[]
            )
        """  # noqa: E501
        identifier = _project_identifier(project_id, project_name)
        url = f"v1/projects/{encode_path_param(identifier)}/annotation_configs"
        json_ = v1.SetProjectAnnotationConfigsRequestBody(
            annotation_config_ids=list(annotation_config_ids)
        )
        response = await self._client.put(url=url, json=json_)
        response.raise_for_status()
        return list(cast(v1.SetProjectAnnotationConfigsResponseBody, response.json())["data"])
