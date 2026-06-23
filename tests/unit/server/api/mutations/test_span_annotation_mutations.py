import datetime
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import select
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

        # create two spans for tests (rowid=1 and rowid=2)
        span1 = models.Span(
            trace_rowid=trace.id,
            span_id="span1",
            name="span1",
            span_kind="internal",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span1)

        span2 = models.Span(
            trace_rowid=trace.id,
            span_id="span2",
            name="span2",
            span_kind="internal",
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
            attributes={},
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span2)

        await session.commit()


class TestSpanAnnotationMutations:
    CREATE_SPAN_ANNOTATIONS_MUTATION = """
    mutation CreateSpanAnnotations($input: [CreateSpanAnnotationInput!]!) {
      createSpanAnnotations(input: $input) {
        spanAnnotations {
          id
          name
          label
          score
          explanation
          identifier
        }
      }
    }
    """

    @pytest.mark.parametrize(
        "variables",
        [
            pytest.param(
                {
                    "input": [
                        {
                            "spanId": str(GlobalID("Span", "1")),
                            "name": "test_annotation",
                            "label": "LABEL1",
                            "score": 0.75,
                            "explanation": "Initial explanation",
                            "annotatorKind": AnnotatorKind.HUMAN.name,
                            "metadata": {},
                            "identifier": "",
                            "source": AnnotationSource.API.name,
                        }
                    ]
                },
                id="create-basic",
            ),
        ],
    )
    async def test_create_new_annotation_succeeds(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        variables: dict[str, Any],
    ) -> None:
        result = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables)
        assert not result.errors
        assert result.data is not None
        data = result.data["createSpanAnnotations"]["spanAnnotations"][0]
        expected = variables["input"][0]
        assert data["name"] == expected["name"]
        assert data["label"] == expected["label"]
        assert data["score"] == expected["score"]
        assert data["explanation"] == expected["explanation"]
        assert data["identifier"] == ""
        assert isinstance(data["id"], str)

    async def test_upsert_on_conflict_updates_existing(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Initial creation
        span_gid = str(GlobalID("Span", "2"))
        base_input = {
            "spanId": span_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": AnnotatorKind.HUMAN.name,
            "metadata": {},
            "identifier": "conflict",
            "source": AnnotationSource.APP.name,
        }
        variables1 = {"input": [base_input]}
        res1 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables1)
        assert not res1.errors
        ann1 = res1.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id1 = ann1["id"]

        # Upsert with updated fields
        updated_input = base_input.copy()
        updated_input.update(
            {
                "label": "UPDATED_LABEL",
                "score": 2.0,
                "explanation": "Updated explanation",
            }
        )
        variables2 = {"input": [updated_input]}
        res2 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables2)
        assert not res2.errors
        ann2 = res2.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id2 = ann2["id"]

        # IDs should match and values updated
        assert id1 == id2
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"

    async def test_upsert_on_conflict_updates_existing_with_no_identifier(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Initial creation
        span_gid = str(GlobalID("Span", "2"))
        base_input = {
            "spanId": span_gid,
            "name": "conflict_test",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": AnnotatorKind.HUMAN.name,
            "metadata": {},
            "identifier": "",
            "source": AnnotationSource.APP.name,
        }
        variables1 = {"input": [base_input]}
        res1 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables1)
        assert not res1.errors
        ann1 = res1.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id1 = ann1["id"]

        # Upsert with updated fields
        updated_input = base_input.copy()
        updated_input.update(
            {
                "label": "UPDATED_LABEL",
                "score": 2.0,
                "explanation": "Updated explanation",
            }
        )
        variables2 = {"input": [updated_input]}
        res2 = await gql_client.execute(self.CREATE_SPAN_ANNOTATIONS_MUTATION, variables2)
        assert not res2.errors
        ann2 = res2.data["createSpanAnnotations"]["spanAnnotations"][0]  # type: ignore
        id2 = ann2["id"]

        # IDs should match and values updated
        assert id1 == id2
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"

    async def test_create_span_annotations_rejects_reserved_note_name(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        response = await gql_client.execute(
            self.CREATE_SPAN_ANNOTATIONS_MUTATION,
            {
                "input": [
                    {
                        "spanId": str(GlobalID("Span", "1")),
                        "name": "note",
                        "explanation": "This should fail",
                        "annotatorKind": AnnotatorKind.HUMAN.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )

        assert response.data is None
        assert response.errors
        assert (
            "The name 'note' is reserved for trace and span notes. "
            "Use the createSpanNote mutation or POST /v1/span_notes instead."
        ) in response.errors[0].message

    async def test_create_span_annotations_on_missing_span_returns_not_found(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        missing_span_gid = str(GlobalID("Span", "104"))
        response = await gql_client.execute(
            self.CREATE_SPAN_ANNOTATIONS_MUTATION,
            {
                "input": [
                    {
                        "spanId": missing_span_gid,
                        "name": "test_annotation",
                        "label": "LABEL1",
                        "score": 0.75,
                        "explanation": "Initial explanation",
                        "annotatorKind": AnnotatorKind.HUMAN.name,
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
        )
        assert response.data is None
        assert response.errors
        assert (
            f"Could not find spans with IDs: ['{missing_span_gid}']" in response.errors[0].message
        )

    async def test_create_span_note_on_missing_span_returns_not_found(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        mutation = """
        mutation CreateSpanNote($annotationInput: CreateSpanNoteInput!) {
          createSpanNote(annotationInput: $annotationInput) {
            spanAnnotations {
              id
            }
          }
        }
        """
        missing_span_gid = str(GlobalID("Span", "104"))
        response = await gql_client.execute(
            mutation,
            {
                "annotationInput": {
                    "spanId": missing_span_gid,
                    "note": "Needs review",
                }
            },
        )
        assert response.data is None
        assert response.errors
        assert f"Could not find span with ID: {missing_span_gid}" in response.errors[0].message

    async def test_create_span_note_uses_uuidv4_identifier(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        mutation = """
        mutation CreateSpanNote($annotationInput: CreateSpanNoteInput!) {
          createSpanNote(annotationInput: $annotationInput) {
            spanAnnotations {
              id
            }
          }
        }
        """
        response = await gql_client.execute(
            mutation,
            {
                "annotationInput": {
                    "spanId": str(GlobalID("Span", "1")),
                    "note": "Needs review",
                }
            },
        )

        assert response.data is not None
        assert not response.errors

        async with db() as session:
            annotation = await session.scalar(
                select(models.SpanAnnotation).where(models.SpanAnnotation.name == "note")
            )

        assert annotation is not None
        assert annotation.identifier.startswith("px-span-note:")
        assert UUID(annotation.identifier.removeprefix("px-span-note:")).version == 4
