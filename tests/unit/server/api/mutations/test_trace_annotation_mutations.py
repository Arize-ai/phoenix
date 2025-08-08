import datetime
from secrets import token_hex
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture(autouse=True)
async def trace_data(db: DbSessionFactory) -> models.Trace:
    """Create and persist a single `Trace` record for annotation tests.

    Returns the created `Trace` so tests can derive a stable Relay `GlobalID`.
    """
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id=token_hex(16),
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(trace)
    return trace


class TestTraceAnnotationMutations:
    """End-to-end tests for creating and upserting Trace annotations.

    This suite validates both initial creation and upsert-on-conflict behavior
    with and without an `identifier` for the same `(trace, name)` pair.
    """

    QUERY = """
    mutation CreateTraceAnnotations($input: [CreateTraceAnnotationInput!]!) {
      createTraceAnnotations(input: $input) {
        traceAnnotations {
          id
          name
          label
          score
          explanation
          identifier
          metadata
        }
      }
    }

    mutation PatchTraceAnnotations($input: [PatchAnnotationInput!]!) {
      patchTraceAnnotations(input: $input) {
        traceAnnotations {
          id
          name
          label
          score
          explanation
          identifier
          metadata
        }
      }
    }

    mutation DeleteTraceAnnotations($input: DeleteAnnotationsInput!) {
      deleteTraceAnnotations(input: $input) {
        traceAnnotations {
          id
        }
      }
    }
    """

    async def test_trace_annotations_create_upsert_patch_delete(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        trace_data: models.Trace,
    ) -> None:
        """End-to-end CRUD:

        - Create without identifier
        - Upsert with identifier
        - Upsert without identifier
        - Patch (label)
        - Delete
        """
        trace_gid = str(GlobalID("Trace", str(trace_data.id)))

        # 1) Basic create (no identifier)
        create_input: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "create_basic",
            "label": "LABEL1",
            "score": 0.75,
            "explanation": "Initial explanation",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "",
            "source": AnnotationSource.API.name,
        }
        result_create = await gql_client.execute(
            self.QUERY, {"input": [create_input]}, operation_name="CreateTraceAnnotations"
        )
        assert not result_create.errors, f"CreateTraceAnnotations errors: {result_create.errors}"
        assert result_create.data is not None, "CreateTraceAnnotations returned no data"
        created = result_create.data["createTraceAnnotations"]["traceAnnotations"][0]
        assert created["name"] == create_input["name"], (
            f"Created name mismatch. expected={create_input['name']} actual={created['name']}"
        )
        assert created["label"] == create_input["label"], (
            f"Created label mismatch. expected={create_input['label']} actual={created['label']}"
        )
        assert created["score"] == create_input["score"], (
            f"Created score mismatch. expected={create_input['score']} actual={created['score']}"
        )
        assert created["explanation"] == create_input["explanation"], (
            f"Created explanation mismatch. expected={create_input['explanation']} actual={created['explanation']}"
        )
        assert created["identifier"] == "", (
            f"Expected empty identifier, actual={created['identifier']}"
        )
        assert isinstance(created["id"], str), (
            f"Expected id to be str, actual_type={type(created['id']).__name__} value={created['id']}"
        )

        # 2) Upsert with identifier (should update in place)
        base_with_id: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "conflict_with_id",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {"k": "v"},
            "identifier": "conflict",
            "source": "APP",
        }
        res1 = await gql_client.execute(
            self.QUERY, {"input": [base_with_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res1.errors, f"CreateTraceAnnotations (with identifier) errors: {res1.errors}"
        ann1 = res1.data["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["metadata"] == {"k": "v"}, (
            f"Initial metadata mismatch. expected={{'k': 'v'}} actual={ann1['metadata']}"
        )

        updated_with_id = {
            **base_with_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
            "metadata": {"k": "v2", "x": 1},
        }
        res2 = await gql_client.execute(
            self.QUERY, {"input": [updated_with_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res2.errors, f"CreateTraceAnnotations upsert errors: {res2.errors}"
        ann2 = res2.data["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["id"] == ann2["id"], (
            f"Upsert should preserve id. before={ann1['id']} after={ann2['id']}"
        )
        assert ann2["label"] == "UPDATED_LABEL", (
            f"Upsert label mismatch. expected=UPDATED_LABEL actual={ann2['label']}"
        )
        assert ann2["score"] == 2.0, f"Upsert score mismatch. expected=2.0 actual={ann2['score']}"
        assert ann2["explanation"] == "Updated explanation", (
            f"Upsert explanation mismatch. expected='Updated explanation' actual={ann2['explanation']}"
        )
        assert ann2["metadata"] == {"k": "v2", "x": 1}, (
            f"Upsert metadata mismatch. expected={{'k': 'v2', 'x': 1}} actual={ann2['metadata']}"
        )

        # 3) Upsert without identifier (empty identifier also conflicts on (trace, name))
        base_no_id: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "conflict_no_id",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "",
            "source": "APP",
        }
        res3 = await gql_client.execute(
            self.QUERY, {"input": [base_no_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res3.errors, f"CreateTraceAnnotations (no identifier) errors: {res3.errors}"
        ann3 = res3.data["createTraceAnnotations"]["traceAnnotations"][0]

        updated_no_id = {
            **base_no_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
        }
        res4 = await gql_client.execute(
            self.QUERY, {"input": [updated_no_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res4.errors, (
            f"CreateTraceAnnotations upsert (no identifier) errors: {res4.errors}"
        )
        ann4 = res4.data["createTraceAnnotations"]["traceAnnotations"][0]

        # Optional: patch the last annotation (label, score, explanation, metadata)
        patch_input = [
            {
                "annotationId": ann4["id"],
                "label": "PATCHED_LABEL",
                "score": 3.5,
                "explanation": "Patched explanation",
                "metadata": {"patched": True},
            }
        ]
        res_patch = await gql_client.execute(
            self.QUERY, {"input": patch_input}, operation_name="PatchTraceAnnotations"
        )
        assert not res_patch.errors, f"PatchTraceAnnotations errors: {res_patch.errors}"
        patched = res_patch.data["patchTraceAnnotations"]["traceAnnotations"][0]
        assert patched["id"] == ann4["id"], (
            f"Patched annotation id mismatch. expected={ann4['id']} actual={patched['id']}"
        )
        assert patched["label"] == "PATCHED_LABEL", (
            f"Patched label mismatch. expected=PATCHED_LABEL actual={patched['label']}"
        )
        assert patched["score"] == 3.5, (
            f"Patched score mismatch. expected=3.5 actual={patched['score']}"
        )
        assert patched["explanation"] == "Patched explanation", (
            f"Patched explanation mismatch. expected='Patched explanation' actual={patched['explanation']}"
        )
        assert patched["metadata"] == {"patched": True}, (
            f"Patched metadata mismatch. expected={{'patched': True}} actual={patched['metadata']}"
        )

        delete_input = {"annotationIds": [ann4["id"]]}
        res_delete = await gql_client.execute(
            self.QUERY, {"input": delete_input}, operation_name="DeleteTraceAnnotations"
        )
        assert not res_delete.errors, f"DeleteTraceAnnotations errors: {res_delete.errors}"
        deleted = res_delete.data["deleteTraceAnnotations"]["traceAnnotations"][0]
        assert deleted["id"] == ann4["id"], (
            f"Deleted id mismatch. expected={ann4['id']} actual={deleted['id']}"
        )
