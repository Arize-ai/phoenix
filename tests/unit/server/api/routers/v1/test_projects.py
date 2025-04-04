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
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501
        assert isinstance(data["data"], list), "Response data should be a list of projects"  # noqa: E501

        # Verify we got all projects
        assert len(data["data"]) >= len(
            projects
        ), f"Expected at least {len(projects)} projects, got {len(data['data'])}"  # noqa: E501

        # Verify pagination fields
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"  # noqa: E501

    async def test_list_projects_with_cursor(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test pagination of projects using cursor-based navigation.

        This test verifies that:
        1. The GET /projects endpoint with a limit parameter returns the correct number of projects
        2. The response includes a next_cursor when there are more projects to fetch
        3. Using the next_cursor in a subsequent request returns the next page of projects
        4. When all projects have been fetched, the next_cursor is null
        5. The projects are returned in the correct order (descending by ID)
        """  # noqa: E501
        # Create multiple test projects (more than the limit we'll use)
        projects = await self._insert_projects(db, 5)

        # Sort projects by ID in descending order (as the API returns them)
        projects.sort(key=lambda p: p.id, reverse=True)

        # First page: request with limit=2
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 2})
        assert (
            response.status_code == 200
        ), f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"  # noqa: E501

        # Verify first page has 2 projects
        first_page_projects = data["data"]
        assert len(first_page_projects) == 2, "First page should return exactly 2 projects"  # noqa: E501

        # Verify next_cursor is present
        next_cursor = data["next_cursor"]
        assert next_cursor is not None, "next_cursor should be present when there are more projects"  # noqa: E501

        # Verify the projects in the first page match the first 2 projects in our sorted list
        for i, project_data in enumerate(first_page_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert (
                project_id == projects[i].id
            ), f"Project at index {i} should have ID {projects[i].id}, got {project_id}"  # noqa: E501

        # Second page: request with the next_cursor
        response = await httpx_client.get(url, params={"limit": 2, "cursor": next_cursor})
        assert (
            response.status_code == 200
        ), f"GET /projects with cursor should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501

        # Verify second page has 2 projects
        second_page_projects = data["data"]
        assert len(second_page_projects) == 2, "Second page should return exactly 2 projects"  # noqa: E501

        # Verify next_cursor is present
        next_cursor = data["next_cursor"]
        assert next_cursor is not None, "next_cursor should be present when there are more projects"  # noqa: E501

        # Verify the projects in the second page match the next 2 projects in our sorted list
        for i, project_data in enumerate(second_page_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert (
                project_id == projects[i + 2].id
            ), f"Project at index {i} should have ID {projects[i+2].id}, got {project_id}"  # noqa: E501

        # Third page: request with the next_cursor
        response = await httpx_client.get(url, params={"limit": 2, "cursor": next_cursor})
        assert (
            response.status_code == 200
        ), f"GET /projects with cursor should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501

        # Verify third page has 1 project (the last one)
        third_page_projects = data["data"]
        assert len(third_page_projects) == 1, "Third page should return exactly 1 project"  # noqa: E501

        # Verify next_cursor is null (no more projects)
        assert (
            data["next_cursor"] is None
        ), "next_cursor should be null when there are no more projects"  # noqa: E501

        # Verify the project in the third page matches the last project in our sorted list
        project_id = from_global_id_with_expected_type(
            GlobalID.from_id(third_page_projects[0]["id"]), Project.__name__
        )
        assert (
            project_id == projects[4].id
        ), f"Project should have ID {projects[4].id}, got {project_id}"  # noqa: E501

        # Test with an invalid cursor
        response = await httpx_client.get(url, params={"cursor": "invalid-cursor"})
        assert (
            response.status_code == 422
        ), f"GET /projects with invalid cursor should return 422 status code, got {response.status_code}: {response.text}"  # noqa: E501
        assert (
            "Invalid cursor format" in response.text
        ), "Response should indicate invalid cursor format"  # noqa: E501

    async def test_list_projects_empty(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test pagination of projects when there are no projects to return.

        This test verifies that:
        1. The GET /projects endpoint returns an empty list when there are no projects
        2. The next_cursor is null when there are no projects
        3. The response structure is correct even when empty
        """  # noqa: E501
        # Request projects with a limit
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 10})
        assert (
            response.status_code == 200
        ), f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"  # noqa: E501

        # Verify empty data list
        assert len(data["data"]) == 0, "Data list should be empty when there are no projects"  # noqa: E501

        # Verify next_cursor is null
        assert data["next_cursor"] is None, "next_cursor should be null when there are no projects"  # noqa: E501

        # Test with a cursor when there are no projects
        response = await httpx_client.get(url, params={"cursor": "some-cursor", "limit": 10})
        assert (
            response.status_code == 422
        ), f"GET /projects with invalid cursor should return 422 status code, got {response.status_code}: {response.text}"  # noqa: E501
        assert (
            "Invalid cursor format" in response.text
        ), "Response should indicate invalid cursor format"  # noqa: E501

        # Test with a valid cursor format but no projects
        # Create a valid cursor format (base64-encoded project ID)
        valid_cursor = str(GlobalID(Project.__name__, "999999"))
        response = await httpx_client.get(url, params={"cursor": valid_cursor, "limit": 10})
        assert (
            response.status_code == 200
        ), f"GET /projects with valid cursor should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert len(data["data"]) == 0, "Data list should be empty when there are no projects"  # noqa: E501
        assert data["next_cursor"] is None, "next_cursor should be null when there are no projects"  # noqa: E501

    async def test_list_projects_limit_larger_than_available(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test pagination of projects when the limit parameter is larger than the number of available projects.

        This test verifies that:
        1. The GET /projects endpoint returns all available projects when the limit is larger
        2. The next_cursor is null when all projects have been returned
        3. The response structure is correct
        """  # noqa: E501
        # Create a small number of test projects
        projects = await self._insert_projects(db, 3)

        # Sort projects by ID in descending order (as the API returns them)
        projects.sort(key=lambda p: p.id, reverse=True)

        # Request with a limit larger than the number of projects
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 10})
        assert (
            response.status_code == 200
        ), f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"  # noqa: E501

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"  # noqa: E501
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"  # noqa: E501

        # Verify all projects are returned
        returned_projects = data["data"]
        assert len(returned_projects) == len(
            projects
        ), f"Should return all {len(projects)} projects, got {len(returned_projects)}"  # noqa: E501

        # Verify next_cursor is null (no more projects)
        assert (
            data["next_cursor"] is None
        ), "next_cursor should be null when all projects have been returned"  # noqa: E501

        # Verify the projects match our sorted list
        for i, project_data in enumerate(returned_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert (
                project_id == projects[i].id
            ), f"Project at index {i} should have ID {projects[i].id}, got {project_id}"  # noqa: E501

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
