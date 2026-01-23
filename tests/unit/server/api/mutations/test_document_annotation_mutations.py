import datetime

import pytest
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture(autouse=True)
async def span_data(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="trace-1",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(trace)
        await session.flush()

        span1 = models.Span(
            trace_rowid=trace.id,
            span_id="span1",
            name="span1",
            span_kind="RETRIEVER",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={
                "retrieval": {"documents": [{"document": {"content": f"doc{i}"}} for i in range(5)]}
            },
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span1)


CREATE_MUTATION = """
mutation CreateDocumentAnnotations($input: [CreateDocumentAnnotationInput!]!) {
  createDocumentAnnotations(input: $input) {
    documentAnnotations { id name documentPosition label score explanation identifier }
  }
}
"""

PATCH_MUTATION = """
mutation PatchDocumentAnnotations($input: [PatchAnnotationInput!]!) {
  patchDocumentAnnotations(input: $input) {
    documentAnnotations { id name label score explanation }
  }
}
"""

DELETE_MUTATION = """
mutation DeleteDocumentAnnotations($input: DeleteAnnotationsInput!) {
  deleteDocumentAnnotations(input: $input) {
    documentAnnotations { id name }
  }
}
"""


class TestDocumentAnnotationMutations:
    async def test_create_patch_delete_document_annotations(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        span_gid = str(GlobalID("Span", "1"))

        # === CREATE ===

        # Create single annotation
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 0,
                        "name": "relevance",
                        "label": "relevant",
                        "score": 0.95,
                        "explanation": "Highly relevant",
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert not res.errors
        ann = res.data["createDocumentAnnotations"]["documentAnnotations"][0]  # type: ignore
        assert ann["name"] == "relevance"
        assert ann["documentPosition"] == 0
        assert ann["score"] == 0.95
        ann1_id = ann["id"]

        # Create multiple annotations
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 1,
                        "name": "relevance",
                        "label": "irrelevant",
                        "score": 0.2,
                        "explanation": "Not relevant",
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "batch",
                        "source": AnnotationSource.API.name,
                    },
                    {
                        "spanId": span_gid,
                        "documentPosition": 2,
                        "name": "relevance",
                        "label": "relevant",
                        "score": 0.8,
                        "explanation": "Relevant",
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "batch",
                        "source": AnnotationSource.API.name,
                    },
                ]
            },
        )
        assert not res.errors
        anns = res.data["createDocumentAnnotations"]["documentAnnotations"]  # type: ignore
        assert len(anns) == 2
        ann2_id, ann3_id = anns[0]["id"], anns[1]["id"]

        # Upsert: same (name, span, position, identifier) updates existing
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 0,
                        "name": "relevance",
                        "label": "UPDATED",
                        "score": 0.99,
                        "explanation": "Updated via upsert",
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert not res.errors
        ann = res.data["createDocumentAnnotations"]["documentAnnotations"][0]  # type: ignore
        assert ann["id"] == ann1_id  # Same ID = upsert worked
        assert ann["label"] == "UPDATED"
        assert ann["score"] == 0.99

        # Different identifier creates new annotation
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 0,
                        "name": "relevance",
                        "label": "different",
                        "score": 0.5,
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "different-identifier",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert not res.errors
        ann4_id = res.data["createDocumentAnnotations"]["documentAnnotations"][0]["id"]  # type: ignore
        assert ann4_id != ann1_id  # Different identifier = new annotation

        # Different documentPosition creates new annotation (same name, span, identifier)
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 3,  # Different position
                        "name": "relevance",
                        "label": "pos3",
                        "score": 0.7,
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "",  # Same as ann1
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert not res.errors
        ann5_id = res.data["createDocumentAnnotations"]["documentAnnotations"][0]["id"]  # type: ignore
        assert ann5_id != ann1_id  # Different position = new annotation

        # Out-of-bounds documentPosition fails (span has 5 documents: positions 0-4)
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 5,  # Out of bounds (max is 4)
                        "name": "relevance",
                        "label": "oob",
                        "score": 0.5,
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert res.errors and "out of bounds" in res.errors[0].message

        # Empty/whitespace-only name is rejected
        res = await gql_client.execute(
            CREATE_MUTATION,
            {
                "input": [
                    {
                        "spanId": span_gid,
                        "documentPosition": 0,
                        "name": "   ",  # Whitespace-only name
                        "label": "test",
                        "score": 0.5,
                        "annotatorKind": AnnotatorKind.LLM.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert res.errors and "name cannot be empty" in res.errors[0].message

        # === PATCH ===

        # Patch updates fields
        res = await gql_client.execute(
            PATCH_MUTATION,
            {
                "input": [
                    {
                        "annotationId": ann1_id,
                        "name": "patched_name",
                        "label": "patched_label",
                        "score": 0.11,
                        "explanation": "patched",
                    }
                ]
            },
        )
        assert not res.errors
        patched = res.data["patchDocumentAnnotations"]["documentAnnotations"][0]  # type: ignore
        assert patched["id"] == ann1_id
        assert patched["name"] == "patched_name"
        assert patched["label"] == "patched_label"
        assert patched["score"] == 0.11

        # Patch can set label to null
        res = await gql_client.execute(
            PATCH_MUTATION, {"input": [{"annotationId": ann1_id, "label": None}]}
        )
        assert not res.errors
        assert res.data["patchDocumentAnnotations"]["documentAnnotations"][0]["label"] is None  # type: ignore

        # UNSET behavior: omitted fields are not changed
        res = await gql_client.execute(
            PATCH_MUTATION,
            {"input": [{"annotationId": ann1_id, "score": 0.55}]},  # Only score
        )
        assert not res.errors
        patched = res.data["patchDocumentAnnotations"]["documentAnnotations"][0]  # type: ignore
        assert patched["score"] == 0.55
        assert patched["name"] == "patched_name"  # Unchanged from earlier patch
        assert patched["explanation"] == "patched"  # Unchanged from earlier patch

        # Patch nonexistent annotation fails
        fake_id = str(GlobalID("DocumentAnnotation", "99999"))
        res = await gql_client.execute(
            PATCH_MUTATION, {"input": [{"annotationId": fake_id, "label": "x"}]}
        )
        assert res.errors and "Could not find" in res.errors[0].message

        # Patch with duplicate IDs fails
        res = await gql_client.execute(
            PATCH_MUTATION,
            {
                "input": [
                    {"annotationId": ann1_id, "label": "a"},
                    {"annotationId": ann1_id, "label": "b"},
                ]
            },
        )
        assert res.errors and "Duplicate" in res.errors[0].message

        # === DELETE ===

        # Delete succeeds
        res = await gql_client.execute(
            DELETE_MUTATION, {"input": {"annotationIds": [ann1_id, ann2_id]}}
        )
        assert not res.errors
        deleted = res.data["deleteDocumentAnnotations"]["documentAnnotations"]  # type: ignore
        assert len(deleted) == 2
        assert {d["id"] for d in deleted} == {ann1_id, ann2_id}

        # Delete nonexistent fails
        fake_id = str(GlobalID("DocumentAnnotation", "99999"))
        res = await gql_client.execute(DELETE_MUTATION, {"input": {"annotationIds": [fake_id]}})
        assert res.errors and "Could not find" in res.errors[0].message

        # Delete with duplicate IDs fails
        res = await gql_client.execute(
            DELETE_MUTATION, {"input": {"annotationIds": [ann3_id, ann3_id]}}
        )
        assert res.errors and "Duplicate" in res.errors[0].message

        # Clean up remaining annotations
        res = await gql_client.execute(
            DELETE_MUTATION, {"input": {"annotationIds": [ann3_id, ann4_id, ann5_id]}}
        )
        assert not res.errors
