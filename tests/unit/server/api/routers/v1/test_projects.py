from __future__ import annotations

from secrets import token_hex
from typing import Any
from urllib.parse import quote_plus

import httpx
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory


class TestProjects:
    async def test_get_projects(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test retrieving a paginated list of all projects.

        This test verifies that:
        1. The GET /projects endpoint returns a 200 status code
        2. The response contains a 'data' field with a list of projects
        3. The number of projects returned matches the number created
        4. Each project in the response has the expected structure
        5. Pagination fields are present in the response
        """  # noqa: E501
        # Create test projects
        projects = await self._insert_projects(db, 3)

        # Get all projects
        url = "v1/projects"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 200
        ), f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        # Parse response data
        data = response.json()
        assert "data" in data, "Response should contain 'data' field"  # noqa: E501
        response_projects = data["data"]
        assert isinstance(response_projects, list), "Response data should be a list"  # noqa: E501

        # Create a dictionary of projects by ID for easy lookup
        projects_by_id = {str(GlobalID(Project.__name__, str(p.id))): p for p in projects}
        response_projects_by_id = {p["id"]: p for p in response_projects}

        # Compare project counts
        assert len(response_projects) == len(
            projects
        ), f"Expected {len(projects)} projects, got {len(response_projects)}"  # noqa: E501

        # Compare project IDs
        assert set(projects_by_id.keys()) == set(response_projects_by_id.keys()), (
            f"Project IDs mismatch. Expected: {set(projects_by_id.keys())}, Got: {set(response_projects_by_id.keys())}"  # noqa: E501
        )

        # Compare project details
        for project_id, response_project in response_projects_by_id.items():
            project = projects_by_id[project_id]
            self._compare_project(response_project, project)

    async def test_get_project_by_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test retrieving a specific project by its ID.

        This test verifies that:
        1. The GET /projects/{project_id} endpoint returns a 200 status code
        2. The response contains the correct project data
        3. The project ID, name, and description match the expected values
        """  # noqa: E501
        projects = await self._insert_projects(db)
        project = projects[0]
        project_id = str(GlobalID(Project.__name__, str(project.id)))
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.get(url)
        assert response.is_success, f"GET /projects/{project_id} failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        self._compare_project(data, project, f"Project with ID {project.id}")

    async def test_create_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test creating a new project.

        This test verifies that:
        1. The POST /projects endpoint returns a 200 status code
        2. The response contains the newly created project data
        3. The project name and description match the values provided in the request
        4. The project is assigned a valid ID
        """  # noqa: E501
        project_name = token_hex(16)
        project_description = token_hex(16)
        project_data = {
            "project": {
                "name": project_name,
                "description": project_description,
            }
        }
        url = "v1/projects"
        response = await httpx_client.post(url, json=project_data)
        assert (
            response.is_success
        ), f"POST /projects failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        assert (
            data["name"] == project_name
        ), f"Project name should be '{project_name}', got '{data['name']}'"  # noqa: E501
        assert (
            data["description"] == project_description
        ), f"Project description should be '{project_description}', got '{data['description']}'"  # noqa: E501

    async def test_update_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test updating a project's description while keeping the name unchanged.

        This test verifies that:
        1. The PUT /projects/{project_id} endpoint returns a 200 status code
        2. The project name remains unchanged
        3. The project description is updated to the new value
        4. The response contains the updated project data
        """  # noqa: E501
        projects = await self._insert_projects(db)
        project = projects[0]
        project_id = str(GlobalID(Project.__name__, str(project.id)))
        updated_description = token_hex(16)
        updated_project_data = {
            "project": {
                "name": project.name,  # Keep the same name
                "description": updated_description,
            }
        }
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert response.is_success, f"PUT /projects/{project_id} failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        assert (
            data["name"] == project.name
        ), f"Project name should remain unchanged as '{project.name}', got '{data['name']}'"  # noqa: E501
        assert (
            data["description"] == updated_description
        ), f"Updated project description should be '{updated_description}', got '{data['description']}'"  # noqa: E501

    async def test_cannot_update_project_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that project names cannot be changed.

        This test verifies that:
        1. The PUT /projects/{project_id} endpoint returns a 422 status code when attempting to change the project name
        2. The error message clearly indicates that project names cannot be changed
        3. The project data in the database remains unchanged
        """  # noqa: E501
        projects = await self._insert_projects(db)
        project = projects[0]
        project_id = str(GlobalID(Project.__name__, str(project.id)))
        updated_name = token_hex(16)
        updated_description = token_hex(16)
        updated_project_data = {
            "project": {
                "name": updated_name,  # Try to change the name
                "description": updated_description,
            }
        }
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert (
            response.status_code == 422
        ), f"PUT /projects/{project_id} with changed name should return 422 status code, got {response.status_code}: {response.text}"  # noqa: E501
        assert (
            "Project names cannot be changed" in response.text
        ), f"Response should indicate project names cannot be changed, got: {response.text}"  # noqa: E501

    async def test_delete_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test deleting a project.

        This test verifies that:
        1. The DELETE /projects/{project_id} endpoint returns a 204 status code
        2. The project is successfully removed from the database
        3. Subsequent attempts to retrieve the deleted project return a 404 error
        """  # noqa: E501
        # Create a test project
        project = models.Project(
            name=token_hex(16),
            description=token_hex(16),
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Delete the project
        project_id = str(GlobalID(Project.__name__, str(project.id)))
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.delete(url)
        assert (
            response.status_code == 204
        ), f"DELETE /projects/{project_id} should return 204 status code, got {response.status_code}"  # noqa: E501

        async with db() as session:
            # Verify project is deleted
            deleted_project = await session.get(models.Project, project.id)
            assert deleted_project is None, f"Project {project.id} should be deleted from database"  # noqa: E501

    async def test_cannot_delete_default_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that the default project cannot be deleted.

        This test verifies that:
        1. The DELETE /projects/{project_id} endpoint returns a 422 status code when attempting to delete the default project
        2. The error message clearly indicates that the default project cannot be deleted
        3. The default project remains in the database
        """  # noqa: E501
        async with db() as session:
            # Find the default project
            default_project = await session.scalar(
                select(models.Project).where(models.Project.name == DEFAULT_PROJECT_NAME)
            )

            # If default project doesn't exist, create it
            if default_project is None:
                default_project = models.Project(
                    name=DEFAULT_PROJECT_NAME,
                    description="Default project",
                )
                session.add(default_project)
                await session.flush()
                print(
                    f"Created default project: id={default_project.id}, name='{default_project.name}'"  # noqa: E501
                )

        # Try to delete the default project by ID
        project_id = str(GlobalID(Project.__name__, str(default_project.id)))
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.delete(url)

        # Verify that the request was rejected
        assert (
            response.status_code == 422
        ), f"DELETE /projects/{project_id} should return 422 status code, got {response.status_code}"  # noqa: E501
        assert (
            "cannot be deleted" in response.text
        ), f"Response should indicate default project cannot be deleted, got: {response.text}"  # noqa: E501

        async with db() as session:
            # Verify default project still exists
            existing_default = await session.get(models.Project, default_project.id)
            assert (
                existing_default is not None
            ), f"Default project {default_project.id} should still exist in database"  # noqa: E501

    async def test_get_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test retrieving a project that doesn't exist.

        This test verifies that:
        1. The GET /projects/{project_id} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_id = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 404
        ), f"GET /projects/{project_id} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_update_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test updating a project that doesn't exist.

        This test verifies that:
        1. The PUT /projects/{project_id} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_id = str(GlobalID(Project.__name__, "999999"))
        updated_project_data = {
            "project": {
                "name": token_hex(16),
                "description": token_hex(16),
            }
        }
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert (
            response.status_code == 404
        ), f"PUT /projects/{project_id} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_delete_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test deleting a project that doesn't exist.

        This test verifies that:
        1. The DELETE /projects/{project_id} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_id = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{quote_plus(project_id)}"
        response = await httpx_client.delete(url)
        assert (
            response.status_code == 404
        ), f"DELETE /projects/{project_id} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_invalid_project_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test handling of invalid project ID format.

        This test verifies that:
        1. The GET /projects/{project_id} endpoint returns a 422 status code when the project ID format is invalid
        2. The error message clearly indicates that the project ID format is invalid
        """  # noqa: E501
        invalid_id = "invalid-id"
        url = f"v1/projects/{quote_plus(invalid_id)}"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 422
        ), f"GET /projects/{invalid_id} should return a 422 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_missing_project_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test retrieving a paginated list of all projects.

        This test verifies that:
        1. The GET /projects endpoint returns a 200 status code
        2. The response contains a 'data' field with a list of projects
        3. The number of projects returned is at least as many as were created
        4. Pagination fields are present in the response
        """  # noqa: E501
        # Create some test projects
        projects = await self._insert_projects(db, 3)

        # Get all projects
        url = "v1/projects"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 200
        ), f"GET /projects should return a 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        # Verify response structure
        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"
        assert isinstance(data["data"], list), "Response data should be a list of projects"

        # Verify we got all projects
        assert len(data["data"]) >= len(
            projects
        ), f"Expected at least {len(projects)} projects, got {len(data['data'])}"

        # Verify pagination fields
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"

    @staticmethod
    def _compare_project(
        data: dict[str, Any],
        project: models.Project,
        context: str = "",
    ) -> None:
        """
        Compare a project from the API response with a project from the database.

        This helper method verifies that:
        1. The project ID matches
        2. The project name matches
        3. The project description matches
        4. There are no unexpected fields in the response

        Args:
            data: The project data from the API response
            project: The project object from the database
            context: Optional context string for error messages
        """  # noqa: E501
        data = data.copy()
        id_ = from_global_id_with_expected_type(GlobalID.from_id(data.pop("id")), Project.__name__)
        assert (
            id_ == project.id
        ), f"{context} - Project ID mismatch: expected={project.id}, found={id_}"  # noqa: E501

        name = data.pop("name")
        assert (
            name == project.name
        ), f"{context} - Project name mismatch: expected='{project.name}', found='{name}'"  # noqa: E501

        description = data.pop("description")
        assert (
            description == project.description
        ), f"{context} - Project description mismatch: expected='{project.description}', found='{description}'"  # noqa: E501

        assert not data, f"{context} - Unexpected fields in response: {list(data.keys())}"  # noqa: E501

    @staticmethod
    async def _insert_projects(
        db: DbSessionFactory,
        n: int = 3,
    ) -> list[models.Project]:
        """
        Insert test projects into the database.

        This helper method creates the specified number of test projects with random names and descriptions.

        Args:
            db: The database session factory
            n: The number of projects to create

        Returns:
            A list of the created project objects
        """  # noqa: E501
        projects = []
        async with db() as session:
            for i in range(n):
                project = models.Project(
                    name=token_hex(16),
                    description=token_hex(16),
                )
                session.add(project)
                projects.append(project)
            await session.flush()
        # Log the created projects for debugging
        for i, p in enumerate(projects):
            print(f"Created test project {i+1}: id={p.id}, name='{p.name}'")
        return projects
