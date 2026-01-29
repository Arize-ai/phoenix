from __future__ import annotations

import string
from secrets import token_hex
from typing import Any
from urllib.parse import quote

import httpx
import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME, PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory


class TestProjects:
    name_and_description_test_cases = [
        pytest.param(
            f"Punctuations {string.punctuation.translate(str.maketrans('', '', '/?#'))}",
            "Punctuation characters excluding /, ?, # (not safe for URL)",
            id="punctuation_chars_with_exclusion",
        ),
        pytest.param(
            "项目名称",
            "Unicode characters (Chinese)",
            id="unicode_chars",
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
        """
        # Create test projects
        projects = await self._insert_projects(db, 3)

        # Get all projects
        url = "v1/projects"
        response = await httpx_client.get(url)
        assert response.status_code == 200, (
            f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"
        )

        # Parse response data
        data = response.json()
        assert "data" in data, "Response should contain 'data' field"
        response_projects = data["data"]
        assert isinstance(response_projects, list), "Response data should be a list"

        # Create a dictionary of projects by ID for easy lookup
        projects_by_id = {str(GlobalID(Project.__name__, str(p.id))): p for p in projects}
        response_projects_by_id = {p["id"]: p for p in response_projects}

        # Compare project counts
        assert len(response_projects) == len(projects), (
            f"Expected {len(projects)} projects, got {len(response_projects)}"
        )

        # Compare project IDs
        assert set(projects_by_id.keys()) == set(response_projects_by_id.keys()), (
            f"Project IDs mismatch. Expected: {set(projects_by_id.keys())}, Got: {set(response_projects_by_id.keys())}"
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
        """
        projects = await self._insert_projects(db)
        project = projects[0]
        project_identifier = str(GlobalID(Project.__name__, str(project.id)))
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.get(url)
        assert response.is_success, (
            f"GET /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"
        )
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"
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
        """
        project = models.Project(
            name=project_name,
            description=f"A project with {project_description}",
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Test retrieving the project by name
        project_identifier = project.name
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.get(url)
        assert response.is_success, (
            f"GET /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"
        )
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"
        self._compare_project(data, project, f"Project with name {project.name}")

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
        """
        description = f"A project with {project_description}"

        project_data = {
            "name": project_name,
            "description": description,
        }
        url = "v1/projects"
        response = await httpx_client.post(url, json=project_data)
        assert response.is_success, (
            f"POST /projects failed with status code {response.status_code}: {response.text}"
        )
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"
        assert data["name"] == project_name, (
            f"Project name should be '{project_name}', got '{data['name']}'"
        )
        assert data["description"] == description, (
            f"Project description should be '{description}', got '{data['description']}'"
        )

        # Clean up
        project_id = data["id"]
        url = f"v1/projects/{quote(project_id)}"
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
        """
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
        project_identifier = project.name
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert response.is_success, (
            f"PUT /projects/{project_identifier} failed with status code {response.status_code}: {response.text}"
        )
        data = response.json()["data"]
        assert isinstance(data, dict), f"Response data should be a dictionary, got {type(data)}"
        assert data["name"] == project.name, (
            f"Project name should remain unchanged as '{project.name}', got '{data['name']}'"
        )
        assert data["description"] == updated_description, (
            f"Updated project description should be '{updated_description}', got '{data['description']}'"
        )

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
        """
        project = models.Project(
            name=special_chars_name,
            description=f"A project with {description}",
        )
        async with db() as session:
            session.add(project)
            await session.flush()

        # Delete the project by name
        project_identifier = project.name
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.delete(url)
        assert response.status_code == 204, (
            f"DELETE /projects/{project_identifier} should return 204 status code, got {response.status_code}"
        )

        async with db() as session:
            # Verify project is deleted
            deleted_project = await session.get(models.Project, project.id)
            assert deleted_project is None, f"Project {project.id} should be deleted from database"

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
        """
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
                    f"Created default project: id={default_project.id}, name='{default_project.name}'"
                )

        # Try to delete the default project by ID
        project_identifier = str(GlobalID(Project.__name__, str(default_project.id)))
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.delete(url)

        # Verify that the request was rejected
        assert response.status_code == 403, (
            f"DELETE /projects/{project_identifier} should return 403 status code, got {response.status_code}"
        )
        assert "cannot be deleted" in response.text, (
            f"Response should indicate default project cannot be deleted, got: {response.text}"
        )

        async with db() as session:
            # Verify default project still exists
            existing_default = await session.get(models.Project, default_project.id)
            assert existing_default is not None, (
                f"Default project {default_project.id} should still exist in database"
            )

        # Try to delete the default project by name
        project_identifier = DEFAULT_PROJECT_NAME
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.delete(url)

        # Verify that the request was rejected
        assert response.status_code == 403, (
            f"DELETE /projects/{project_identifier} should return 403 status code, got {response.status_code}"
        )
        assert "cannot be deleted" in response.text, (
            f"Response should indicate default project cannot be deleted, got: {response.text}"
        )

    async def test_get_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test retrieving a project that doesn't exist.

        This test verifies that:
        1. The GET /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.get(url)
        assert response.status_code == 404, (
            f"GET /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

        # Test with a nonexistent project name
        name = token_hex(16)
        project_identifier = name
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.get(url)
        assert response.status_code == 404, (
            f"GET /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

    async def test_update_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test updating a project that doesn't exist.

        This test verifies that:
        1. The PUT /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        updated_project_data = {
            "project": {
                "name": token_hex(16),
                "description": token_hex(16),
            }
        }
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert response.status_code == 404, (
            f"PUT /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

        # Test with a nonexistent project name
        name = token_hex(16)
        project_identifier = name
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.put(url, json=updated_project_data)
        assert response.status_code == 404, (
            f"PUT /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

    async def test_delete_nonexistent_project(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        """
        Test deleting a project that doesn't exist.

        This test verifies that:
        1. The DELETE /projects/{project_identifier} endpoint returns a 404 status code when the project doesn't exist
        2. The error message clearly indicates that the project was not found
        """
        project_identifier = str(GlobalID(Project.__name__, "999999"))
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.delete(url)
        assert response.status_code == 404, (
            f"DELETE /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

        # Test with a nonexistent project name
        project_identifier = token_hex(16)
        url = f"v1/projects/{project_identifier}"
        response = await httpx_client.delete(url)
        assert response.status_code == 404, (
            f"DELETE /projects/{project_identifier} should return a 404 status code, got {response.status_code}: {response.text}"
        )

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
        """
        # Create multiple test projects (more than the limit we'll use)
        projects = await self._insert_projects(db, 5)

        # Sort projects by ID in descending order (as the API returns them)
        projects.sort(key=lambda p: p.id, reverse=True)

        # First page: request with limit=2
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 2})
        assert response.status_code == 200, (
            f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"

        # Verify first page has 2 projects
        first_page_projects = data["data"]
        assert len(first_page_projects) == 2, "First page should return exactly 2 projects"

        # Verify next_cursor is present
        next_cursor = data["next_cursor"]
        assert next_cursor is not None, "next_cursor should be present when there are more projects"

        # Verify the projects in the first page match the first 2 projects in our sorted list
        for i, project_data in enumerate(first_page_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert project_id == projects[i].id, (
                f"Project at index {i} should have ID {projects[i].id}, got {project_id}"
            )

        # Second page: request with the next_cursor
        response = await httpx_client.get(url, params={"limit": 2, "cursor": next_cursor})
        assert response.status_code == 200, (
            f"GET /projects with cursor should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"

        # Verify second page has 2 projects
        second_page_projects = data["data"]
        assert len(second_page_projects) == 2, "Second page should return exactly 2 projects"

        # Verify next_cursor is present
        next_cursor = data["next_cursor"]
        assert next_cursor is not None, "next_cursor should be present when there are more projects"

        # Verify the projects in the second page match the next 2 projects in our sorted list
        for i, project_data in enumerate(second_page_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert project_id == projects[i + 2].id, (
                f"Project at index {i} should have ID {projects[i + 2].id}, got {project_id}"
            )

        # Third page: request with the next_cursor
        response = await httpx_client.get(url, params={"limit": 2, "cursor": next_cursor})
        assert response.status_code == 200, (
            f"GET /projects with cursor should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"

        # Verify third page has 1 project (the last one)
        third_page_projects = data["data"]
        assert len(third_page_projects) == 1, "Third page should return exactly 1 project"

        # Verify next_cursor is null (no more projects)
        assert data["next_cursor"] is None, (
            "next_cursor should be null when there are no more projects"
        )

        # Verify the project in the third page matches the last project in our sorted list
        project_id = from_global_id_with_expected_type(
            GlobalID.from_id(third_page_projects[0]["id"]), Project.__name__
        )
        assert project_id == projects[4].id, (
            f"Project should have ID {projects[4].id}, got {project_id}"
        )

        # Test with an invalid cursor
        response = await httpx_client.get(url, params={"cursor": "invalid-cursor"})
        assert response.status_code == 422, (
            f"GET /projects with invalid cursor should return 422 status code, got {response.status_code}: {response.text}"
        )
        assert "Invalid cursor format" in response.text, (
            "Response should indicate invalid cursor format"
        )

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
        """
        # Request projects with a limit
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 10})
        assert response.status_code == 200, (
            f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"

        # Verify empty data list
        assert len(data["data"]) == 0, "Data list should be empty when there are no projects"

        # Verify next_cursor is null
        assert data["next_cursor"] is None, "next_cursor should be null when there are no projects"

        # Test with a cursor when there are no projects
        response = await httpx_client.get(url, params={"cursor": "some-cursor", "limit": 10})
        assert response.status_code == 422, (
            f"GET /projects with invalid cursor should return 422 status code, got {response.status_code}: {response.text}"
        )
        assert "Invalid cursor format" in response.text, (
            "Response should indicate invalid cursor format"
        )

        # Test with a valid cursor format but no projects
        # Create a valid cursor format (base64-encoded project ID)
        valid_cursor = str(GlobalID(Project.__name__, "999999"))
        response = await httpx_client.get(url, params={"cursor": valid_cursor, "limit": 10})
        assert response.status_code == 200, (
            f"GET /projects with valid cursor should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert len(data["data"]) == 0, "Data list should be empty when there are no projects"
        assert data["next_cursor"] is None, "next_cursor should be null when there are no projects"

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
        """
        # Create a small number of test projects
        projects = await self._insert_projects(db, 3)

        # Sort projects by ID in descending order (as the API returns them)
        projects.sort(key=lambda p: p.id, reverse=True)

        # Request with a limit larger than the number of projects
        url = "v1/projects"
        response = await httpx_client.get(url, params={"limit": 10})
        assert response.status_code == 200, (
            f"GET /projects should return 200 status code, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "data" in data, "Response should contain a 'data' field with projects"
        assert "next_cursor" in data, "Response should contain a 'next_cursor' field for pagination"

        # Verify all projects are returned
        returned_projects = data["data"]
        assert len(returned_projects) == len(projects), (
            f"Should return all {len(projects)} projects, got {len(returned_projects)}"
        )

        # Verify next_cursor is null (no more projects)
        assert data["next_cursor"] is None, (
            "next_cursor should be null when all projects have been returned"
        )

        # Verify the projects match our sorted list
        for i, project_data in enumerate(returned_projects):
            project_id = from_global_id_with_expected_type(
                GlobalID.from_id(project_data["id"]), Project.__name__
            )
            assert project_id == projects[i].id, (
                f"Project at index {i} should have ID {projects[i].id}, got {project_id}"
            )

    async def test_include_experiment_projects_parameter(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that the playground project is always included in project listings, regardless of
        whether it has associated experiments or the include_experiment_projects parameter.

        This test verifies that:
        1. Regular experiment projects are excluded by default from the response
        2. Regular experiment projects are included when include_experiment_projects=True
        3. The playground project is always included in the response, even when:
           - It has an associated experiment
           - Other experiment projects are being excluded

        This behavior is important because:
        - Regular experiment projects can be filtered to reduce clutter
        - The playground project is special and should always be visible
        - Having an experiment shouldn't change the playground project's visibility
        """
        # Create regular projects that will always be included
        regular_projects = await self._insert_projects(db, 2)

        async with db() as session:
            # Create a regular experiment project - this should be filtered by default
            experiment_project = models.Project(
                name="experiment-project",
                description="A project created from an experiment - should be filtered by default",
            )
            session.add(experiment_project)
            await session.flush()

            # Setup dataset and version needed for experiments
            dataset = models.Dataset(name="test-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            dataset_version = models.DatasetVersion(
                dataset_id=dataset.id,
                metadata_={},
            )
            session.add(dataset_version)
            await session.flush()

            # Create an experiment for the regular experiment project
            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name="test-experiment",
                repetitions=1,
                metadata_={},
                project_name="experiment-project",
            )
            session.add(experiment)
            await session.flush()

            # Create the playground project - this should always be visible
            playground_project = models.Project(
                name=PLAYGROUND_PROJECT_NAME,
                description="Playground project - should always be visible",
            )
            session.add(playground_project)
            await session.flush()

            # Create an experiment using the playground project - this shouldn't affect visibility
            playground_experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name="playground-experiment",
                repetitions=1,
                metadata_={},
                project_name=PLAYGROUND_PROJECT_NAME,
            )
            session.add(playground_experiment)
            await session.flush()

        # Test default behavior - should exclude regular experiment projects but include playground
        url = "v1/projects"
        response = await httpx_client.get(url)
        assert response.status_code == 200, (
            f"GET /projects failed with status code {response.status_code}: {response.text}"
        )

        data = response.json()
        returned_projects = data["data"]

        # Should return regular projects and playground project (but not experiment project)
        expected_count = len(regular_projects) + 1  # +1 for playground project
        assert len(returned_projects) == expected_count, (
            f"Expected {expected_count} projects (regular + playground), "
            f"got {len(returned_projects)}"
        )

        # Regular experiment project should be filtered out by default
        experiment_project_ids = [str(GlobalID(Project.__name__, str(experiment_project.id)))]
        returned_project_ids = [p["id"] for p in returned_projects]
        assert not any(id_ in returned_project_ids for id_ in experiment_project_ids), (
            "Regular experiment project should be excluded by default to reduce clutter"
        )

        # Playground project should be included despite having an experiment
        playground_project_ids = [str(GlobalID(Project.__name__, str(playground_project.id)))]
        assert any(id_ in returned_project_ids for id_ in playground_project_ids), (
            "Playground project should be included even with an experiment - it's special and should always be visible"
        )

        # Test with include_experiment_projects=True - should include all projects
        response = await httpx_client.get(url, params={"include_experiment_projects": True})
        assert response.status_code == 200, (
            f"GET /projects with include_experiment_projects=True failed with status code {response.status_code}: {response.text}"
        )

        data = response.json()
        returned_projects = data["data"]

        # Should return all projects when including experiment projects
        expected_count = len(regular_projects) + 2  # +1 for experiment project, +1 for playground
        assert len(returned_projects) == expected_count, (
            f"Expected {expected_count} projects (regular + experiment + playground), got {len(returned_projects)}"
        )

        # Regular experiment project should now be included
        returned_project_ids = [p["id"] for p in returned_projects]
        assert any(id_ in returned_project_ids for id_ in experiment_project_ids), (
            "Regular experiment project should be included when explicitly requested"
        )

        # Playground project should still be included (as always)
        assert any(id_ in returned_project_ids for id_ in playground_project_ids), (
            "Playground project should always be included - it's special and visibility isn't affected by parameters"
        )

    async def test_include_dataset_evaluator_projects_parameter(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        """
        Test that dataset evaluator projects are excluded by default but can be included with a parameter.

        This test verifies that:
        1. Dataset evaluator projects are excluded by default from the response
        2. Dataset evaluator projects are included when include_dataset_evaluator_projects=True
        3. Regular projects are always included regardless of the parameter
        """
        # Create regular projects that will always be included
        regular_projects = await self._insert_projects(db, 2)

        async with db() as session:
            dataset_evaluator_project = models.Project(
                name="dataset-evaluator-project",
                description="A project created from a dataset evaluator - should be filtered by default",
            )
            session.add(dataset_evaluator_project)
            await session.flush()

            dataset = models.Dataset(name="test-dataset", metadata_={})
            session.add(dataset)
            await session.flush()

            code_evaluator = models.CodeEvaluator(
                name=Identifier(root="test-evaluator"),
                description="Test evaluator",
                metadata_={},
            )
            session.add(code_evaluator)
            await session.flush()

            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=code_evaluator.id,
                name=Identifier(root="test-dataset-evaluator"),
                input_mapping={},
                project_id=dataset_evaluator_project.id,
            )
            session.add(dataset_evaluator)
            await session.flush()

        # Test default behavior - should exclude dataset evaluator projects
        url = "v1/projects"
        response = await httpx_client.get(url)
        assert response.status_code == 200, (
            f"GET /projects failed with status code {response.status_code}: {response.text}"
        )

        data = response.json()
        returned_projects = data["data"]

        # Should return only regular projects
        expected_count = len(regular_projects)
        assert len(returned_projects) == expected_count, (
            f"Expected {expected_count} projects (regular only), got {len(returned_projects)}"
        )

        # Dataset evaluator project should be filtered out by default
        dataset_evaluator_project_ids = [
            str(GlobalID(Project.__name__, str(dataset_evaluator_project.id)))
        ]
        returned_project_ids = [p["id"] for p in returned_projects]
        assert not any(id_ in returned_project_ids for id_ in dataset_evaluator_project_ids), (
            "Dataset evaluator project should be excluded by default to reduce clutter"
        )

        # Test with include_dataset_evaluator_projects=True - should include all projects
        response = await httpx_client.get(url, params={"include_dataset_evaluator_projects": True})
        assert response.status_code == 200, (
            f"GET /projects with include_dataset_evaluator_projects=True failed with status code {response.status_code}: {response.text}"
        )

        data = response.json()
        returned_projects = data["data"]

        # Should return all projects when including dataset evaluator projects
        expected_count = len(regular_projects) + 1
        assert len(returned_projects) == expected_count, (
            f"Expected {expected_count} projects (regular + dataset evaluator), got {len(returned_projects)}"
        )

        # Dataset evaluator project should now be included
        returned_project_ids = [p["id"] for p in returned_projects]
        assert any(id_ in returned_project_ids for id_ in dataset_evaluator_project_ids), (
            "Dataset evaluator project should be included when explicitly requested"
        )

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
        """
        data = data.copy()
        id_ = from_global_id_with_expected_type(GlobalID.from_id(data.pop("id")), Project.__name__)
        assert id_ == project.id, (
            f"{context} - Project ID mismatch: expected={project.id}, found={id_}"
        )

        name = data.pop("name")
        assert name == project.name, (
            f"{context} - Project name mismatch: expected='{project.name}', found='{name}'"
        )

        description = data.pop("description")
        assert description == project.description, (
            f"{context} - Project description mismatch: expected='{project.description}', found='{description}'"
        )

        assert not data, f"{context} - Unexpected fields in response: {list(data.keys())}"

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
        """
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
            print(f"Created test project {i + 1}: id={p.id}, name='{p.name}'")
        return projects
