import datetime
from secrets import token_hex
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture(autouse=True)
async def project_session_data(db: DbSessionFactory) -> models.ProjectSession:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        project_session = models.ProjectSession(
            session_id=token_hex(8),
            project_id=project.id,
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(project_session)

    return project_session


class TestProjectSessionAnnotationMutations:
    """
    End-to-end tests for project session annotations GraphQL mutations.

        Test structure:
    A. CREATE operations (success cases)
    B. UPDATE operations (success and error cases)
    C. DELETE operations (success and error cases)
    D. CREATE error cases (validation and constraint errors)
    """

    QUERY = """
    mutation CreateProjectSessionAnnotations($input: CreateProjectSessionAnnotationInput!) {
      createProjectSessionAnnotations(input: $input) {
        projectSessionAnnotation {
          id
          name
          label
          score
          explanation
          metadata
          identifier
        }
      }
    }
    mutation UpdateProjectSessionAnnotations($input: UpdateAnnotationInput!) {
      updateProjectSessionAnnotations(input: $input) {
        projectSessionAnnotation {
          id
          name
          label
          score
          explanation
          metadata
          identifier
        }
      }
    }
    mutation DeleteProjectSessionAnnotation($id: ID!) {
      deleteProjectSessionAnnotation(id: $id) {
        projectSessionAnnotation {
          id
          name
        }
      }
    }
    """

    async def test_create_annotations(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        project_session_data: models.ProjectSession,
    ) -> None:
        """
        Verifies create behavior for project session annotations.
        """
        project_session_gid = str(GlobalID("ProjectSession", str(project_session_data.id)))

        # ============================================================================
        # A. CREATE OPERATIONS (Success Cases)
        # ============================================================================

        # A1. Create a basic annotation with explicit empty identifier
        basic_annotation_input: dict[str, Any] = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "test_annotation",
                "label": "LABEL1",
                "score": 0.75,
                "explanation": "Initial explanation",
                "annotatorKind": "HUMAN",
                "metadata": {},
                "identifier": "",
                "source": "API",
            }
        }
        basic_annotation_response = await gql_client.execute(self.QUERY, basic_annotation_input)
        assert not basic_annotation_response.errors
        assert basic_annotation_response.data is not None
        created_basic_annotation = basic_annotation_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        expected_basic_data = basic_annotation_input["input"]
        assert created_basic_annotation["name"] == expected_basic_data["name"]
        assert created_basic_annotation["label"] == expected_basic_data["label"]
        assert created_basic_annotation["score"] == expected_basic_data["score"]
        assert created_basic_annotation["explanation"] == expected_basic_data["explanation"]
        assert created_basic_annotation["identifier"] == ""
        assert isinstance(created_basic_annotation["id"], str)

        # A2. Create with identifier omitted (UNSET) and source=APP → resolves to ""
        unset_identifier_input: dict[str, Any] = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "unset_identifier",
                "label": "LBL",
                "score": 0.5,
                "explanation": "Unset identifier should map to empty string",
                "annotatorKind": "HUMAN",
                # identifier omitted on purpose
                "metadata": {"a": 1, "nested": {"b": True}, "list": [1, 2, 3]},
                "source": "APP",
            }
        }
        unset_identifier_response = await gql_client.execute(self.QUERY, unset_identifier_input)
        assert not unset_identifier_response.errors
        assert unset_identifier_response.data is not None
        created_unset_annotation = unset_identifier_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_unset_annotation["identifier"] == ""
        assert created_unset_annotation["name"] == "unset_identifier"
        assert created_unset_annotation["metadata"] == unset_identifier_input["input"]["metadata"]

        # A3. Create multiple annotations with different metadata
        first_metadata_annotation_input = {
            "projectSessionId": project_session_gid,
            "name": "first_metadata_annotation",
            "label": "A",
            "score": 0.1,
            "explanation": "first annotation with metadata",
            "annotatorKind": "HUMAN",
            "identifier": "",
            "metadata": {"test_key": 1},
            "source": "API",
        }
        second_metadata_annotation_input = {
            "projectSessionId": project_session_gid,
            "name": "second_metadata_annotation",
            "label": "B",
            "score": 0.2,
            "explanation": "second annotation with metadata",
            "annotatorKind": "HUMAN",
            "identifier": "",
            "metadata": {"test_key": 2},
            "source": "API",
        }

        first_metadata_response = await gql_client.execute(
            self.QUERY, {"input": first_metadata_annotation_input}
        )
        assert not first_metadata_response.errors
        assert first_metadata_response.data is not None
        created_first_metadata_annotation = first_metadata_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]

        second_metadata_response = await gql_client.execute(
            self.QUERY, {"input": second_metadata_annotation_input}
        )
        assert not second_metadata_response.errors
        assert second_metadata_response.data is not None
        created_second_metadata_annotation = second_metadata_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]

        assert created_first_metadata_annotation["name"] == "first_metadata_annotation"
        assert created_first_metadata_annotation["metadata"] == {"test_key": 1}
        assert created_second_metadata_annotation["name"] == "second_metadata_annotation"
        assert created_second_metadata_annotation["metadata"] == {"test_key": 2}

        # Store for later deletion test
        created_metadata_annotations = [
            created_first_metadata_annotation,
            created_second_metadata_annotation,
        ]

        # ============================================================================
        # B. UPDATE OPERATIONS (Success and Error Cases)
        # ============================================================================

        # B1. Update mutation - update name and metadata of an existing annotation
        # Use the basic annotation we created
        patch_input = {
            "input": {
                "annotationId": created_basic_annotation["id"],
                "name": "test_annotation_renamed",
                "metadata": {"patched": True},
            }
        }
        patch_response = await gql_client.execute(
            self.QUERY,
            patch_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not patch_response.errors
        assert patch_response.data is not None
        patched_annotation = patch_response.data["updateProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert patched_annotation["id"] == created_basic_annotation["id"]
        assert patched_annotation["name"] == "test_annotation_renamed"
        assert patched_annotation["metadata"] == {"patched": True}

        # B2. Update nonexistent annotation should error
        nonexistent_patch_input = {
            "input": {
                "annotationId": str(GlobalID("ProjectSessionAnnotation", "999999")),
                "name": "should_fail",
            }
        }
        nonexistent_patch_response = await gql_client.execute(
            self.QUERY,
            nonexistent_patch_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert nonexistent_patch_response.errors

        # B3. Update with wrong type GID should error
        invalid_gid_patch_input = {
            "input": {
                "annotationId": str(GlobalID("Span", "999")),
                "name": "should_fail",
            }
        }
        invalid_gid_patch_response = await gql_client.execute(
            self.QUERY,
            invalid_gid_patch_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert invalid_gid_patch_response.errors

        # ============================================================================
        # C. DELETE OPERATIONS (Success and Error Cases)
        # ============================================================================

        # C1. Delete mutation - delete first created annotation
        delete_response = await gql_client.execute(
            self.QUERY,
            {"id": created_metadata_annotations[0]["id"]},
            operation_name="DeleteProjectSessionAnnotation",
        )
        assert not delete_response.errors
        assert delete_response.data is not None
        deleted_annotation = delete_response.data["deleteProjectSessionAnnotation"][
            "projectSessionAnnotation"
        ]
        assert deleted_annotation["id"] == created_metadata_annotations[0]["id"]

        # C2. Delete nonexistent annotation should error
        nonexistent_delete_response = await gql_client.execute(
            self.QUERY,
            {"id": str(GlobalID("ProjectSessionAnnotation", "999999"))},
            operation_name="DeleteProjectSessionAnnotation",
        )
        assert nonexistent_delete_response.errors

        # C3. Delete with wrong type GID should error
        invalid_gid_delete_response = await gql_client.execute(
            self.QUERY,
            {"id": str(GlobalID("Span", "999"))},
            operation_name="DeleteProjectSessionAnnotation",
        )
        assert invalid_gid_delete_response.errors

        # ============================================================================
        # D. CREATE ERROR CASES (Validation and Constraint Errors)
        # ============================================================================

        # D1. Create with nonexistent foreign key should error
        nonexistent_project_session_id = str(GlobalID("ProjectSession", "999999"))
        invalid_foreign_key_input = {
            "input": {
                "projectSessionId": nonexistent_project_session_id,
                "name": "test_annotation",
                "label": "LABEL1",
                "score": 0.75,
                "explanation": "This should fail due to nonexistent session",
                "annotatorKind": "HUMAN",
                "metadata": {},
                "identifier": "",
                "source": "API",
            }
        }
        invalid_foreign_key_response = await gql_client.execute(
            self.QUERY, invalid_foreign_key_input, operation_name="CreateProjectSessionAnnotations"
        )
        assert invalid_foreign_key_response.errors

        # D2. Create with invalid projectSessionId type should error (bad GID type)
        wrong_gid_type_input = {
            "input": {
                "projectSessionId": str(GlobalID("Span", "123")),
                "name": "invalid_gid_test",
                "label": "X",
                "score": 0.0,
                "explanation": "This should fail due to wrong GID type",
                "annotatorKind": "HUMAN",
                "metadata": {},
                "identifier": "",
                "source": "API",
            }
        }
        wrong_gid_type_response = await gql_client.execute(
            self.QUERY, wrong_gid_type_input, operation_name="CreateProjectSessionAnnotations"
        )
        assert wrong_gid_type_response.errors
