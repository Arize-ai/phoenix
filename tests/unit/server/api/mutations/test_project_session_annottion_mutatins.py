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

    This single test covers:
    1. Creating a new annotation for a `ProjectSession`.
    2. Upserting (update-on-conflict) when an annotation with the same
       (projectSessionId, name, identifier) already exists.
    3. Upserting for both identifier cases: non-empty identifier and empty "".
    4. Identifier omitted (UNSET) with source=APP resolves to empty string.
    5. Batch create ordering and metadata round-trip.
    6. Clearing semantics for nullable fields via upsert.
    7. Patch mutation success and duplicate-id error path.
    8. Delete mutation success (order preserved) and duplicate-id error path.
    9. Invalid GlobalID types and missing-id errors.
    """

    QUERY = """
    mutation CreateProjectSessionAnnotations($input: [CreateProjectSessionAnnotationInput!]!) {
      createProjectSessionAnnotations(input: $input) {
        projectSessionAnnotations {
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
    mutation PatchProjectSessionAnnotations($input: [PatchAnnotationInput!]!) {
      patchProjectSessionAnnotations(input: $input) {
        projectSessionAnnotations {
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
    mutation DeleteProjectSessionAnnotations($input: DeleteAnnotationsInput!) {
      deleteProjectSessionAnnotations(input: $input) {
        projectSessionAnnotations {
          id
          name
        }
      }
    }
    """

    async def test_create_and_upsert_annotations(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        project_session_data: models.ProjectSession,
    ) -> None:
        """
        Verifies create and upsert behavior for project session annotations for
        both non-empty and empty identifiers.
        """
        session_gid = str(GlobalID("ProjectSession", str(project_session_data.id)))

        # 1. Create a basic annotation (identifier = "")
        create_basic_vars: dict[str, Any] = {
            "input": [
                {
                    "projectSessionId": session_gid,
                    "name": "test_annotation",
                    "label": "LABEL1",
                    "score": 0.75,
                    "explanation": "Initial explanation",
                    "annotatorKind": "HUMAN",
                    "metadata": {},
                    "identifier": "",
                    "source": "API",
                }
            ]
        }
        res_basic = await gql_client.execute(self.QUERY, create_basic_vars)
        assert not res_basic.errors, f"1. create returned errors: {res_basic.errors}"
        assert res_basic.data is not None, "1. create returned no data"
        data_basic = res_basic.data["createProjectSessionAnnotations"]["projectSessionAnnotations"][
            0
        ]
        expected_basic = create_basic_vars["input"][0]
        assert data_basic["name"] == expected_basic["name"], (
            f"1. name mismatch: got={data_basic['name']} expected={expected_basic['name']}"
        )
        assert data_basic["label"] == expected_basic["label"], (
            f"1. label mismatch: got={data_basic['label']} expected={expected_basic['label']}"
        )
        assert data_basic["score"] == expected_basic["score"], (
            f"1. score mismatch: got={data_basic['score']} expected={expected_basic['score']}"
        )
        assert data_basic["explanation"] == expected_basic["explanation"], (
            f"1. explanation mismatch: got={data_basic['explanation']} expected={expected_basic['explanation']}"
        )
        assert data_basic["identifier"] == "", (
            f"1. identifier should be empty, got {data_basic['identifier']}"
        )
        assert isinstance(data_basic["id"], str), (
            f"1. id should be a str, got type={type(data_basic['id'])}"
        )

        # 1.1 Create with identifier omitted (UNSET) and source=APP → resolves to ""
        unset_identifier_vars: dict[str, Any] = {
            "input": [
                {
                    "projectSessionId": session_gid,
                    "name": "unset_identifier",
                    "label": "LBL",
                    "score": 0.5,
                    "explanation": "Unset identifier should map to empty string",
                    "annotatorKind": "HUMAN",
                    # identifier omitted on purpose
                    "metadata": {"a": 1, "nested": {"b": True}, "list": [1, 2, 3]},
                    "source": "APP",
                }
            ]
        }
        res_unset_id = await gql_client.execute(self.QUERY, unset_identifier_vars)
        assert not res_unset_id.errors, (
            f"1.1 unset identifier create returned errors: {res_unset_id.errors}"
        )
        assert res_unset_id.data is not None, "1.1 unset identifier create returned no data"
        data_unset_id = res_unset_id.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ][0]
        assert data_unset_id["identifier"] == "", (
            f"1.1 identifier should resolve to empty for APP source, got {data_unset_id['identifier']}"
        )
        assert data_unset_id["name"] == "unset_identifier", (
            f"1.1 name mismatch: got={data_unset_id['name']}"
        )
        assert data_unset_id["metadata"] == unset_identifier_vars["input"][0]["metadata"], (
            "1.1 metadata did not round-trip"
        )

        # 2. Upsert with non-empty identifier (should update in-place)
        base_conflict_input = {
            "projectSessionId": session_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "conflict",
            "source": "APP",
        }
        res_create_conflict = await gql_client.execute(self.QUERY, {"input": [base_conflict_input]})
        assert not res_create_conflict.errors, (
            f"2. initial create returned errors: {res_create_conflict.errors}"
        )
        assert res_create_conflict.data is not None, "2. initial create returned no data"
        id_conflict_1 = res_create_conflict.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ][0]["id"]

        updated_conflict_input = base_conflict_input.copy()
        updated_conflict_input.update(
            {"label": "UPDATED_LABEL", "score": 2.0, "explanation": "Updated explanation"}
        )
        res_update_conflict = await gql_client.execute(
            self.QUERY, {"input": [updated_conflict_input]}
        )
        assert not res_update_conflict.errors, (
            f"2. upsert update returned errors: {res_update_conflict.errors}"
        )
        assert res_update_conflict.data is not None, "2. upsert update returned no data"
        ann_conflict_2 = res_update_conflict.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ][0]
        assert ann_conflict_2["id"] == id_conflict_1, "2. upsert should keep the same id"
        assert ann_conflict_2["label"] == "UPDATED_LABEL", (
            f"2. label not updated: got={ann_conflict_2['label']}"
        )
        assert ann_conflict_2["score"] == 2.0, (
            f"2. score not updated: got={ann_conflict_2['score']}"
        )
        assert ann_conflict_2["explanation"] == "Updated explanation", (
            f"2. explanation not updated: got={ann_conflict_2['explanation']}"
        )

        # 3. Upsert with empty identifier (should update in-place for that identifier)
        base_empty_id_input = {
            "projectSessionId": session_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "",
            "source": "APP",
        }
        res_create_empty = await gql_client.execute(self.QUERY, {"input": [base_empty_id_input]})
        assert not res_create_empty.errors, (
            f"3. initial create (empty id) returned errors: {res_create_empty.errors}"
        )
        assert res_create_empty.data is not None, "3. initial create (empty id) returned no data"
        id_empty_1 = res_create_empty.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ][0]["id"]
        assert id_conflict_1 != id_empty_1, (
            "3. same annotation name should allow distinct records when identifier differs"
        )

        updated_empty_id_input = base_empty_id_input.copy()
        updated_empty_id_input.update(
            {"label": "UPDATED_LABEL", "score": 2.0, "explanation": "Updated explanation"}
        )
        res_update_empty = await gql_client.execute(self.QUERY, {"input": [updated_empty_id_input]})
        assert not res_update_empty.errors, (
            f"3. upsert update (empty id) returned errors: {res_update_empty.errors}"
        )
        assert res_update_empty.data is not None, "3. upsert update (empty id) returned no data"
        ann_empty_2 = res_update_empty.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ][0]
        assert ann_empty_2["id"] == id_empty_1, "3. upsert (empty id) should keep the same id"
        assert ann_empty_2["label"] == "UPDATED_LABEL", (
            f"3. label not updated: got={ann_empty_2['label']}"
        )
        assert ann_empty_2["score"] == 2.0, f"3. score not updated: got={ann_empty_2['score']}"
        assert ann_empty_2["explanation"] == "Updated explanation", (
            f"3. explanation not updated: got={ann_empty_2['explanation']}"
        )

        # 4. Batch create 2 annotations and verify return order is preserved
        batch_inputs = [
            {
                "projectSessionId": session_gid,
                "name": "batch_a",
                "label": "A",
                "score": 0.1,
                "explanation": "first",
                "annotatorKind": "HUMAN",
                "identifier": "",
                "metadata": {"m": 1},
                "source": "API",
            },
            {
                "projectSessionId": session_gid,
                "name": "batch_b",
                "label": "B",
                "score": 0.2,
                "explanation": "second",
                "annotatorKind": "HUMAN",
                "identifier": "",
                "metadata": {"n": 2},
                "source": "API",
            },
        ]
        res_batch = await gql_client.execute(self.QUERY, {"input": batch_inputs})
        assert not res_batch.errors, f"4. batch create returned errors: {res_batch.errors}"
        assert res_batch.data is not None, "4. batch create returned no data"
        returned_batch = res_batch.data["createProjectSessionAnnotations"][
            "projectSessionAnnotations"
        ]
        assert [a["name"] for a in returned_batch] == [i["name"] for i in batch_inputs], (
            "4. returned order does not match input order"
        )
        assert returned_batch[0]["metadata"] == {"m": 1}, (
            f"4. metadata[0] mismatch: got={returned_batch[0]['metadata']}"
        )
        assert returned_batch[1]["metadata"] == {"n": 2}, (
            f"4. metadata[1] mismatch: got={returned_batch[1]['metadata']}"
        )

        # 5. Clearing semantics - set nullable fields to null on upsert
        # Start by updating the initial basic annotation to known non-null values
        res_set_values = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "projectSessionId": session_gid,
                        "name": "test_annotation",
                        "label": "TO_CLEAR",
                        "score": 9.9,
                        "explanation": "to clear",
                        "annotatorKind": "HUMAN",
                        "identifier": "",
                        "metadata": {},
                        "source": "API",
                    }
                ]
            },
        )
        assert not res_set_values.errors, (
            f"5. set-values upsert returned errors: {res_set_values.errors}"
        )
        # Now clear label and explanation by setting them to null (keep score to avoid clearing it)
        res_clear = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "projectSessionId": session_gid,
                        "name": "test_annotation",
                        "label": None,
                        "score": 9.9,
                        "explanation": None,
                        "annotatorKind": "HUMAN",
                        "identifier": "",
                        "metadata": {},
                        "source": "API",
                    }
                ]
            },
        )
        assert not res_clear.errors, f"5. clear upsert returned errors: {res_clear.errors}"
        assert res_clear.data is not None, "5. clear upsert returned no data"
        cleared = res_clear.data["createProjectSessionAnnotations"]["projectSessionAnnotations"][0]
        assert cleared["label"] is None, f"5. label not cleared: got={cleared['label']}"
        assert cleared["explanation"] is None, (
            f"5. explanation not cleared: got={cleared['explanation']}"
        )
        assert cleared["score"] == 9.9, f"5. score unexpectedly changed: got={cleared['score']}"

        # 6. Patch mutation - update name and metadata of an existing annotation
        # Use the previously created conflict annotation id
        patch_res = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "annotationId": ann_conflict_2["id"],
                        "name": "conflict_test_renamed",
                        "metadata": {"patched": True},
                    }
                ]
            },
            operation_name="PatchProjectSessionAnnotations",
        )
        assert not patch_res.errors, f"6. patch returned errors: {patch_res.errors}"
        assert patch_res.data is not None, "6. patch returned no data"
        patched = patch_res.data["patchProjectSessionAnnotations"]["projectSessionAnnotations"][0]
        assert patched["id"] == ann_conflict_2["id"], "6. patch changed id unexpectedly"
        assert patched["name"] == "conflict_test_renamed", (
            f"6. patch did not update name: got={patched['name']}"
        )
        assert patched["metadata"] == {"patched": True}, (
            f"6. patch did not update metadata: got={patched['metadata']}"
        )

        # 7. Patch duplicate ids should error
        dup_patch_res = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {"annotationId": patched["id"], "name": "x"},
                    {"annotationId": patched["id"], "name": "y"},
                ]
            },
            operation_name="PatchProjectSessionAnnotations",
        )
        assert dup_patch_res.errors, "7. duplicate patch ids should produce errors"

        # 8. Delete mutation - delete two created batch annotations, ensure order preserved
        del_res = await gql_client.execute(
            self.QUERY,
            {"input": {"annotationIds": [returned_batch[1]["id"], returned_batch[0]["id"]]}},
            operation_name="DeleteProjectSessionAnnotations",
        )
        assert not del_res.errors, f"8. delete returned errors: {del_res.errors}"
        assert del_res.data is not None, "8. delete returned no data"
        deleted = del_res.data["deleteProjectSessionAnnotations"]["projectSessionAnnotations"]
        assert [d["id"] for d in deleted] == [returned_batch[1]["id"], returned_batch[0]["id"]], (
            "8. delete did not preserve order"
        )

        # 8.1 Delete with duplicate ids should error
        dup_del_res = await gql_client.execute(
            self.QUERY,
            {"input": {"annotationIds": [patched["id"], patched["id"]]}},
            operation_name="DeleteProjectSessionAnnotations",
        )
        assert dup_del_res.errors, "8.1 duplicate delete ids should produce errors"

        # 9. Create with invalid projectSessionId type should error (bad GID type)
        bad_gid_vars = {
            "input": [
                {
                    "projectSessionId": str(GlobalID("Span", "123")),
                    "name": "bad",
                    "label": "X",
                    "score": 0.0,
                    "explanation": "bad gid",
                    "annotatorKind": "HUMAN",
                    "metadata": {},
                    "identifier": "",
                    "source": "API",
                }
            ]
        }
        bad_res = await gql_client.execute(
            self.QUERY, bad_gid_vars, operation_name="CreateProjectSessionAnnotations"
        )
        assert bad_res.errors, "9. creating with wrong GID type should produce errors"

        # 9.1 Patch with wrong type GID should error
        wrong_type_patch = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "annotationId": str(GlobalID("Span", "999")),
                        "name": "nope",
                    }
                ]
            },
            operation_name="PatchProjectSessionAnnotations",
        )
        assert wrong_type_patch.errors, "9.1 patch with wrong GID type should produce errors"

        # 9.2 Delete with missing id should error
        missing_id = str(GlobalID("ProjectSessionAnnotation", "999999"))
        missing_del_res = await gql_client.execute(
            self.QUERY,
            {"input": {"annotationIds": [missing_id]}},
            operation_name="DeleteProjectSessionAnnotations",
        )
        assert missing_del_res.errors, "9.2 delete with missing id should produce errors"
