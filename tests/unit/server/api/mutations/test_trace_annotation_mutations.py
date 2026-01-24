import datetime
from secrets import token_hex
from typing import Any

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def _trace_data(db: DbSessionFactory) -> models.Trace:
    """Create and persist a single `Trace` record for annotation tests.

    Returns the created `Trace` so tests can derive a stable Relay `GlobalID`.
    """
    async with db() as session:
        project = models.Project(name=token_hex(8))
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
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """End-to-end CRUD:

        - Create without identifier
        - Upsert with identifier
        - Upsert without identifier
        - Patch (label)
        - Delete
        """
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))

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
            self.QUERY,
            {"input": [create_input]},
            operation_name="CreateTraceAnnotations",
        )
        assert not result_create.errors
        assert result_create.data is not None
        data_create = result_create.data
        created = data_create["createTraceAnnotations"]["traceAnnotations"][0]
        assert created["name"] == create_input["name"]
        assert created["label"] == create_input["label"]
        assert created["score"] == create_input["score"]
        assert created["explanation"] == create_input["explanation"]
        assert created["identifier"] == ""
        assert isinstance(created["id"], str)

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
            self.QUERY,
            {"input": [base_with_id]},
            operation_name="CreateTraceAnnotations",
        )
        assert not res1.errors
        assert (data1 := res1.data)
        ann1 = data1["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["metadata"] == {"k": "v"}

        updated_with_id = {
            **base_with_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
            "metadata": {"k": "v2", "x": 1},
        }
        res2 = await gql_client.execute(
            self.QUERY,
            {"input": [updated_with_id]},
            operation_name="CreateTraceAnnotations",
        )
        assert not res2.errors
        assert (data2 := res2.data)
        ann2 = data2["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["id"] == ann2["id"]
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"
        assert ann2["metadata"] == {"k": "v2", "x": 1}

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
        assert not res3.errors
        assert (data3 := res3.data)
        ann3 = data3["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann3["name"] == base_no_id["name"]
        assert ann3["label"] == base_no_id["label"]
        assert ann3["score"] == base_no_id["score"]
        assert ann3["explanation"] == base_no_id["explanation"]
        assert ann3["identifier"] == ""

        updated_no_id = {
            **base_no_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
        }
        res4 = await gql_client.execute(
            self.QUERY,
            {"input": [updated_no_id]},
            operation_name="CreateTraceAnnotations",
        )
        assert not res4.errors
        assert (data4 := res4.data)
        ann4 = data4["createTraceAnnotations"]["traceAnnotations"][0]

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
        assert not res_patch.errors
        assert (data_patch := res_patch.data)
        patched = data_patch["patchTraceAnnotations"]["traceAnnotations"][0]
        assert patched["id"] == ann4["id"]
        assert patched["label"] == "PATCHED_LABEL"
        assert patched["score"] == 3.5
        assert patched["explanation"] == "Patched explanation"
        assert patched["metadata"] == {"patched": True}

        delete_input = {"annotationIds": [ann4["id"]]}
        res_delete = await gql_client.execute(
            self.QUERY, {"input": delete_input}, operation_name="DeleteTraceAnnotations"
        )
        assert not res_delete.errors
        assert (data_delete := res_delete.data)
        deleted = data_delete["deleteTraceAnnotations"]["traceAnnotations"][0]
        assert deleted["id"] == ann4["id"]
