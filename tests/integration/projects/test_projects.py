# pyright: reportPrivateUsage=false
from __future__ import annotations

import string
from secrets import token_hex

import pytest

from .._helpers import _ADMIN, _MEMBER, _await_or_return, _GetUser, _RoleOrUser


class TestClientForProjectsAPI:
    """Integration tests for the Projects client REST endpoints."""  # noqa: E501

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
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    @pytest.mark.parametrize("project_name,project_description", name_and_description_test_cases)
    async def test_crud_operations(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        project_name: str,
        project_description: str,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test CRUD operations for projects.

        This test verifies that:
        1. Projects can be created with a name and optional description (both admin and member)
        2. Projects can be retrieved by ID (both admin and member)
        3. Projects can be listed (both admin and member)
        4. Projects can be updated (description only, not name) (admin only)
        5. Projects can be deleted (admin only)
        6. Project names must be unique (both admin and member)
        7. Special characters in project names are handled correctly
        """  # noqa: E501
        # Set up test environment with logged-in user
        u = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", u.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient

        # Create a project with name suffix to ensure uniqueness
        name = f"{project_name}_{token_hex(16)}"
        description = f"A project with {project_description}"

        project = await _await_or_return(
            Client().projects.create(
                name=name,
                description=description,
            )
        )

        # Verify project was created with correct attributes (CREATE operation)
        assert project["id"], "Project ID should be present after creation"  # noqa: E501
        assert project["name"] == name, "Project name should match input after creation"  # noqa: E501
        assert "description" in project, "Project should have a description field"  # noqa: E501
        assert (
            project["description"] == description
        ), "Project description should match input after creation"  # noqa: E501

        # Test project name uniqueness (CREATE operation)
        with pytest.raises(Exception):
            await _await_or_return(
                Client().projects.create(
                    name=name,
                )
            )

        # Get the project by ID (READ operation)
        retrieved_project = await _await_or_return(
            Client().projects.get(
                project_id=project["id"],
            )
        )

        # Verify retrieved project matches created project (READ operation)
        assert (
            retrieved_project["id"] == project["id"]
        ), "Retrieved project ID should match created project"  # noqa: E501
        assert (
            retrieved_project["name"] == name
        ), "Retrieved project name should match created project"  # noqa: E501
        assert (
            "description" in retrieved_project
        ), "Retrieved project should have a description field"  # noqa: E501
        assert (
            retrieved_project["description"] == description
        ), "Retrieved project description should match created project"  # noqa: E501

        # List all projects (READ operation)
        all_projects = await _await_or_return(Client().projects.list())

        # Verify our project is in the list (READ operation)
        assert any(
            p["id"] == project["id"] for p in all_projects
        ), "Created project should be present in list of all projects"  # noqa: E501

        # Update the project description (admin only) (UPDATE operation)
        new_description = f"Updated description with {project_description}"
        if role_or_user == _ADMIN:
            updated_project = await _await_or_return(
                Client().projects.update(
                    project_id=project["id"],
                    description=new_description,
                )
            )

            # Verify project was updated with new description (UPDATE operation)
            assert (
                updated_project["id"] == project["id"]
            ), "Updated project ID should match original project"  # noqa: E501
            assert updated_project["name"] == name, "Project name should not change after update"  # noqa: E501
            assert (
                "description" in updated_project
            ), "Updated project should have a description field"  # noqa: E501
            assert (
                updated_project["description"] == new_description
            ), "Project description should be updated"  # noqa: E501

        else:
            # Member users should not be able to update projects (UPDATE operation)
            with pytest.raises(Exception) as exc_info:
                await _await_or_return(
                    Client().projects.update(
                        project_id=project["id"],
                        description=new_description,
                    )
                )
            assert "403" in str(
                exc_info.value
            ), "Member users should receive 403 Forbidden when attempting to update projects"  # noqa: E501

        # Delete the project (admin only) (DELETE operation)
        if role_or_user == _ADMIN:
            # Test deleting by ID
            await _await_or_return(
                Client().projects.delete(
                    project_id=project["id"],
                )
            )

            # Verify project was deleted (DELETE operation)
            with pytest.raises(Exception):
                await _await_or_return(
                    Client().projects.get(
                        project_id=project["id"],
                    )
                )

            # Create another project to test deleting by name
            another_project = await _await_or_return(
                Client().projects.create(
                    name=f"Another_{project_name}_{token_hex(8)}",
                    description=f"Another project with {project_description}",
                )
            )

            # Test deleting by name
            await _await_or_return(
                Client().projects.delete(
                    project_name=another_project["name"],
                )
            )

            # Verify project was deleted by name
            with pytest.raises(Exception):
                await _await_or_return(
                    Client().projects.get(
                        project_id=another_project["id"],
                    )
                )

        else:
            # Member users should not be able to delete projects (DELETE operation)
            with pytest.raises(Exception) as exc_info:
                await _await_or_return(
                    Client().projects.delete(
                        project_id=project["id"],
                    )
                )
            assert "403" in str(
                exc_info.value
            ), "Member users should receive 403 Forbidden when attempting to delete projects"  # noqa: E501

            # Verify project still exists (DELETE operation)
            retrieved_project = await _await_or_return(
                Client().projects.get(
                    project_id=project["id"],
                )
            )
            assert (
                retrieved_project["id"] == project["id"]
            ), "Project should still exist after member attempts deletion"  # noqa: E501
