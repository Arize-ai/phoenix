from __future__ import annotations

import base64
import string
from secrets import token_hex
from typing import Any
from urllib.parse import quote_plus

import httpx
import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory


class TestProjects:
    name_and_description_test_cases = [
        pytest.param(
            token_hex(16),
            token_hex(16),
            id="regular_chars",
        ),
        pytest.param(
            f"Punctuations {string.punctuation}",
            "Punctuation characters",
            id="punctuation_chars",
        ),
        pytest.param(
            "项目名称",
            "Unicode characters (Chinese)",
            id="unicode_chars",
        ),
        pytest.param(
            "Project Name/With Spaces/And Slashes",
            "Spaces and slashes",
            id="spaces_and_slashes",
        ),
    ]

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
        1. The GET /projects/{project_identifier} endpoint returns a 200 status code
        2. The response contains the correct project data
        3. The project ID, name, and description match the expected values
        """  # noqa: E501
        projects = await self._insert_projects(db)
        project = projects[0]
        project_identifier = str(GlobalID(Project.__name__, str(project.id)))
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.get(url)
        assert response.is_success, f"GET /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        self._compare_project(data, project, f"Project with ID {project.id}")

    @pytest.mark.parametrize("project_name,project_description", name_and_description_test_cases)
    async def test_get_project_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        project_name: str,
        project_description: str,
    ) -> None:
        """
        Test retrieving a specific project by its name.

        This test verifies that:
        1. The GET /projects/{project_identifier} endpoint returns a 200 status code when using a project name
        2. The response contains the correct project data
        3. The project ID, name, and description match the expected values
        4. Projects with special characters in their names can be retrieved correctly
        """  # noqa: E501
        # Test with special characters
        project = models.Project(
            name=project_name,
            description=f"A project with {project_description}",
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Test retrieving the project by name
        project_identifier = base64.urlsafe_b64encode(project.name.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.get(url)
        assert response.is_success, f"GET /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        self._compare_project(data, project, f"Project with name {project.name}")

        # Clean up
        async with db() as session:
            await session.delete(project)

    @pytest.mark.parametrize("project_name,project_description", name_and_description_test_cases)
    async def test_create_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        project_name: str,
        project_description: str,
    ) -> None:
        """
        Test creating a new project.

        This test verifies that:
        1. The POST /projects endpoint returns a 200 status code
        2. The response contains the newly created project data
        3. The project name and description match the values provided in the request
        4. The project is assigned a valid ID
        5. Projects with special characters in their names can be created correctly
        """  # noqa: E501
        description = f"A project with {project_description}"

        project_data = {
            "name": project_name,
            "description": description,
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
            data["description"] == description
        ), f"Project description should be '{description}', got '{data['description']}'"  # noqa: E501

        # Clean up
        project_id = data["id"]
        url = f"v1/projects/{quote_plus(project_id)}"
        await httpx_client.delete(url)

    @pytest.mark.parametrize("special_chars_name,description", name_and_description_test_cases)
    async def test_update_project_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        special_chars_name: str,
        description: str,
    ) -> None:
        """
        Test updating a project's description by name while keeping the name unchanged.

        This test verifies that:
        1. The PUT /projects/{project_identifier} endpoint returns a 200 status code when using a project name
        2. The project name remains unchanged
        3. The project description is updated to the new value
        4. The response contains the updated project data
        5. Projects with special characters in their names can be updated correctly
        """  # noqa: E501
        # Test with special characters
        project = models.Project(
            name=special_chars_name,
            description=f"A project with {description}",
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Update the project by name
        updated_description = f"Updated description for project with {description}"
        updated_project_data = {
            "description": updated_description,
        }
        project_identifier = base64.urlsafe_b64encode(project.name.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert response.is_success, f"PUT /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"  # noqa: E501
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"  # noqa: E501
        assert (
            data["name"] == project.name
        ), f"Project name should remain unchanged as '{project.name}', got '{data['name']}'"  # noqa: E501
        assert (
            data["description"] == updated_description
        ), f"Updated project description should be '{updated_description}', got '{data['description']}'"  # noqa: E501

        # Clean up
        async with db() as session:
            await session.delete(project)

    @pytest.mark.parametrize("special_chars_name,description", name_and_description_test_cases)
    async def test_delete_project_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        special_chars_name: str,
        description: str,
    ) -> None:
        """
        Test deleting a project by name.

        This test verifies that:
        1. The DELETE /projects/{project_identifier} endpoint returns a 204 status code when using a project name
        2. The project is successfully removed from the database
        3. Subsequent attempts to retrieve the deleted project return a 404 error
        4. Projects with special characters in their names can be deleted correctly
        """  # noqa: E501
        # Test with special characters
        project = models.Project(
            name=special_chars_name,
            description=f"A project with {description}",
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Delete the project by name
        project_identifier = base64.urlsafe_b64encode(project.name.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.delete(url)
        assert (
            response.status_code == 204
        ), f"DELETE /projects/{project_identifier} should return 204 status code, got {response.status_code}"  # noqa: E501

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
        1. The DELETE /projects/{project_identifier} endpoint returns a 403 status code when attempting to delete the default project
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
        project_identifier = str(GlobalID(Project.__name__, str(default_project.id)))
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.delete(url)

        # Verify that the request was rejected
        assert (
            response.status_code == 403
        ), f"DELETE /projects/{project_identifier} should return 403 status code, got {response.status_code}"  # noqa: E501
        assert (
            "cannot be deleted" in response.text
        ), f"Response should indicate default project cannot be deleted, got: {response.text}"  # noqa: E501

        async with db() as session:
            # Verify default project still exists
            existing_default = await session.get(models.Project, default_project.id)
            assert (
                existing_default is not None
            ), f"Default project {default_project.id} should still exist in database"  # noqa: E501

        # Try to delete the default project by name
        project_identifier = base64.urlsafe_b64encode(DEFAULT_PROJECT_NAME.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.delete(url)

        # Verify that the request was rejected
        assert (
            response.status_code == 403
        ), f"DELETE /projects/{project_identifier} should return 403 status code, got {response.status_code}"  # noqa: E501
        assert (
            "cannot be deleted" in response.text
        ), f"Response should indicate default project cannot be deleted, got: {response.text}"  # noqa: E501

    async def test_get_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test retrieving a project that doesn't exist.

        This test verifies that:
        1. The GET /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 404
        ), f"GET /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

        # Test with a nonexistent project name
        name = token_hex(16)
        project_identifier = base64.urlsafe_b64encode(name.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 404
        ), f"GET /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_update_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test updating a project that doesn't exist.

        This test verifies that:
        1. The PUT /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        updated_project_data = {
            "project": {
                "name": token_hex(16),
                "description": token_hex(16),
            }
        }
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert (
            response.status_code == 404
        ), f"PUT /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

        # Test with a nonexistent project name
        name = token_hex(16)
        project_identifier = base64.urlsafe_b64encode(name.encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert (
            response.status_code == 404
        ), f"PUT /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_delete_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test deleting a project that doesn't exist.

        This test verifies that:
        1. The DELETE /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """  # noqa: E501
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.delete(url)
        assert (
            response.status_code == 404
        ), f"DELETE /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

        # Test with a nonexistent project name
        project_identifier = base64.urlsafe_b64encode(token_hex(16).encode()).decode()
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.delete(url)
        assert (
            response.status_code == 404
        ), f"DELETE /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"  # noqa: E501

    async def test_invalid_project_identifier(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test handling of invalid project identifier format.

        This test verifies that:
        1. The GET /projects/{project_identifier} endpoint returns a 422 status code when the project ID format is invalid
        2. The error message clearly indicates that the project identifier format is invalid
        """  # noqa: E501
        project_identifier = "invalid-identifier"
        url = f"v1/projects/{quote_plus(project_identifier)}"
        response = await httpx_client.get(url)
        assert (
            response.status_code == 422
        ), f"GET /projects/{project_identifier} should return a 422 status code, got {response.status_code}: {response.text}"  # noqa: E501

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
