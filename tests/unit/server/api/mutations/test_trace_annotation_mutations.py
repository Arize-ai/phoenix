import datetime
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import select
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
            self.QUERY, {"input": [create_input]}, operation_name="CreateTraceAnnotations"
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
            self.QUERY, {"input": [base_with_id]}, operation_name="CreateTraceAnnotations"
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
            self.QUERY, {"input": [updated_with_id]}, operation_name="CreateTraceAnnotations"
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
            self.QUERY, {"input": [updated_no_id]}, operation_name="CreateTraceAnnotations"
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

    async def test_trace_annotations_reject_reserved_note_name(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))
        response = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "traceId": trace_gid,
                        "name": "note",
                        "explanation": "This should fail",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )

        assert response.data is None
        assert response.errors
        assert response.errors[0].message == (
            "The name 'note' is reserved for notes. Use the createTraceNotes mutation instead."
        )

    async def test_create_trace_annotations_on_missing_trace_returns_not_found(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        missing_trace_gid = str(GlobalID("Trace", "2003"))
        response = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "traceId": missing_trace_gid,
                        "name": "test_annotation",
                        "label": "LABEL1",
                        "score": 0.5,
                        "explanation": "x",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )
        assert response.data is None
        assert response.errors
        assert (
            f"Could not find traces with IDs: ['{missing_trace_gid}']" in response.errors[0].message
        )


class TestTraceNoteMutations:
    _CREATE_NOTES = """
    mutation CreateTraceNotes($input: [CreateTraceNoteInput!]!) {
      createTraceNotes(input: $input) {
        traceAnnotations {
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
    mutation DeleteTraceNotes($input: DeleteAnnotationsInput!) {
      deleteTraceNotes(input: $input) {
        traceAnnotations { id name }
      }
    }
    """
    _PATCH_ANNOTATIONS = """
    mutation PatchTraceAnnotations($input: [PatchAnnotationInput!]!) {
      patchTraceAnnotations(input: $input) {
        traceAnnotations { id name explanation }
      }
    }
    """
    _DELETE_ANNOTATIONS = """
    mutation DeleteTraceAnnotations($input: DeleteAnnotationsInput!) {
      deleteTraceAnnotations(input: $input) {
        traceAnnotations { id name }
      }
    }
    """

    @pytest.mark.parametrize("annotator_kind", ["HUMAN", "LLM", "CODE"])
    @pytest.mark.parametrize("source", ["APP", "API"])
    async def test_create_by_node_and_otel_id_preserves_note_semantics(
        self,
        source: str,
        annotator_kind: str,
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"id": str(GlobalID("Trace", str(_trace_data.id)))},
                        "annotatorKind": annotator_kind,
                        "source": source,
                        "note": " node note ",
                    },
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": annotator_kind,
                        "source": source,
                        "note": "OTel note",
                        "identifier": " coding ",
                    },
                ]
            },
        )

        assert result.data is not None
        assert not result.errors
        notes = result.data["createTraceNotes"]["traceAnnotations"]
        assert [note["explanation"] for note in notes] == ["node note", "OTel note"]
        assert all(note["name"] == "note" for note in notes)
        assert all(note["label"] is None for note in notes)
        assert all(note["score"] is None for note in notes)
        assert all(note["annotatorKind"] == annotator_kind for note in notes)
        assert all(note["metadata"] == {} for note in notes)
        assert all(note["source"] == source for note in notes)
        assert notes[0]["identifier"].startswith("px-trace-note:")
        assert notes[1]["identifier"] == "coding"

        async with db() as session:
            stored_notes = list(
                await session.scalars(
                    select(models.TraceAnnotation).where(models.TraceAnnotation.name == "note")
                )
            )
        assert len(stored_notes) == 2
        assert all(note.trace_rowid == _trace_data.id for note in stored_notes)
        assert all(note.user_id is None for note in stored_notes)
        assert all(note.source == source for note in stored_notes)
        assert all(note.annotator_kind == annotator_kind for note in stored_notes)

    async def test_batch_preserves_order_and_returns_final_state_for_duplicate_keys(
        self,
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        node_id = str(GlobalID("Trace", str(_trace_data.id)))
        external_id = _trace_data.trace_id
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"id": node_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "draft",
                        "identifier": "coding",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "anonymous first",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "other",
                        "identifier": "other",
                    },
                    {
                        "target": {"otelId": external_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "final",
                        "identifier": " coding ",
                    },
                    {
                        "target": {"id": node_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "anonymous second",
                        "identifier": "  ",
                    },
                ]
            },
        )

        assert result.data is not None
        assert not result.errors
        notes = result.data["createTraceNotes"]["traceAnnotations"]
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
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        first = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "first",
                    }
                ]
            },
        )
        second = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "second",
                    }
                ]
            },
        )
        upserted_first = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
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
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "LLM",
                        "source": "API",
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
            first.data["createTraceNotes"]["traceAnnotations"][0]["id"]
            != second.data["createTraceNotes"]["traceAnnotations"][0]["id"]
        )
        assert (
            upserted_first.data["createTraceNotes"]["traceAnnotations"][0]["id"]
            == upserted_second.data["createTraceNotes"]["traceAnnotations"][0]["id"]
        )
        assert (
            upserted_second.data["createTraceNotes"]["traceAnnotations"][0]["explanation"]
            == "final"
        )

        async with db() as session:
            notes = list(
                await session.scalars(
                    select(models.TraceAnnotation).where(models.TraceAnnotation.name == "note")
                )
            )
        assert len(notes) == 3
        assert [note.explanation for note in notes if note.identifier == "coding"] == ["final"]
        assert [note.annotator_kind for note in notes if note.identifier == "coding"] == ["LLM"]
        assert [note.source for note in notes if note.identifier == "coding"] == ["API"]

    @pytest.mark.parametrize(
        "target, expected_message",
        [
            pytest.param(
                {"otelId": "missing-trace"}, "Could not find traces", id="missing-otel-id"
            ),
            pytest.param(
                {"id": str(GlobalID("Trace", "404"))}, "Could not find traces", id="missing-node-id"
            ),
            pytest.param(
                {"id": str(GlobalID("Span", "1"))},
                "instead corresponds to a node of type: Span",
                id="wrong-node-type",
            ),
        ],
    )
    async def test_create_rejects_invalid_target(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
        target: dict[str, str],
        expected_message: str,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {"target": target, "annotatorKind": "HUMAN", "source": "APP", "note": "review"}
                ]
            },
        )

        assert result.data is None
        assert result.errors
        assert expected_message in result.errors[0].message

    async def test_create_rejects_blank_note(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": " \t ",
                    }
                ]
            },
        )

        assert result.data is None
        assert result.errors
        assert result.errors[0].message == "Note cannot be empty."

    async def test_delete_is_note_scoped_and_rolls_back_partial_failure(
        self,
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        note_result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "keep until valid delete",
                    }
                ]
            },
        )
        assert note_result.data is not None
        assert not note_result.errors
        note_id = note_result.data["createTraceNotes"]["traceAnnotations"][0]["id"]

        structured_result = await gql_client.execute(
            TestTraceAnnotationMutations.QUERY,
            {
                "input": [
                    {
                        "traceId": str(GlobalID("Trace", str(_trace_data.id))),
                        "name": "quality",
                        "label": "good",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "source": "APP",
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )
        assert structured_result.data is not None
        assert not structured_result.errors
        structured_id = structured_result.data["createTraceAnnotations"]["traceAnnotations"][0][
            "id"
        ]

        mixed_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id, structured_id]}},
        )
        assert mixed_delete.data is None
        assert mixed_delete.errors
        assert "Use the deleteTraceAnnotations mutation instead." in mixed_delete.errors[0].message

        duplicate_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id, note_id]}},
        )
        assert duplicate_delete.data is None
        assert duplicate_delete.errors
        assert "Duplicate trace annotation ID" in duplicate_delete.errors[0].message

        missing_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [str(GlobalID("TraceAnnotation", "999999"))]}},
        )
        assert missing_delete.data is None
        assert missing_delete.errors
        assert "Could not find trace annotations" in missing_delete.errors[0].message

        async with db() as session:
            stored_note_id = int(GlobalID.from_id(note_id).node_id)
            assert await session.get(models.TraceAnnotation, stored_note_id) is not None

        successful_delete = await gql_client.execute(
            self._DELETE_NOTES,
            {"input": {"annotationIds": [note_id]}},
        )
        assert successful_delete.data is not None
        assert not successful_delete.errors
        assert successful_delete.data["deleteTraceNotes"]["traceAnnotations"][0]["id"] == note_id

    async def test_generic_patch_and_delete_refuse_notes(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        note_result = await gql_client.execute(
            self._CREATE_NOTES,
            {
                "input": [
                    {
                        "target": {"otelId": _trace_data.trace_id},
                        "annotatorKind": "HUMAN",
                        "source": "APP",
                        "note": "protected",
                    }
                ]
            },
        )
        assert note_result.data is not None
        assert not note_result.errors
        note_id = note_result.data["createTraceNotes"]["traceAnnotations"][0]["id"]

        patch_note = await gql_client.execute(
            self._PATCH_ANNOTATIONS,
            {"input": [{"annotationId": note_id, "explanation": "changed"}]},
        )
        assert patch_note.data is None
        assert patch_note.errors
        assert patch_note.errors[0].message.endswith("createTraceNotes mutation instead.")

        generic_delete = await gql_client.execute(
            self._DELETE_ANNOTATIONS,
            {"input": {"annotationIds": [note_id]}},
        )
        assert generic_delete.data is None
        assert generic_delete.errors
        assert generic_delete.errors[0].message.endswith("deleteTraceNotes mutation instead.")

        structured_result = await gql_client.execute(
            TestTraceAnnotationMutations.QUERY,
            {
                "input": [
                    {
                        "traceId": str(GlobalID("Trace", str(_trace_data.id))),
                        "name": "quality",
                        "label": "good",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "source": "APP",
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )
        assert structured_result.data is not None
        structured_id = structured_result.data["createTraceAnnotations"]["traceAnnotations"][0][
            "id"
        ]
        rename_to_note = await gql_client.execute(
            self._PATCH_ANNOTATIONS,
            {"input": [{"annotationId": structured_id, "name": "note"}]},
        )
        assert rename_to_note.data is None
        assert rename_to_note.errors
        assert rename_to_note.errors[0].message.endswith("createTraceNotes mutation instead.")
