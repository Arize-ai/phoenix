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
        assert response.errors[0].message == (
            "The name 'note' is reserved for notes. Use the createSpanNotes mutation instead."
        )

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

    async def test_create_span_notes_on_missing_span_returns_not_found(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        mutation = """
        mutation CreateSpanNotes($input: [CreateSpanNoteInput!]!) {
          createSpanNotes(input: $input) {
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
                "input": [
                    {
                        "target": {"id": missing_span_gid},
                        "annotatorKind": "HUMAN",
                        "note": "Needs review",
                    }
                ]
            },
        )
        assert response.data is None
        assert response.errors
        assert response.errors[0].message == (
            f"Could not find spans with IDs: ['{missing_span_gid}']"
        )

    async def test_create_span_notes_uses_uuidv4_identifier(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        mutation = """
        mutation CreateSpanNotes($input: [CreateSpanNoteInput!]!) {
          createSpanNotes(input: $input) {
            spanAnnotations {
              id
            }
          }
        }
        """
        response = await gql_client.execute(
            mutation,
            {
                "input": [
                    {
                        "target": {"id": str(GlobalID("Span", "1"))},
                        "annotatorKind": "HUMAN",
                        "note": "Needs review",
                    }
                ]
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


class TestSpanNoteMutations:
    _CREATE_NOTES = """
    mutation CreateSpanNotes($input: [CreateSpanNoteInput!]!) {
      createSpanNotes(input: $input) {
        spanAnnotations {
          id
          name
          label
          score
          explanation
          annotatorKind
          metadata
          identifier
          source
        }
      }
    }
    """
    _DELETE_NOTES = """
    mutation DeleteSpanNotes($input: DeleteAnnotationsInput!) {
      deleteSpanNotes(input: $input) {
        spanAnnotations { id name }
      }
    }
    """
    _PATCH_ANNOTATIONS = """
    mutation PatchSpanAnnotations($input: [PatchAnnotationInput!]!) {
      patchSpanAnnotations(input: $input) {
        spanAnnotations { id name explanation }
      }
    }
    """
    _DELETE_ANNOTATIONS = """
    mutation DeleteSpanAnnotations($input: DeleteAnnotationsInput!) {
      deleteSpanAnnotations(input: $input) {
        spanAnnotations { id name }
      }
    }
    """

    @pytest.mark.parametrize("annotator_kind", ["HUMAN", "LLM", "CODE"])
    async def test_create_by_node_and_otel_id_preserves_note_semantics(
        self,
        annotator_kind: str,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        async with db() as session:
            spans_by_id = {
                span.span_id: span
                for span in await session.scalars(
                    select(models.Span).where(models.Span.span_id.in_(("span1", "span2")))
                )
            }
        first_span = spans_by_id.get("span1")
        second_span = spans_by_id.get("span2")
        assert first_span is not None
        assert second_span is not None

        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"id": str(GlobalID("Span", str(first_span.id)))},
                        "annotatorKind": annotator_kind,
                        "note": " node note ",
                    },
                    {
                        "target": {"otelId": "span2"},
                        "annotatorKind": annotator_kind,
                        "note": "OTel note",
                        "identifier": " coding ",
                    },
                ]
            },
        )

        assert result.data is not None
        assert not result.errors
        notes = result.data["createSpanNotes"]["spanAnnotations"]
        assert [note["explanation"] for note in notes] == ["node note", "OTel note"]
        assert all(note["name"] == "note" for note in notes)
        assert all(note["label"] is None for note in notes)
        assert all(note["score"] is None for note in notes)
        assert all(note["annotatorKind"] == annotator_kind for note in notes)
        assert all(note["metadata"] == {} for note in notes)
        assert all(note["source"] == "APP" for note in notes)
        assert notes[0]["identifier"].startswith("px-span-note:")
        assert notes[1]["identifier"] == "coding"

        async with db() as session:
            stored_notes = list(
                await session.scalars(
                    select(models.SpanAnnotation)
                    .where(models.SpanAnnotation.name == "note")
                    .order_by(models.SpanAnnotation.id)
                )
            )
        assert [note.span_rowid for note in stored_notes] == [first_span.id, second_span.id]
        assert all(note.user_id is None for note in stored_notes)
        assert all(note.annotator_kind == annotator_kind for note in stored_notes)

    async def test_batch_preserves_order_and_returns_final_state_for_duplicate_keys(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        async with db() as session:
            span = await session.scalar(select(models.Span).where(models.Span.span_id == "span1"))
        assert span is not None
        node_id = str(GlobalID("Span", str(span.id)))
        external_id = "span1"
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"id": node_id},
                        "annotatorKind": "HUMAN",
                        "note": "draft",
                        "identifier": "coding",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "note": "anonymous first",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "note": "other",
                        "identifier": "other",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "note": "final",
                        "identifier": " coding ",
                    },
                    {
                        "target": {"id": node_id},
                        "annotatorKind": "HUMAN",
                        "note": "anonymous second",
                        "identifier": "  ",
                    },
                ]
            },
        )

        assert result.data is not None
        assert not result.errors
        notes = result.data["createSpanNotes"]["spanAnnotations"]
        assert [note["explanation"] for note in notes] == [
            "final",
            "anonymous first",
            "other",
            "final",
            "anonymous second",
        ]
        assert notes[0]["id"] == notes[3]["id"]
        assert len({note["id"] for note in notes}) == 4

    async def test_create_accumulates_without_identifier_and_upserts_with_identifier(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        first = await gql_client.execute(
            self._CREATE_NOTES,
            {"input": [{"target": {"otelId": "span1"}, "annotatorKind": "HUMAN", "note": "first"}]},
        )
        second = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {"target": {"otelId": "span1"}, "annotatorKind": "HUMAN", "note": "second"}
                ]
            },
        )
        upserted_first = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": "span1"},
                        "annotatorKind": "HUMAN",
                        "note": "draft",
                        "identifier": "coding",
                    }
                ]
            },
        )
        upserted_second = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": "span1"},
                        "annotatorKind": "LLM",
                        "note": "final",
                        "identifier": "coding",
                    }
                ]
            },
        )

        for result in (first, second, upserted_first, upserted_second):
            assert result.data is not None
            assert not result.errors
        assert first.data is not None
        assert second.data is not None
        assert upserted_first.data is not None
        assert upserted_second.data is not None
        assert (
            first.data["createSpanNotes"]["spanAnnotations"][0]["id"]
            != second.data["createSpanNotes"]["spanAnnotations"][0]["id"]
        )
        assert (
            upserted_first.data["createSpanNotes"]["spanAnnotations"][0]["id"]
            == upserted_second.data["createSpanNotes"]["spanAnnotations"][0]["id"]
        )
        assert (
            upserted_second.data["createSpanNotes"]["spanAnnotations"][0]["explanation"] == "final"
        )

        async with db() as session:
            notes = list(
                await session.scalars(
                    select(models.SpanAnnotation).where(models.SpanAnnotation.name == "note")
                )
            )
        assert len(notes) == 3
        assert [note.explanation for note in notes if note.identifier == "coding"] == ["final"]
        assert [note.annotator_kind for note in notes if note.identifier == "coding"] == ["LLM"]

    @pytest.mark.parametrize(
        "target, expected_message",
        [
            pytest.param({"otelId": "missing-span"}, "Could not find spans", id="missing-otel-id"),
            pytest.param(
                {"id": str(GlobalID("Span", "404"))}, "Could not find spans", id="missing-node-id"
            ),
            pytest.param(
                {"id": str(GlobalID("Trace", "1"))},
                "instead corresponds to a node of type: Trace",
                id="wrong-node-type",
            ),
        ],
    )
    async def test_create_rejects_invalid_target(
        self,
        gql_client: AsyncGraphQLClient,
        target: dict[str, str],
        expected_message: str,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {"input": [{"target": target, "annotatorKind": "HUMAN", "note": "review"}]},
        )

        assert result.data is None
        assert result.errors
        assert expected_message in result.errors[0].message

    async def test_create_rejects_blank_note(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {"input": [{"target": {"otelId": "span1"}, "annotatorKind": "HUMAN", "note": "  \n "}]},
        )

        assert result.data is None
        assert result.errors
        assert result.errors[0].message == "Note cannot be empty."

    async def test_delete_is_note_scoped_and_rolls_back_partial_failure(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        note_result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": "span1"},
                        "annotatorKind": "HUMAN",
                        "note": "keep until valid delete",
                    }
                ]
            },
        )
        assert note_result.data is not None
        assert not note_result.errors
        note_id = note_result.data["createSpanNotes"]["spanAnnotations"][0]["id"]

        structured_result = await gql_client.execute(
            TestSpanAnnotationMutations.CREATE_SPAN_ANNOTATIONS_MUTATION,
            {
                "input": [
                    {
                        "spanId": str(GlobalID("Span", "1")),
                        "name": "quality",
                        "label": "good",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "source": "APP",
                    }
                ]
            },
        )
        assert structured_result.data is not None
        assert not structured_result.errors
        structured_id = structured_result.data["createSpanAnnotations"]["spanAnnotations"][0]["id"]

        mixed_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id, structured_id]}},
        )
        assert mixed_delete.data is None
        assert mixed_delete.errors
        assert "Use the deleteSpanAnnotations mutation instead." in mixed_delete.errors[0].message

        duplicate_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id, note_id]}},
        )
        assert duplicate_delete.data is None
        assert duplicate_delete.errors
        assert "Duplicate span annotation ID" in duplicate_delete.errors[0].message

        missing_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [str(GlobalID("SpanAnnotation", "999999"))]}},
        )
        assert missing_delete.data is None
        assert missing_delete.errors
        assert "Could not find span annotations" in missing_delete.errors[0].message

        async with db() as session:
            stored_note_id = int(GlobalID.from_id(note_id).node_id)
            assert await session.get(models.SpanAnnotation, stored_note_id) is not None

        successful_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id]}},
        )
        assert successful_delete.data is not None
        assert not successful_delete.errors
        assert successful_delete.data["deleteSpanNotes"]["spanAnnotations"][0]["id"] == note_id

    async def test_generic_patch_and_delete_refuse_notes(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        note_result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {"target": {"otelId": "span1"}, "annotatorKind": "HUMAN", "note": "protected"}
                ]
            },
        )
        assert note_result.data is not None
        assert not note_result.errors
        note_id = note_result.data["createSpanNotes"]["spanAnnotations"][0]["id"]

        patch_note = await gql_client.execute(
            self._PATCH_ANNOTATIONS,
            {"input": [{"annotationId": note_id, "explanation": "changed"}]},
        )
        assert patch_note.data is None
        assert patch_note.errors
        assert patch_note.errors[0].message.endswith("createSpanNotes mutation instead.")

        generic_delete = await gql_client.execute(
            self._DELETE_ANNOTATIONS,
            {"input": {"annotationIds": [note_id]}},
        )
        assert generic_delete.data is None
        assert generic_delete.errors
        assert generic_delete.errors[0].message.endswith("deleteSpanNotes mutation instead.")

        structured_result = await gql_client.execute(
            TestSpanAnnotationMutations.CREATE_SPAN_ANNOTATIONS_MUTATION,
            {
                "input": [
                    {
                        "spanId": str(GlobalID("Span", "1")),
                        "name": "quality",
                        "label": "good",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "source": "APP",
                    }
                ]
            },
        )
        assert structured_result.data is not None
        structured_id = structured_result.data["createSpanAnnotations"]["spanAnnotations"][0]["id"]
        rename_to_note = await gql_client.execute(
            self._PATCH_ANNOTATIONS,
            {"input": [{"annotationId": structured_id, "name": "note"}]},
        )
        assert rename_to_note.data is None
        assert rename_to_note.errors
        assert rename_to_note.errors[0].message.endswith("createSpanNotes mutation instead.")
