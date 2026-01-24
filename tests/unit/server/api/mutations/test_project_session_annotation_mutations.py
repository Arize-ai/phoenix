import datetime
from secrets import token_hex
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
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
    Comprehensive end-to-end tests for project session annotation GraphQL mutations.

    This test suite covers the complete lifecycle of project session annotations,
    including creation, updates, deletion, and error handling scenarios.

    Test Organization:
    ==================
    A. CREATE operations (A1-A12):
       - Basic creation scenarios with various field combinations
       - Different AnnotatorKind values (HUMAN, LLM, CODE)
       - Different AnnotationSource values (API, APP)
       - Single-field scenarios (score-only, label-only, explanation-only)
       - Field trimming behavior (name, identifier, label, explanation)
       - Complex metadata structures and validation edge cases

    B. UPDATE operations (B1-B15):
       - Field updates and combinations
       - Setting values to null (score/label/explanation to null)
       - Enum value changes (annotatorKind, source)
       - Field trimming behavior (name, label, explanation)
       - Identifier immutability verification
       - Full-replacement behavior testing
       - Validation rule enforcement
       - Error scenarios (nonexistent IDs, wrong GID types)

    C. DELETE operations (C1-C3):
       - Successful deletions
       - Error scenarios (nonexistent IDs, wrong GID types)

    D. CREATE error cases (D1-D2):
       - Foreign key constraint violations
       - Invalid GID types and validation failures

    Key Discoveries:
    ================
    - UpdateAnnotationInput performs FULL REPLACEMENT, not partial updates
    - Both Create and Update inputs enforce: "At least one of score, label, or explanation must be not null/empty"
    - All AnnotatorKind (HUMAN, LLM, CODE) and AnnotationSource (API, APP) values are supported
    - Identifier field is immutable after creation (not included in UpdateAnnotationInput)
    - Error messages are meaningful and don't contain "unexpected" system errors
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
          annotatorKind
          source
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
          annotatorKind
          source
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
        Comprehensive test covering the full lifecycle of project session annotations.

        This single test method covers all CRUD operations and edge cases for project
        session annotations. It's structured as one large test to maintain data
        consistency and test realistic workflows where annotations are created,
        modified, and deleted in sequence.

        The test validates:
        - All field combinations and enum values
        - Validation rules and error handling
        - GraphQL schema compliance
        - Database consistency and constraint enforcement
        """
        project_session_gid = str(GlobalID("ProjectSession", str(project_session_data.id)))

        # ============================================================================
        # A. CREATE OPERATIONS (Success Cases)
        # ============================================================================

        # A1. Create a basic annotation with all standard fields
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

        # A2. Create with identifier omitted (UNSET) to test default behavior
        omitted_identifier_input: dict[str, Any] = {
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
        omitted_identifier_response = await gql_client.execute(self.QUERY, omitted_identifier_input)
        assert not omitted_identifier_response.errors
        assert omitted_identifier_response.data is not None
        created_omitted_identifier_annotation = omitted_identifier_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_omitted_identifier_annotation["identifier"] == ""
        assert created_omitted_identifier_annotation["name"] == "unset_identifier"
        assert (
            created_omitted_identifier_annotation["metadata"]
            == omitted_identifier_input["input"]["metadata"]
        )

        # A3. Create multiple annotations to test different metadata values
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

        # A4. Test AnnotatorKind enum: LLM
        llm_annotation_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "llm_annotation",
                "label": "LLM_LABEL",
                "score": 0.85,
                "explanation": "Generated by LLM",
                "annotatorKind": "LLM",  # Test LLM instead of HUMAN
                "metadata": {"model": "gpt-4"},
                "identifier": "llm_test",
                "source": "API",
            }
        }
        llm_annotation_response = await gql_client.execute(self.QUERY, llm_annotation_input)
        assert not llm_annotation_response.errors
        assert llm_annotation_response.data is not None
        created_llm_annotation = llm_annotation_response.data["createProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert created_llm_annotation["name"] == "llm_annotation"
        assert created_llm_annotation["annotatorKind"] == "LLM"
        assert created_llm_annotation["label"] == "LLM_LABEL"
        assert created_llm_annotation["score"] == 0.85
        assert created_llm_annotation["source"] == "API"
        assert created_llm_annotation["metadata"] == {"model": "gpt-4"}

        # A5. Test AnnotatorKind enum: CODE
        code_annotation_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "code_annotation",
                "label": "CODE_GENERATED",
                "score": 0.92,
                "explanation": "Generated by automated code",
                "annotatorKind": "CODE",  # Test CODE annotator
                "metadata": {"system": "automated", "version": "1.0"},
                "identifier": "code_test",
                "source": "APP",
            }
        }
        code_annotation_response = await gql_client.execute(self.QUERY, code_annotation_input)
        assert not code_annotation_response.errors
        assert code_annotation_response.data is not None
        created_code_annotation = code_annotation_response.data["createProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert created_code_annotation["name"] == "code_annotation"
        assert created_code_annotation["annotatorKind"] == "CODE"
        assert created_code_annotation["label"] == "CODE_GENERATED"
        assert created_code_annotation["score"] == 0.92
        assert created_code_annotation["source"] == "APP"
        assert created_code_annotation["metadata"] == {
            "system": "automated",
            "version": "1.0",
        }

        # A6. Create with only score (no label/explanation)
        score_only_create_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "score_only_annotation",
                "score": 0.65,  # Only provide score
                "annotatorKind": "HUMAN",
                "metadata": {},
                "identifier": "score_only",
                "source": "API",
            }
        }
        score_only_create_response = await gql_client.execute(self.QUERY, score_only_create_input)
        assert not score_only_create_response.errors
        assert score_only_create_response.data is not None
        created_score_only_annotation = score_only_create_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_score_only_annotation["name"] == "score_only_annotation"
        assert created_score_only_annotation["score"] == 0.65
        assert created_score_only_annotation["label"] is None
        assert created_score_only_annotation["explanation"] is None

        # A7. Create with only label (no score/explanation)
        label_only_create_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "label_only_annotation",
                "label": "LABEL_ONLY_TEST",  # Only provide label
                "annotatorKind": "LLM",
                "metadata": {"type": "classification"},
                "identifier": "label_only",
                "source": "APP",
            }
        }
        label_only_create_response = await gql_client.execute(self.QUERY, label_only_create_input)
        assert not label_only_create_response.errors
        assert label_only_create_response.data is not None
        created_label_only_annotation = label_only_create_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_label_only_annotation["name"] == "label_only_annotation"
        assert created_label_only_annotation["label"] == "LABEL_ONLY_TEST"
        assert created_label_only_annotation["score"] is None
        assert created_label_only_annotation["explanation"] is None
        assert created_label_only_annotation["annotatorKind"] == "LLM"

        # A8. Create with only explanation (no score/label)
        explanation_only_create_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "explanation_only_annotation",
                "explanation": "This annotation only has an explanation field",  # Only provide explanation
                "annotatorKind": "CODE",
                "metadata": {"reasoning": "edge_case_test"},
                "identifier": "explanation_only",
                "source": "API",
            }
        }
        explanation_only_create_response = await gql_client.execute(
            self.QUERY, explanation_only_create_input
        )
        assert not explanation_only_create_response.errors
        assert explanation_only_create_response.data is not None
        created_explanation_only_annotation = explanation_only_create_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_explanation_only_annotation["name"] == "explanation_only_annotation"
        assert (
            created_explanation_only_annotation["explanation"]
            == "This annotation only has an explanation field"
        )
        assert created_explanation_only_annotation["score"] is None
        assert created_explanation_only_annotation["label"] is None
        assert created_explanation_only_annotation["annotatorKind"] == "CODE"

        # A9. Test identifier trimming behavior (whitespace should be stripped)
        padded_identifier_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "padded_identifier_test",
                "label": "PADDED_TEST",
                "annotatorKind": "HUMAN",
                "metadata": {"test": "trimming"},
                "identifier": "   padded_identifier   ",  # Should be trimmed to "padded_identifier"
                "source": "API",
            }
        }
        padded_identifier_response = await gql_client.execute(self.QUERY, padded_identifier_input)
        assert not padded_identifier_response.errors
        assert padded_identifier_response.data is not None
        created_padded_identifier_annotation = padded_identifier_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_padded_identifier_annotation["name"] == "padded_identifier_test"
        assert (
            created_padded_identifier_annotation["identifier"] == "padded_identifier"
        )  # Whitespace trimmed
        assert created_padded_identifier_annotation["label"] == "PADDED_TEST"

        # A10. Test duplicate identifier behavior (should be allowed)
        duplicate_identifier_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "duplicate_identifier_test",
                "score": 0.33,
                "annotatorKind": "CODE",
                "metadata": {"duplicate": True},
                "identifier": "padded_identifier",  # Same as previous test (after trimming)
                "source": "APP",
            }
        }
        duplicate_identifier_response = await gql_client.execute(
            self.QUERY, duplicate_identifier_input
        )
        assert not duplicate_identifier_response.errors
        assert duplicate_identifier_response.data is not None
        created_duplicate_identifier_annotation = duplicate_identifier_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_duplicate_identifier_annotation["name"] == "duplicate_identifier_test"
        assert (
            created_duplicate_identifier_annotation["identifier"] == "padded_identifier"
        )  # Same identifier allowed
        assert created_duplicate_identifier_annotation["score"] == 0.33

        # A11. Test name, label and explanation trimming behavior (whitespace should be stripped)
        padded_fields_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "   padded_fields_test   ",  # Should be trimmed to "padded_fields_test"
                "label": "   PADDED_LABEL   ",  # Should be trimmed to "PADDED_LABEL"
                "explanation": "   This explanation has padding   ",  # Should be trimmed
                "annotatorKind": "HUMAN",
                "metadata": {"test": "field_trimming"},
                "identifier": "field_trimming_test",
                "source": "API",
            }
        }
        padded_fields_response = await gql_client.execute(self.QUERY, padded_fields_input)
        assert not padded_fields_response.errors
        assert padded_fields_response.data is not None
        created_padded_fields_annotation = padded_fields_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert (
            created_padded_fields_annotation["name"] == "padded_fields_test"
        )  # Whitespace trimmed
        assert created_padded_fields_annotation["label"] == "PADDED_LABEL"  # Whitespace trimmed
        assert (
            created_padded_fields_annotation["explanation"] == "This explanation has padding"
        )  # Whitespace trimmed
        assert created_padded_fields_annotation["identifier"] == "field_trimming_test"

        # A12. Create with all null optional fields (should fail validation)
        all_null_create_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "all_null_test",
                # No score, label, or explanation provided
                "annotatorKind": "HUMAN",
                "metadata": {},
                "identifier": "all_null",
                "source": "API",
            }
        }
        all_null_create_response = await gql_client.execute(self.QUERY, all_null_create_input)
        # This should fail validation since CreateProjectSessionAnnotationInput has the same validation as UpdateAnnotationInput
        assert all_null_create_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(all_null_create_response.errors[0].message).lower()
        assert "unexpected" not in error_message

        # A10. Create with complex metadata structure
        complex_metadata_input = {
            "input": {
                "projectSessionId": project_session_gid,
                "name": "complex_metadata_annotation",
                "label": "COMPLEX_TEST",
                "score": 0.78,
                "explanation": "Testing complex metadata structures",
                "annotatorKind": "HUMAN",
                "metadata": {
                    "nested": {
                        "level1": {"level2": {"value": 42}},
                        "array": [1, 2, 3, {"nested_in_array": True}],
                    },
                    "boolean_field": True,
                    "null_field": None,
                    "empty_string": "",
                    "large_number": 999999999,
                },
                "identifier": "complex_metadata",
                "source": "API",
            }
        }
        complex_metadata_response = await gql_client.execute(self.QUERY, complex_metadata_input)
        assert not complex_metadata_response.errors
        assert complex_metadata_response.data is not None
        created_complex_metadata_annotation = complex_metadata_response.data[
            "createProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert created_complex_metadata_annotation["name"] == "complex_metadata_annotation"
        assert (
            created_complex_metadata_annotation["metadata"]
            == complex_metadata_input["input"]["metadata"]
        )

        # ============================================================================
        # B. UPDATE OPERATIONS (Success and Error Cases)
        # ============================================================================

        # B1. Update mutation - update name and metadata of an existing annotation
        # Use the basic annotation we created
        patch_input = {
            "input": {
                "id": created_basic_annotation["id"],
                "name": "test_annotation_renamed",
                "label": "UPDATED_LABEL",  # Provide label to satisfy validation
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
        assert patched_annotation["label"] == "UPDATED_LABEL"
        assert patched_annotation["metadata"] == {"patched": True}

        # B2. Update nonexistent annotation should error
        nonexistent_patch_input = {
            "input": {
                "id": str(GlobalID("ProjectSessionAnnotation", "999999")),
                "name": "should_fail",
                "label": "DUMMY_LABEL",  # Provide label to satisfy validation
            }
        }
        nonexistent_patch_response = await gql_client.execute(
            self.QUERY,
            nonexistent_patch_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert nonexistent_patch_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(nonexistent_patch_response.errors[0].message).lower()
        assert "unexpected" not in error_message

        # B3. Update with wrong type GID should error
        invalid_gid_patch_input = {
            "input": {
                "id": str(GlobalID("Span", "999")),
                "name": "should_fail",
                "label": "DUMMY_LABEL",  # Provide label to satisfy validation
            }
        }
        invalid_gid_patch_response = await gql_client.execute(
            self.QUERY,
            invalid_gid_patch_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert invalid_gid_patch_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(invalid_gid_patch_response.errors[0].message).lower()
        assert "unexpected" not in error_message

        # B4. Update score from non-null to null (with label to satisfy validation)
        score_to_null_input = {
            "input": {
                "id": created_omitted_identifier_annotation[
                    "id"
                ],  # Use the annotation with score=0.5
                "name": "score_set_to_null",
                "score": None,
                "label": "NULL_SCORE_TEST",  # Provide label to satisfy validation
                "explanation": "Testing score update to null",
            }
        }
        score_to_null_response = await gql_client.execute(
            self.QUERY,
            score_to_null_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not score_to_null_response.errors
        assert score_to_null_response.data is not None
        updated_null_score_annotation = score_to_null_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_null_score_annotation["id"] == created_omitted_identifier_annotation["id"]
        assert updated_null_score_annotation["name"] == "score_set_to_null"
        assert updated_null_score_annotation["score"] is None
        assert updated_null_score_annotation["label"] == "NULL_SCORE_TEST"
        assert updated_null_score_annotation["explanation"] == "Testing score update to null"

        # Verify in database that score is actually null
        async with db() as session:
            db_annotation = await session.get(
                models.ProjectSessionAnnotation,
                from_global_id_with_expected_type(
                    GlobalID.from_id(created_omitted_identifier_annotation["id"]),
                    "ProjectSessionAnnotation",
                ),
            )
            assert db_annotation is not None
            assert db_annotation.score is None
            assert db_annotation.label == "NULL_SCORE_TEST"

        # B5. Update with score=null, label=null, explanation="" should fail validation
        invalid_all_null_input = {
            "input": {
                "id": created_basic_annotation["id"],
                "name": "should_fail_validation",
                "score": None,
                "label": None,
                "explanation": "",
            }
        }
        invalid_all_null_response = await gql_client.execute(
            self.QUERY,
            invalid_all_null_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert invalid_all_null_response.errors  # Should fail validation
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(invalid_all_null_response.errors[0].message).lower()
        assert "unexpected" not in error_message

        # B6. Test individual field update: score only
        # IMPORTANT: This reveals that UpdateAnnotationInput performs FULL REPLACEMENT
        # Fields not provided in the input are reset to their default values (null)
        score_only_input = {
            "input": {
                "id": created_first_metadata_annotation["id"],  # Use annotation with score=0.1
                "name": created_first_metadata_annotation["name"],  # Keep same name
                "score": 0.95,  # Change score from 0.1 to 0.95
            }
        }
        score_only_response = await gql_client.execute(
            self.QUERY,
            score_only_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not score_only_response.errors
        assert score_only_response.data is not None
        updated_score_annotation = score_only_response.data["updateProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert updated_score_annotation["id"] == created_first_metadata_annotation["id"]
        assert updated_score_annotation["score"] == 0.95
        assert updated_score_annotation["name"] == created_first_metadata_annotation["name"]
        # Fields not provided in input are reset to defaults
        assert updated_score_annotation["label"] is None
        assert updated_score_annotation["explanation"] is None

        # B7. Test individual field update: label only
        label_only_input = {
            "input": {
                "id": created_second_metadata_annotation["id"],  # Use annotation with label="B"
                "name": created_second_metadata_annotation["name"],  # Keep same name
                "label": "UPDATED_B_LABEL",  # Change label from "B" to "UPDATED_B_LABEL"
            }
        }
        label_only_response = await gql_client.execute(
            self.QUERY,
            label_only_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not label_only_response.errors
        assert label_only_response.data is not None
        updated_label_annotation = label_only_response.data["updateProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert updated_label_annotation["id"] == created_second_metadata_annotation["id"]
        assert updated_label_annotation["label"] == "UPDATED_B_LABEL"
        assert updated_label_annotation["name"] == created_second_metadata_annotation["name"]
        # Fields not provided in input are reset to defaults
        assert updated_label_annotation["score"] is None
        assert updated_label_annotation["explanation"] is None

        # B8. Test individual field update: explanation only
        explanation_only_input = {
            "input": {
                "id": created_basic_annotation["id"],  # Use basic annotation
                "name": "explanation_only_test",  # Change name too
                "explanation": "This is a completely new explanation",  # Change explanation
            }
        }
        explanation_only_response = await gql_client.execute(
            self.QUERY,
            explanation_only_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not explanation_only_response.errors
        assert explanation_only_response.data is not None
        updated_explanation_annotation = explanation_only_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_explanation_annotation["id"] == created_basic_annotation["id"]
        assert (
            updated_explanation_annotation["explanation"] == "This is a completely new explanation"
        )
        assert updated_explanation_annotation["name"] == "explanation_only_test"
        # Fields not provided in input are reset to defaults
        assert updated_explanation_annotation["label"] is None
        assert updated_explanation_annotation["score"] is None

        # B9. Test setting field to null: label from non-null to null
        label_to_null_input = {
            "input": {
                "id": updated_label_annotation["id"],  # Use annotation that has label
                "name": "label_set_to_null",
                "label": None,
                "score": 0.75,  # Provide score to satisfy validation
            }
        }
        label_to_null_response = await gql_client.execute(
            self.QUERY,
            label_to_null_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not label_to_null_response.errors
        assert label_to_null_response.data is not None
        updated_null_label_annotation = label_to_null_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_null_label_annotation["id"] == updated_label_annotation["id"]
        assert updated_null_label_annotation["label"] is None
        assert updated_null_label_annotation["score"] == 0.75
        assert updated_null_label_annotation["name"] == "label_set_to_null"

        # B10. Test setting field to null: explanation from non-null to null
        explanation_to_null_input = {
            "input": {
                "id": updated_explanation_annotation["id"],  # Use annotation that has explanation
                "name": "explanation_set_to_null",
                "explanation": None,
                "label": "EXPLANATION_NULL_TEST",  # Provide label to satisfy validation
            }
        }
        explanation_to_null_response = await gql_client.execute(
            self.QUERY,
            explanation_to_null_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not explanation_to_null_response.errors
        assert explanation_to_null_response.data is not None
        updated_null_explanation_annotation = explanation_to_null_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_null_explanation_annotation["id"] == updated_explanation_annotation["id"]
        assert updated_null_explanation_annotation["explanation"] is None
        assert updated_null_explanation_annotation["label"] == "EXPLANATION_NULL_TEST"
        assert updated_null_explanation_annotation["name"] == "explanation_set_to_null"

        # B11. Test enum field update: annotatorKind (HUMAN → LLM)
        annotator_kind_input = {
            "input": {
                "id": created_basic_annotation["id"],
                "name": "annotator_kind_test",
                "annotatorKind": "LLM",  # Change from HUMAN to LLM
                "label": "ANNOTATOR_KIND_TEST",  # Provide label to satisfy validation
            }
        }
        annotator_kind_response = await gql_client.execute(
            self.QUERY,
            annotator_kind_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not annotator_kind_response.errors
        assert annotator_kind_response.data is not None
        updated_annotator_kind_annotation = annotator_kind_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_annotator_kind_annotation["id"] == created_basic_annotation["id"]
        assert updated_annotator_kind_annotation["annotatorKind"] == "LLM"
        assert updated_annotator_kind_annotation["label"] == "ANNOTATOR_KIND_TEST"
        assert updated_annotator_kind_annotation["name"] == "annotator_kind_test"

        # B12. Test enum field update: source (APP → API)
        source_input = {
            "input": {
                "id": created_omitted_identifier_annotation[
                    "id"
                ],  # This was created with source=APP
                "name": "source_test",
                "source": "API",  # Change from APP to API
                "explanation": "Testing source update",  # Provide explanation to satisfy validation
            }
        }
        source_response = await gql_client.execute(
            self.QUERY,
            source_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not source_response.errors
        assert source_response.data is not None
        updated_source_annotation = source_response.data["updateProjectSessionAnnotations"][
            "projectSessionAnnotation"
        ]
        assert updated_source_annotation["id"] == created_omitted_identifier_annotation["id"]
        assert updated_source_annotation["source"] == "API"
        assert updated_source_annotation["explanation"] == "Testing source update"
        assert updated_source_annotation["name"] == "source_test"

        # B13. Test CODE annotatorKind (complete enum coverage)
        code_annotator_input = {
            "input": {
                "id": updated_source_annotation["id"],
                "name": "code_annotator_test",
                "annotatorKind": "CODE",  # Test the third enum value
                "score": 0.88,  # Provide score to satisfy validation
            }
        }
        code_annotator_response = await gql_client.execute(
            self.QUERY,
            code_annotator_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not code_annotator_response.errors
        assert code_annotator_response.data is not None
        updated_code_annotator_annotation = code_annotator_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_code_annotator_annotation["id"] == updated_source_annotation["id"]
        assert updated_code_annotator_annotation["annotatorKind"] == "CODE"
        assert updated_code_annotator_annotation["score"] == 0.88
        assert updated_code_annotator_annotation["name"] == "code_annotator_test"

        # B14. Test identifier immutability (identifier cannot be updated via UpdateAnnotationInput)
        # Note: UpdateAnnotationInput does not have an identifier field, so identifier should remain unchanged
        identifier_immutable_input = {
            "input": {
                "id": created_padded_identifier_annotation[
                    "id"
                ],  # Use annotation with identifier="padded_identifier"
                "name": "identifier_immutability_test",
                "label": "IDENTIFIER_IMMUTABLE_TEST",
                "metadata": {"test": "identifier_should_not_change"},
                "annotatorKind": "LLM",
                "source": "API",
            }
        }
        identifier_immutable_response = await gql_client.execute(
            self.QUERY,
            identifier_immutable_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not identifier_immutable_response.errors
        assert identifier_immutable_response.data is not None
        updated_identifier_immutable_annotation = identifier_immutable_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert (
            updated_identifier_immutable_annotation["id"]
            == created_padded_identifier_annotation["id"]
        )
        assert updated_identifier_immutable_annotation["name"] == "identifier_immutability_test"
        assert updated_identifier_immutable_annotation["label"] == "IDENTIFIER_IMMUTABLE_TEST"
        assert updated_identifier_immutable_annotation["annotatorKind"] == "LLM"
        # CRITICAL: Identifier should remain unchanged despite the update
        assert updated_identifier_immutable_annotation["identifier"] == "padded_identifier"

        # B15. Test name, label and explanation trimming in updates
        field_trimming_update_input = {
            "input": {
                "id": created_padded_fields_annotation["id"],  # Use annotation we created in A11
                "name": "   field_trimming_update_test   ",  # Should be trimmed
                "label": "   UPDATED_TRIMMED_LABEL   ",  # Should be trimmed
                "explanation": "   This updated explanation also has padding   ",  # Should be trimmed
                "metadata": {"updated": True, "trimming": "tested"},
                "annotatorKind": "LLM",
                "source": "APP",
            }
        }
        field_trimming_update_response = await gql_client.execute(
            self.QUERY,
            field_trimming_update_input,
            operation_name="UpdateProjectSessionAnnotations",
        )
        assert not field_trimming_update_response.errors
        assert field_trimming_update_response.data is not None
        updated_field_trimming_annotation = field_trimming_update_response.data[
            "updateProjectSessionAnnotations"
        ]["projectSessionAnnotation"]
        assert updated_field_trimming_annotation["id"] == created_padded_fields_annotation["id"]
        assert (
            updated_field_trimming_annotation["name"] == "field_trimming_update_test"
        )  # Whitespace trimmed
        assert (
            updated_field_trimming_annotation["label"] == "UPDATED_TRIMMED_LABEL"
        )  # Whitespace trimmed
        assert (
            updated_field_trimming_annotation["explanation"]
            == "This updated explanation also has padding"
        )  # Trimmed
        assert updated_field_trimming_annotation["annotatorKind"] == "LLM"
        assert updated_field_trimming_annotation["source"] == "APP"

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
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(nonexistent_delete_response.errors[0].message).lower()
        assert "unexpected" not in error_message

        # C3. Delete with wrong type GID should error
        invalid_gid_delete_response = await gql_client.execute(
            self.QUERY,
            {"id": str(GlobalID("Span", "999"))},
            operation_name="DeleteProjectSessionAnnotation",
        )
        assert invalid_gid_delete_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(invalid_gid_delete_response.errors[0].message).lower()
        assert "unexpected" not in error_message

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
            self.QUERY,
            invalid_foreign_key_input,
            operation_name="CreateProjectSessionAnnotations",
        )
        assert invalid_foreign_key_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(invalid_foreign_key_response.errors[0].message).lower()
        assert "unexpected" not in error_message

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
            self.QUERY,
            wrong_gid_type_input,
            operation_name="CreateProjectSessionAnnotations",
        )
        assert wrong_gid_type_response.errors
        # Verify error message is meaningful and not an unexpected system error
        error_message = str(wrong_gid_type_response.errors[0].message).lower()
        assert "unexpected" not in error_message
