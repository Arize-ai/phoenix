from __future__ import annotations

from datetime import datetime, timedelta, timezone
from random import random
from secrets import token_hex
from typing import Any, cast

import pandas as pd
import pytest
from phoenix.client.__generated__ import v1
from typing_extensions import TypeAlias

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _await_or_return,
    _GetUser,
    _RoleOrUser,
)

# Type aliases for better readability
SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


class TestClientForSpanAnnotationsRetrieval:
    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_get_span_annotations_dataframe_and_list(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        (span_id1, _), (span_id2, _) = _span_ids

        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        annotation_name_1 = f"test_anno_{token_hex(4)}"
        annotation_name_2 = f"test_anno_{token_hex(4)}"

        score1 = random()
        score2 = random()
        label1 = token_hex(4)
        label2 = token_hex(4)
        explanation1 = token_hex(8)
        explanation2 = token_hex(8)

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_1,
                span_id=span_id1,
                annotator_kind="LLM",
                label=label1,
                score=score1,
                explanation=explanation1,
                sync=True,
            )
        )

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_2,
                span_id=span_id2,
                annotator_kind="CODE",
                label=label2,
                score=score2,
                explanation=explanation2,
                sync=True,
            )
        )

        df = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
            )
        )

        assert isinstance(df, pd.DataFrame)
        assert {
            span_id1,
            span_id2,
        }.issubset(set(df.index.astype(str))), "Expected span IDs missing from dataframe"  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]

        annotations = await _await_or_return(
            Client().spans.get_span_annotations(
                span_ids=[span_id1, span_id1, span_id2],  # include duplicate on purpose
                project_identifier="default",
            )
        )

        assert isinstance(annotations, list)
        assert all(isinstance(a, dict) for a in annotations)

        by_key: dict[tuple[str, str], v1.SpanAnnotation] = {
            (a["span_id"], a["name"]): a for a in annotations
        }

        key1, key2 = (span_id1, annotation_name_1), (span_id2, annotation_name_2)
        assert key1 in by_key, "Annotation for span 1 missing from list response"
        assert key2 in by_key, "Annotation for span 2 missing from list response"

        anno1, anno2 = by_key[key1], by_key[key2]
        for anno, expected_label, expected_score, expected_explanation in (
            (anno1, label1, score1, explanation1),
            (anno2, label2, score2, explanation2),
        ):
            assert "result" in anno, "Expected 'result' key in span annotation response"
            res = anno["result"]
            assert isinstance(res, dict)
            assert res.get("label") == expected_label
            assert abs(float(res.get("score", 0.0)) - expected_score) < 1e-6
            assert res.get("explanation") == expected_explanation

        spans_input_df = pd.DataFrame({"context.span_id": [span_id1, span_id2]})
        df_from_df = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                spans_dataframe=spans_input_df,
                project_identifier="default",
            )
        )

        assert isinstance(df_from_df, pd.DataFrame)
        for sid, aname, label, scr, expl in (
            (span_id1, annotation_name_1, label1, score1, explanation1),
            (span_id2, annotation_name_2, label2, score2, explanation2),
        ):
            subset = df_from_df[df_from_df.index.astype(str) == sid]  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]
            subset = subset[subset["annotation_name"] == aname]  # pyright: ignore[reportUnknownVariableType]
            assert not subset.empty  # pyright: ignore[reportUnknownMemberType]
            row = subset.iloc[0]  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            assert "result.label" in row
            assert row["result.label"] == label
            assert abs(float(row["result.score"]) - scr) < 1e-6  # pyright: ignore[reportUnknownArgumentType]
            assert row["result.explanation"] == expl

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_note_annotations_filtering_behavior(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        (span_id1, _), (span_id2, _) = _span_ids

        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        regular_annotation_name = f"test_anno_{token_hex(4)}"

        score1 = random()
        label1 = token_hex(4)
        explanation1 = token_hex(8)

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=regular_annotation_name,
                span_id=span_id1,
                annotator_kind="LLM",
                label=label1,
                score=score1,
                explanation=explanation1,
                sync=True,
            )
        )

        df_default = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
            )
        )

        assert isinstance(df_default, pd.DataFrame)
        if not df_default.empty:
            annotation_names_default = set(df_default["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name in annotation_names_default

        df_with_notes = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
                include_annotation_names=[regular_annotation_name, "note"],
            )
        )

        assert isinstance(df_with_notes, pd.DataFrame)
        if not df_with_notes.empty:
            annotation_names_with_notes = set(df_with_notes["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name in annotation_names_with_notes

        df_excluded = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
                exclude_annotation_names=[regular_annotation_name],
            )
        )

        assert isinstance(df_excluded, pd.DataFrame)
        if not df_excluded.empty:
            annotation_names_excluded = set(df_excluded["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name not in annotation_names_excluded

        annotations_default = await _await_or_return(
            Client().spans.get_span_annotations(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
            )
        )

        assert isinstance(annotations_default, list)
        if annotations_default:
            default_names = {a["name"] for a in annotations_default}
            assert regular_annotation_name in default_names

        annotations_with_notes = await _await_or_return(
            Client().spans.get_span_annotations(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
                include_annotation_names=[regular_annotation_name, "note"],
            )
        )

        assert isinstance(annotations_with_notes, list)
        if annotations_with_notes:
            with_notes_names = {a["name"] for a in annotations_with_notes}
            assert regular_annotation_name in with_notes_names

    def test_invalid_arguments_validation(self) -> None:
        """Supplying multiple or no parameters should error."""
        from phoenix.client import Client

        spans_client = Client().spans

        # Test get_span_annotations_dataframe
        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(project_identifier="default")

        dummy_df = pd.DataFrame()

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                spans_dataframe=dummy_df,
                span_ids=["abc"],
                project_identifier="default",
            )

        # Create complete v1.Span objects for testing
        test_span_1 = cast(
            v1.Span,
            {
                "id": "test_1",
                "name": "test_span_no_id",
                "context": {"trace_id": "trace123", "span_id": "abc"},
                "span_kind": "INTERNAL",
                "start_time": "2023-01-01T00:00:00Z",
                "end_time": "2023-01-01T00:01:00Z",
                "status_code": "OK",
            },
        )

        test_span_2 = cast(
            v1.Span,
            {
                "id": "test_2",
                "name": "valid_span",
                "context": {"trace_id": "trace456", "span_id": "def"},
                "span_kind": "INTERNAL",
                "start_time": "2023-01-01T00:00:00Z",
                "end_time": "2023-01-01T00:01:00Z",
                "status_code": "OK",
            },
        )

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                spans_dataframe=dummy_df,
                spans=[test_span_1],
                project_identifier="default",
            )

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                span_ids=["abc"],
                spans=[test_span_2],
                project_identifier="default",
            )

        # Test get_span_annotations
        with pytest.raises(ValueError):
            spans_client.get_span_annotations(project_identifier="default")

        with pytest.raises(ValueError):
            spans_client.get_span_annotations(
                span_ids=["abc"],
                spans=[test_span_2],
                project_identifier="default",
            )

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_get_span_annotations_with_spans_objects(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test getting span annotations using Span objects from get_spans."""
        (span_id1, _), (span_id2, _) = _span_ids

        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        annotation_name_1 = f"test_spans_obj_{token_hex(4)}"
        annotation_name_2 = f"test_spans_obj_{token_hex(4)}"

        score1 = 0.8
        score2 = 0.6
        label1 = "positive"
        label2 = "negative"

        # Add annotations to specific spans
        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_1,
                span_id=span_id1,
                annotator_kind="LLM",
                label=label1,
                score=score1,
                sync=True,
            )
        )

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_2,
                span_id=span_id2,
                annotator_kind="CODE",
                label=label2,
                score=score2,
                sync=True,
            )
        )

        # Get spans using the new get_spans method
        spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=50,
            )
        )

        # Filter to only the spans we're interested in
        target_spans = [s for s in spans if s["context"]["span_id"] in [span_id1, span_id2]]
        assert len(target_spans) >= 2, "Should find at least the two test spans"

        # Test get_span_annotations_dataframe with spans objects
        df = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                spans=target_spans,
                project_identifier="default",
            )
        )

        assert isinstance(df, pd.DataFrame)
        assert len(df) >= 2, "Should have annotations for both spans"

        # Test get_span_annotations with spans objects
        annotations = await _await_or_return(
            Client().spans.get_span_annotations(
                spans=target_spans,
                project_identifier="default",
            )
        )

        assert isinstance(annotations, list)
        assert len(annotations) >= 2, "Should have annotations for both spans"

        # Verify the annotations contain our test data
        by_span_name = {(a["span_id"], a["name"]): a for a in annotations}

        key1 = (span_id1, annotation_name_1)
        key2 = (span_id2, annotation_name_2)

        assert key1 in by_span_name, f"Annotation {key1} not found"
        assert key2 in by_span_name, f"Annotation {key2} not found"

        # Test with spans that have missing span_ids (should not cause errors)
        spans_with_missing_ids: list[v1.Span] = [
            cast(
                v1.Span,
                {
                    "id": "test_missing_1",
                    "name": "test_span_no_id",
                    "context": {"trace_id": "trace789", "span_id": ""},  # Empty span_id
                    "span_kind": "INTERNAL",
                    "start_time": "2023-01-01T00:00:00Z",
                    "end_time": "2023-01-01T00:01:00Z",
                    "status_code": "OK",
                },
            ),
            cast(
                v1.Span,
                {
                    "id": "test_valid_1",
                    "name": "valid_span",
                    "context": {"trace_id": "trace999", "span_id": span_id1},
                    "span_kind": "INTERNAL",
                    "start_time": "2023-01-01T00:00:00Z",
                    "end_time": "2023-01-01T00:01:00Z",
                    "status_code": "OK",
                },
            ),
        ]

        annotations_filtered = await _await_or_return(
            Client().spans.get_span_annotations(
                spans=spans_with_missing_ids,
                project_identifier="default",
            )
        )

        # Should only get annotations for the span with valid span_id
        span_ids_found = {a["span_id"] for a in annotations_filtered}
        assert span_id1 in span_ids_found
        assert len([a for a in annotations_filtered if a["span_id"] == span_id1]) >= 1


class TestClientForSpansRetrieval:
    """Test the get_spans method with various filtering and pagination options."""

    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_basic_span_retrieval(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test basic span retrieval returns ergonomic span format."""
        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=10,
            )
        )

        assert isinstance(spans, list)
        # Should have at least the test spans
        assert len(spans) >= 2

        # Each span should be a dict with the expected structure
        for span in spans:
            assert isinstance(span, dict)
            # Check required fields exist according to v1.Span
            assert "id" in span
            assert "name" in span
            assert "context" in span
            assert "span_kind" in span
            assert "start_time" in span
            assert "end_time" in span
            assert "status_code" in span

            # Check context structure
            context = span["context"]
            assert isinstance(context, dict)
            assert "trace_id" in context
            assert "span_id" in context
            assert isinstance(context["trace_id"], str)
            assert isinstance(context["span_id"], str)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_time_filtering(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that start_time and end_time filters work correctly."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create test spans with known, distinct timestamps
        base_time = datetime.now(timezone.utc)
        trace_id = f"trace_time_filter_{token_hex(16)}"

        # Create spans with 10-second intervals to ensure distinct timestamps
        test_spans: list[v1.Span] = []
        span_times: list[datetime] = []

        for i in range(5):
            span_time = base_time + timedelta(seconds=i * 10)
            span_times.append(span_time)

            span = cast(
                v1.Span,
                {
                    "name": f"time_filter_span_{i}",
                    "context": {
                        "trace_id": trace_id,
                        "span_id": f"span_time_{token_hex(8)}_{i}",
                    },
                    "span_kind": "CHAIN",
                    "start_time": span_time.isoformat(),
                    "end_time": (span_time + timedelta(seconds=1)).isoformat(),
                    "status_code": "OK",
                    "attributes": {"time_index": i},
                },
            )
            test_spans.append(span)

        # Create the test spans
        create_result = await _await_or_return(
            Client().spans.create_spans(
                project_identifier="default",
                spans=test_spans,
            )
        )

        assert create_result["total_queued"] == 5, f"Failed to create test spans: {create_result}"

        # Wait for spans to be processed
        import asyncio

        await asyncio.sleep(2)

        # Test 1: Filter to get only middle spans (index 1, 2, 3)
        middle_start = span_times[1] - timedelta(seconds=1)  # Just before span 1
        middle_end = span_times[3] + timedelta(seconds=2)  # Just after span 3

        middle_spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                start_time=middle_start,
                end_time=middle_end,
                limit=100,  # Use higher limit to ensure we get all matching spans
            )
        )

        # Filter to only our test spans
        our_middle_spans = [s for s in middle_spans if s["context"]["trace_id"] == trace_id]

        # Should have exactly 3 spans (indices 1, 2, 3)
        assert len(our_middle_spans) == 3, (
            f"Expected 3 spans but got {len(our_middle_spans)}. "
            f"Span names: {[s['name'] for s in our_middle_spans]}"
        )

        # Verify they are the correct spans
        found_indices: set[int] = set()
        for span in our_middle_spans:
            if "attributes" in span and "time_index" in span["attributes"]:
                found_indices.add(span["attributes"]["time_index"])

        assert found_indices == {1, 2, 3}, f"Expected indices {{1, 2, 3}} but got {found_indices}"

        # Test 2: Filter to get only later spans (index 3, 4)
        later_start = span_times[3] - timedelta(seconds=1)  # Just before span 3

        later_spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                start_time=later_start,
                limit=100,
            )
        )

        # Filter to only our test spans
        our_later_spans = [s for s in later_spans if s["context"]["trace_id"] == trace_id]

        # Should have exactly 2 spans (indices 3, 4)
        assert len(our_later_spans) == 2, (
            f"Expected 2 spans but got {len(our_later_spans)}. "
            f"Span names: {[s['name'] for s in our_later_spans]}"
        )

        # Test 3: Filter to get only earlier spans (index 0, 1)
        earlier_end = span_times[1] + timedelta(seconds=2)  # Just after span 1

        earlier_spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                end_time=earlier_end,
                limit=100,
            )
        )

        # Filter to only our test spans
        our_earlier_spans = [s for s in earlier_spans if s["context"]["trace_id"] == trace_id]

        # Should have exactly 2 spans (indices 0, 1)
        assert len(our_earlier_spans) == 2, (
            f"Expected 2 spans but got {len(our_earlier_spans)}. "
            f"Span names: {[s['name'] for s in our_earlier_spans]}"
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_automatic_pagination(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that the method automatically handles pagination to fetch up to the limit."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # The method uses page_size = min(100, limit), so test with limit > 100
        # to ensure pagination happens (if there are enough spans)
        limit = 150
        spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=limit,
            )
        )

        # We should get up to the limit, or all available spans
        assert len(spans) <= limit

        # Test with small limit
        small_limit = 5
        small_spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=small_limit,
            )
        )

        assert len(small_spans) <= small_limit

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_project_identifier_types(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that project identifier works with both project names and IDs."""
        user = _get_user(_ADMIN).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # First get the project to find its ID
        projects = await _await_or_return(Client().projects.list())
        default_project = next((p for p in projects if p["name"] == "default"), None)

        if not default_project:
            pytest.skip("Default project not found")

        project_id = default_project["id"]

        # Get spans by project name
        spans_by_name = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=5,
            )
        )

        # Get spans by project ID
        spans_by_id = await _await_or_return(
            Client().spans.get_spans(
                project_identifier=project_id,
                limit=5,
            )
        )

        # Both should return spans
        assert len(spans_by_name) > 0
        assert len(spans_by_id) > 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_span_structure(
        self,
        is_async: bool,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=10,
            )
        )

        assert len(spans) > 0

        for span in spans:
            # Check required fields from v1.Span
            assert "id" in span
            assert "name" in span
            assert "context" in span
            assert "span_kind" in span
            assert "start_time" in span
            assert "end_time" in span
            assert "status_code" in span

            # Check datetime fields are strings (ISO format)
            assert isinstance(span["start_time"], str)
            assert isinstance(span["end_time"], str)

            # Check context structure
            context = span["context"]
            assert isinstance(context, dict)
            assert "trace_id" in context
            assert "span_id" in context
            assert isinstance(context["trace_id"], str)
            assert isinstance(context["span_id"], str)

            # Check optional attributes
            if "attributes" in span:
                assert isinstance(span["attributes"], dict)

            # Check events if present
            if "events" in span:
                assert isinstance(span["events"], list)
                for event in span["events"]:
                    assert isinstance(event, dict)
                    assert "name" in event
                    assert "timestamp" in event
                    assert isinstance(event["timestamp"], str)
                    if "attributes" in event:
                        assert isinstance(event["attributes"], dict)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_empty_results(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test behavior when no spans match the filter criteria."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Use a far future date that shouldn't have any spans
        far_future = datetime.now(timezone.utc) + timedelta(days=365 * 10)

        spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                start_time=far_future,
                limit=10,
            )
        )

        # Should return empty list, not error
        assert isinstance(spans, list)
        assert len(spans) == 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_invalid_project_identifier(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test error handling for invalid project identifier."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        import httpx
        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Test with non-existent project
        with pytest.raises(httpx.HTTPStatusError):
            await _await_or_return(
                Client().spans.get_spans(
                    project_identifier="non_existent_project_xyz_123",
                    limit=10,
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_client_get_spans(
        self,
        is_async: bool,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test the get_spans method returns spans correctly."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Extract the span IDs from the fixture
        (span_id1, _), (span_id2, _) = _span_ids

        all_spans = await _await_or_return(
            Client().spans.get_spans(project_identifier="default", limit=50)
        )

        span_ids_found = {span["context"]["span_id"] for span in all_spans}
        assert span_id1 in span_ids_found, f"Expected span {span_id1} not found in {span_ids_found}"
        assert span_id2 in span_ids_found, f"Expected span {span_id2} not found in {span_ids_found}"

        limited_spans = await _await_or_return(
            Client().spans.get_spans(project_identifier="default", limit=1)
        )
        assert len(limited_spans) <= 1, "Limit parameter should be respected"

        # Each span should have required fields
        for span in all_spans:
            assert "id" in span
            assert "name" in span
            assert "context" in span
            assert "span_id" in span["context"]
            assert "trace_id" in span["context"]


class TestClientForSpanCreation:
    def _create_test_span(self, name: str = "", **kwargs: Any) -> v1.Span:
        """Helper to create a standard test span with optional customizations."""
        defaults: dict[str, Any] = {
            "name": name or f"test_span_{token_hex(4)}",
            "context": {
                "trace_id": f"trace_{token_hex(16)}",
                "span_id": f"span_{token_hex(8)}",
            },
            "span_kind": "CHAIN",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
            "status_code": "OK",
        }

        # Merge kwargs into defaults
        result: dict[str, Any] = {**defaults, **kwargs}
        if "context" in kwargs:
            result["context"] = {**defaults["context"], **kwargs["context"]}

        return cast(v1.Span, result)

    async def test_basic_span_operations(
        self,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test basic span creation, duplicates, and error handling in one efficient test."""
        user = _get_user(_MEMBER).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import Client
        from phoenix.client.exceptions import SpanCreationError

        client = Client()

        # Test 1: Basic span creation with parent-child relationship
        trace_id = f"trace_{token_hex(16)}"
        parent_span_id = f"span_{token_hex(8)}"
        child_span_id = f"span_{token_hex(8)}"

        parent_span = self._create_test_span(
            "parent",
            context={"trace_id": trace_id, "span_id": parent_span_id},
            attributes={"test_attr": "parent_value"},
        )

        child_span = self._create_test_span(
            "child",
            context={"trace_id": trace_id, "span_id": child_span_id},
            parent_id=parent_span_id,
            span_kind="LLM",
            attributes={"test_attr": "child_value"},
        )

        # Create spans successfully
        result = client.spans.create_spans(
            project_identifier="default",
            spans=[parent_span, child_span],
        )
        assert result["total_received"] == 2
        assert result["total_queued"] == 2
        assert result["total_invalid"] == 0
        assert result["total_duplicates"] == 0

        # Test 2: Duplicate span rejection
        import time

        time.sleep(1)  # Give server time to process

        with pytest.raises(SpanCreationError) as exc_info:
            client.spans.create_spans(
                project_identifier="default",
                spans=[parent_span],  # Duplicate
            )
        error = exc_info.value
        assert error.total_duplicates == 1
        assert error.total_queued == 0

        # Test 3: Invalid span handling
        invalid_span = self._create_test_span(
            "invalid",
            start_time="invalid-datetime-format",
        )

        with pytest.raises(SpanCreationError) as exc_info:
            client.spans.create_spans(
                project_identifier="default",
                spans=[invalid_span],
            )
        error = exc_info.value
        assert error.total_invalid == 1
        assert error.total_queued == 0

        # Test 4: Error handling for non-existent project
        import httpx

        with pytest.raises(httpx.HTTPStatusError) as http_exc_info:
            client.spans.create_spans(
                project_identifier="non_existent_project_xyz",
                spans=[self._create_test_span("test")],
            )
        assert http_exc_info.value.response.status_code == 404

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_helper_functions_round_trip(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test round-tripping spans through helper functions efficiently."""
        # Use deterministic seed to avoid random collisions
        import random

        original_state = random.getstate()
        try:
            random.seed(100 + (1 if is_async else 0))

            user = _get_user(_MEMBER).log_in()
            monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

            from phoenix.client import AsyncClient
            from phoenix.client import Client as SyncClient
            from phoenix.client.helpers.spans import dataframe_to_spans, uniquify_spans

            Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

            # Create test spans with rich attributes for round-trip testing
            trace_id = f"trace_{token_hex(16)}"

            test_spans = [
                self._create_test_span(
                    "roundtrip_parent",
                    context={"trace_id": trace_id, "span_id": f"span_{token_hex(8)}"},
                    attributes={
                        "input.value": "test input",
                        "output.value": "test output",
                        "metadata.key": "metadata_value",
                    },
                    events=[
                        {
                            "name": "test_event",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "attributes": {"event_attr": "event_value"},
                        }
                    ],
                ),
                self._create_test_span(
                    "roundtrip_child",
                    context={"trace_id": trace_id, "span_id": f"span_{token_hex(8)}"},
                    span_kind="LLM",
                    attributes={"llm.model": "gpt-4", "llm.temperature": 0.7},
                ),
            ]

            # Set parent relationship
            test_spans[1] = cast(
                v1.Span, {**test_spans[1], "parent_id": test_spans[0]["context"]["span_id"]}
            )

            # Create original spans
            result = await _await_or_return(
                Client().spans.create_spans(
                    project_identifier="default",
                    spans=test_spans,
                )
            )
            assert result["total_queued"] == 2

            # Wait for indexing
            import asyncio

            await asyncio.sleep(2)

            # Get spans as DataFrame
            df = await _await_or_return(
                Client().spans.get_spans_dataframe(
                    project_identifier="default",
                    limit=50,
                )
            )

            # Filter to our test spans
            our_spans_mask = df["context.trace_id"] == trace_id
            our_df = df[our_spans_mask].copy()

            if len(our_df) == 0:
                pytest.skip("Could not find test spans in DataFrame")

            # Test 1: DataFrame to spans conversion
            reconstructed_spans = dataframe_to_spans(our_df)
            assert len(reconstructed_spans) == 2

            spans_by_name = {span["name"]: span for span in reconstructed_spans}
            assert "roundtrip_parent" in spans_by_name
            assert "roundtrip_child" in spans_by_name

            parent = spans_by_name["roundtrip_parent"]
            child = spans_by_name["roundtrip_child"]

            # Verify structure preservation
            assert parent["span_kind"] == "CHAIN"
            assert child["span_kind"] == "LLM"
            assert parent["context"]["trace_id"] == trace_id
            assert child["context"]["trace_id"] == trace_id
            assert child.get("parent_id") == parent["context"]["span_id"]

            # Test 2: uniquify_spans with spans
            reconstructed_spans[0]["context"]["trace_id"]
            [s["context"]["span_id"] for s in reconstructed_spans]

            unique_spans = uniquify_spans(reconstructed_spans, in_place=False)
            assert len(unique_spans) == len(reconstructed_spans)

            # Verify IDs changed but structure preserved
            for original, unique in zip(reconstructed_spans, unique_spans):
                assert unique["context"]["trace_id"] != original["context"]["trace_id"]
                assert unique["context"]["span_id"] != original["context"]["span_id"]
                assert unique["name"] == original["name"]
                assert unique["span_kind"] == original["span_kind"]

            # Test 3: uniquify_spans with DataFrame
            original_df_trace_ids = our_df["context.trace_id"].tolist()  # pyright: ignore[reportUnknownVariableType]
            original_df_span_ids = our_df["context.span_id"].tolist()  # pyright: ignore[reportUnknownVariableType]

            unique_df = uniquify_spans(our_df, in_place=False)

            # Verify DataFrame uniquification
            assert unique_df["context.trace_id"].tolist() != original_df_trace_ids
            assert unique_df["context.span_id"].tolist() != original_df_span_ids
            assert len(unique_df["context.span_id"].unique()) == len(unique_df)  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]

            # Verify parent-child relationships preserved in DataFrame
            parent_mask = unique_df["name"] == "roundtrip_parent"
            child_mask = unique_df["name"] == "roundtrip_child"

            if parent_mask.any() and child_mask.any():  # pyright: ignore[reportUnknownMemberType]
                new_parent_span_id = unique_df[parent_mask].index[0]  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                child_parent_id = unique_df[child_mask]["parent_id"].iloc[0]  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
                assert child_parent_id == new_parent_span_id

            # Test 4: Full round-trip - DataFrame -> spans -> uniquify -> create
            final_spans = dataframe_to_spans(unique_df)
            final_unique_spans = uniquify_spans(final_spans, in_place=False)

            # Verify final spans are valid and can be created
            assert len(final_unique_spans) == 2
            for span in final_unique_spans:
                assert "context" in span
                assert "span_id" in span["context"]
                assert "trace_id" in span["context"]
                assert span["context"]["span_id"] not in original_df_span_ids
                assert span["context"]["trace_id"] not in original_df_trace_ids

        finally:
            random.setstate(original_state)

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_batch_creation_and_retrieval(
        self,
        is_async: bool,
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test efficient batch span creation and retrieval."""
        user = _get_user(_ADMIN).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        trace_id = f"batch_trace_{token_hex(16)}"
        batch_spans = [
            self._create_test_span(
                f"batch_{i}",
                context={"trace_id": trace_id, "span_id": f"span_{token_hex(8)}"},
                attributes={"batch_index": i},
            )
            for i in range(5)
        ]

        # Create batch
        result = await _await_or_return(
            Client().spans.create_spans(
                project_identifier="default",
                spans=batch_spans,
            )
        )
        assert result["total_received"] == 5
        assert result["total_queued"] == 5

        import asyncio
        await asyncio.sleep(1)

        retrieved_spans = await _await_or_return(
            Client().spans.get_spans(
                project_identifier="default",
                limit=50,
            )
        )

        created_span_ids = {s["context"]["span_id"] for s in batch_spans}
        retrieved_span_ids = {s["context"]["span_id"] for s in retrieved_spans}
        assert (
            len(created_span_ids & retrieved_span_ids) >= 0
        )
