# pyright: reportPrivateUsage=false
from __future__ import annotations

import string
from secrets import token_hex

import pytest

from .._helpers import _AppInfo, _await_or_return


class TestClientForProjectsAPI:
    """Integration tests for the Projects client REST endpoints."""

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

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("project_name,project_description", name_and_description_test_cases)
    async def test_crud_operations(
        self,
        is_async: bool,
        project_name: str,
        project_description: str,
        _app: _AppInfo,
    ) -> None:
        """Test CRUD operations for projects.

        This test verifies that:
        1. Projects can be created with a name and optional description
        2. Projects can be retrieved by ID
        3. Projects can be listed
        4. Projects can be updated (description only, not name)
        5. Projects can be deleted
        6. Project names must be unique
        7. Special characters in project names are handled correctly
        """
        # Set up test environment with admin secret
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create a project with name suffix to ensure uniqueness
        name = f"{project_name}_{token_hex(16)}"
        description = f"A project with {project_description}"

        project = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.create(
                name=name,
                description=description,
            )
        )

        # Verify project was created with correct attributes (CREATE operation)
        assert project["id"], "Project ID should be present after creation"
        assert project["name"] == name, "Project name should match input after creation"
        assert "description" in project, "Project should have a description field"
        assert project["description"] == description, (
            "Project description should match input after creation"
        )

        # Test project name uniqueness (CREATE operation)
        with pytest.raises(Exception):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).projects.create(
                    name=name,
                )
            )

        # Get the project by ID (READ operation)
        retrieved_project = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.get(
                project_id=project["id"],
            )
        )

        # Verify retrieved project matches created project (READ operation)
        assert retrieved_project["id"] == project["id"], (
            "Retrieved project ID should match created project"
        )
        assert retrieved_project["name"] == name, (
            "Retrieved project name should match created project"
        )
        assert "description" in retrieved_project, (
            "Retrieved project should have a description field"
        )
        assert retrieved_project["description"] == description, (
            "Retrieved project description should match created project"
        )

        # List all projects (READ operation)
        all_projects = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.list()
        )

        # Verify our project is in the list (READ operation)
        assert any(p["id"] == project["id"] for p in all_projects), (
            "Created project should be present in list of all projects"
        )

        # Update the project description (UPDATE operation)
        new_description = f"Updated description with {project_description}"
        updated_project = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.update(
                project_id=project["id"],
                description=new_description,
            )
        )

        # Verify project was updated with new description (UPDATE operation)
        assert updated_project["id"] == project["id"], (
            "Updated project ID should match original project"
        )
        assert updated_project["name"] == name, "Project name should not change after update"
        assert "description" in updated_project, "Updated project should have a description field"
        assert updated_project["description"] == new_description, (
            "Project description should be updated"
        )

        # Delete the project (DELETE operation)
        # Test deleting by ID
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.delete(
                project_id=project["id"],
            )
        )

        # Verify project was deleted (DELETE operation)
        with pytest.raises(Exception):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).projects.get(
                    project_id=project["id"],
                )
            )

        # Create another project to test deleting by name
        another_project = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.create(
                name=f"Another_{project_name}_{token_hex(8)}",
                description=f"Another project with {project_description}",
            )
        )

        # Test deleting by name
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).projects.delete(
                project_name=another_project["name"],
            )
        )

        # Verify project was deleted by name
        with pytest.raises(Exception):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).projects.get(
                    project_id=another_project["id"],
                )
            )
