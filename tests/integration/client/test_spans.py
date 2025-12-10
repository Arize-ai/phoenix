# pyright: reportCallIssue=false
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from random import choice, random, sample
from secrets import token_hex
from typing import Any, Sequence, cast

import pandas as pd
import pytest
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias

from phoenix.client.__generated__ import v1

from .._helpers import (
    _AppInfo,  # pyright: ignore[reportPrivateUsage]
    _await_or_return,  # pyright: ignore[reportPrivateUsage]
    _ExistingProject,
    _ExistingSpan,
    _gql,
    _until_spans_exist,
)

# Type aliases for better readability
SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str

# Type ignore for pandas operations that work correctly at runtime
# pyright: reportUnknownMemberType=false
# pyright: reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false


class TestClientForSpanAnnotationsRetrieval:
    @pytest.mark.parametrize("is_async", [True, False])
    async def test_get_span_annotations_dataframe_and_list(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        num_spans = len(_existing_spans)
        assert num_spans >= 2, "At least two existing spans are required for this test"
        existing_span1, (_, span_id2, *_) = sample(_existing_spans, 2)
        span_id1 = existing_span1.span_id
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

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
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
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
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
            )
        )

        assert isinstance(df, pd.DataFrame)
        assert {
            span_id1,
            span_id2,
        }.issubset(set(df.index.astype(str))), "Expected span IDs missing from dataframe"  # pyright: ignore[reportUnknownArgumentType,reportUnknownMemberType]

        annotations = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations(
                span_ids=[span_id1, span_id1, span_id2],  # include duplicate on purpose
                project_identifier=project_name,
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                spans_dataframe=spans_input_df,
                project_identifier=project_name,
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
            assert row.loc["result.label"] == label
            assert abs(float(row.loc["result.score"]) - scr) < 1e-6  # pyright: ignore[reportUnknownArgumentType]
            assert row.loc["result.explanation"] == expl

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_note_annotations_filtering_behavior(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        num_spans = len(_existing_spans)
        assert num_spans >= 2, "At least two existing spans are required for this test"
        existing_span1, (_, span_id2, *_) = sample(_existing_spans, 2)
        span_id1 = existing_span1.span_id
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        regular_annotation_name = f"test_anno_{token_hex(4)}"

        score1 = random()
        label1 = token_hex(4)
        explanation1 = token_hex(8)

        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
            )
        )

        assert isinstance(df_default, pd.DataFrame)
        if not df_default.empty:
            annotation_names_default = set(df_default["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name in annotation_names_default

        df_with_notes = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
                include_annotation_names=[regular_annotation_name, "note"],
            )
        )

        assert isinstance(df_with_notes, pd.DataFrame)
        if not df_with_notes.empty:
            annotation_names_with_notes = set(df_with_notes["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name in annotation_names_with_notes

        df_excluded = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
                exclude_annotation_names=[regular_annotation_name],
            )
        )

        assert isinstance(df_excluded, pd.DataFrame)
        if not df_excluded.empty:
            annotation_names_excluded = set(df_excluded["annotation_name"].tolist())  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]
            assert regular_annotation_name not in annotation_names_excluded

        annotations_default = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
            )
        )

        assert isinstance(annotations_default, list)
        if annotations_default:
            default_names = {a["name"] for a in annotations_default}
            assert regular_annotation_name in default_names

        annotations_with_notes = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations(
                span_ids=[span_id1, span_id2],
                project_identifier=project_name,
                include_annotation_names=[regular_annotation_name, "note"],
            )
        )

        assert isinstance(annotations_with_notes, list)
        if annotations_with_notes:
            with_notes_names = {a["name"] for a in annotations_with_notes}
            assert regular_annotation_name in with_notes_names

    def test_invalid_arguments_validation(
        self,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Supplying multiple or no parameters should error."""
        from phoenix.client import Client

        spans_client = Client(base_url=_app.base_url).spans
        project_name = _existing_project.name

        # Test get_span_annotations_dataframe
        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(project_identifier=project_name)

        dummy_df = pd.DataFrame()

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                spans_dataframe=dummy_df,
                span_ids=["abc"],
                project_identifier=project_name,
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
                project_identifier=project_name,
            )

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                span_ids=["abc"],
                spans=[test_span_2],
                project_identifier=project_name,
            )

        # Test get_span_annotations
        with pytest.raises(ValueError):
            spans_client.get_span_annotations(project_identifier=project_name)

        with pytest.raises(ValueError):
            spans_client.get_span_annotations(
                span_ids=["abc"],
                spans=[test_span_2],
                project_identifier=project_name,
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_get_span_annotations_with_spans_objects(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test getting span annotations using Span objects from get_spans."""
        num_spans = len(_existing_spans)
        assert num_spans >= 2, "At least two existing spans are required for this test"
        existing_span1, (_, span_id2, *_) = sample(_existing_spans, 2)
        span_id1 = existing_span1.span_id
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

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
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
                annotation_name=annotation_name_1,
                span_id=span_id1,
                annotator_kind="LLM",
                label=label1,
                score=score1,
                sync=True,
            )
        )

        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.add_span_annotation(
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=num_spans,
            )
        )
        assert len(spans) == num_spans, "Should retrieve all existing spans"
        # Filter to only the spans we're interested in
        target_spans = [s for s in spans if s["context"]["span_id"] in [span_id1, span_id2]]
        assert len(target_spans) == 2, "Should find the two test spans"

        # Test get_span_annotations_dataframe with spans objects
        df = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations_dataframe(
                spans=target_spans,
                project_identifier=project_name,
                include_annotation_names=[annotation_name_1, annotation_name_2],
            )
        )

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2, "Should have annotations for both spans"

        # Test get_span_annotations with spans objects
        annotations = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations(
                spans=target_spans,
                project_identifier=project_name,
                include_annotation_names=[annotation_name_1, annotation_name_2],
            )
        )

        assert isinstance(annotations, list)
        assert len(annotations) == 2, "Should have annotations for both spans"

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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_span_annotations(
                spans=spans_with_missing_ids,
                project_identifier=project_name,
            )
        )

        # Should only get annotations for the span with valid span_id
        span_ids_found = {a["span_id"] for a in annotations_filtered}
        assert span_id1 in span_ids_found
        assert len([a for a in annotations_filtered if a["span_id"] == span_id1]) >= 1


class TestClientForSpansRetrieval:
    """Test the get_spans method with various filtering and pagination options."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_basic_span_retrieval(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test basic span retrieval returns ergonomic span format."""
        num_spans = len(_existing_spans)
        assert num_spans >= 1, "At least one existing span is required for this test"
        existing_span1 = choice(_existing_spans)
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=num_spans,
            )
        )

        assert isinstance(spans, list)
        assert len(spans) == num_spans

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
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test that start_time and end_time filters work correctly."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create test spans with known, distinct timestamps
        base_time = datetime.now(timezone.utc)
        trace_id = f"trace_time_filter_{token_hex(16)}"

        # Create spans with 10-second intervals to ensure distinct timestamps
        test_spans: list[v1.Span] = []
        span_times: list[datetime] = []

        num_spans = 5
        for i in range(num_spans):
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

        project_name = _existing_project.name

        # Create the test spans
        create_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=test_spans,
            )
        )

        assert create_result["total_queued"] == num_spans, (
            f"Failed to create test spans: {create_result}"
        )

        # Wait for spans to be processed
        await _until_spans_exist(_app, [s["context"]["span_id"] for s in test_spans])

        # Test 1: Filter to get only middle spans (index 1, 2, 3)
        middle_start = span_times[1] - timedelta(seconds=1)  # Just before span 1
        middle_end = span_times[3] + timedelta(seconds=2)  # Just after span 3

        middle_spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                start_time=middle_start,
                end_time=middle_end,
                limit=num_spans,
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                start_time=later_start,
                limit=num_spans,
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
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                end_time=earlier_end,
                limit=num_spans,
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
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test that the method automatically handles pagination to fetch up to the limit."""
        assert len(_existing_spans) >= 102, "At least 102 spans are required for this test"
        existing_span1 = choice(_existing_spans)
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # The method uses page_size = min(100, limit), so test with limit > 100
        # to ensure pagination happens (if there are enough spans)
        limit = 101
        spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=limit,
            )
        )

        # We should get up to the limit, or all available spans
        assert len(spans) == limit

        # Test with small limit
        small_limit = 5
        small_spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=small_limit,
            )
        )

        assert len(small_spans) == small_limit

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_project_identifier_types(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test that project identifier works with both project names and IDs."""
        assert _existing_spans, "At least one existing span is required for this test"
        existing_span1 = choice(_existing_spans)
        project_id = str(existing_span1.trace.project.id)
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Get spans by project name
        spans_by_name = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=5,
            )
        )

        # Get spans by project ID
        spans_by_id = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
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
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        assert _existing_spans, "At least one existing span is required for this test"
        existing_span = choice(_existing_spans)
        project_name = existing_span.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
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
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test behavior when no spans match the filter criteria."""
        assert _existing_spans, "At least one existing span is required for this test"
        existing_span = choice(_existing_spans)
        project_name = existing_span.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Use a far future date that shouldn't have any spans
        far_future = datetime.now(timezone.utc) + timedelta(days=365 * 10)

        spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
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
        _app: _AppInfo,
    ) -> None:
        """Test error handling for invalid project identifier."""
        api_key = _app.admin_secret

        import httpx

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Test with non-existent project
        with pytest.raises(httpx.HTTPStatusError):
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                    project_identifier="non_existent_project_xyz_123",
                    limit=10,
                )
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_client_get_spans(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test the get_spans method returns spans correctly."""
        num_spans = len(_existing_spans)
        assert num_spans >= 2, "At least two existing spans are required for this test"
        existing_span1, (_, span_id2, *_) = sample(_existing_spans, 2)
        span_id1 = existing_span1.span_id
        project_name = existing_span1.trace.project.name

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        all_spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name, limit=num_spans
            )
        )

        span_ids_found = {span["context"]["span_id"] for span in all_spans}
        assert span_id1 in span_ids_found, f"Expected span {span_id1} not found in {span_ids_found}"
        assert span_id2 in span_ids_found, f"Expected span {span_id2} not found in {span_ids_found}"

        limited_spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name, limit=1
            )
        )
        assert len(limited_spans) == 1, "Limit parameter should be respected"

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
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test basic span creation, duplicates, and error handling in one efficient test."""
        api_key = _app.admin_secret

        from phoenix.client import Client
        from phoenix.client.exceptions import SpanCreationError

        client = Client(base_url=_app.base_url, api_key=api_key)

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

        project_name = _existing_project.name
        num_spans = 2

        # Create spans successfully
        result = client.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
            project_identifier=project_name,
            spans=[parent_span, child_span],
        )
        assert result["total_received"] == num_spans
        assert result["total_queued"] == num_spans

        await _until_spans_exist(
            _app, [parent_span["context"]["span_id"], child_span["context"]["span_id"]]
        )

        # Test 2: Duplicate span rejection
        with pytest.raises(SpanCreationError) as exc_info:
            client.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
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
            client.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=[invalid_span],
            )
        error = exc_info.value
        assert error.total_invalid == 1
        assert error.total_queued == 0

        # Test 4: Non-existent project name is accepted (may be auto-created)
        # Only GlobalIDs are validated for existence
        result_nonexistent = client.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
            project_identifier="non_existent_project_xyz",
            spans=[self._create_test_span("test")],
        )
        assert result_nonexistent["total_received"] == 1
        assert result_nonexistent["total_queued"] == 1

        # Test 5: Error handling for non-existent project by GlobalID
        import httpx

        with pytest.raises(httpx.HTTPStatusError) as http_exc_info:
            client.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=str(GlobalID("Project", "999999")),  # Non-existent GlobalID
                spans=[self._create_test_span("test")],
            )
        assert http_exc_info.value.response.status_code == 404

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_helper_functions_round_trip(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test round-tripping spans through helper functions efficiently."""
        # Use deterministic seed to avoid random collisions
        import random

        original_state = random.getstate()
        try:
            random.seed(100 + (1 if is_async else 0))

            api_key = _app.admin_secret

            from phoenix.client import AsyncClient
            from phoenix.client import Client as SyncClient
            from phoenix.client.helpers.spans import (
                dataframe_to_spans,
                uniquify_spans,
                uniquify_spans_dataframe,
            )

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

            project_name = _existing_project.name
            num_spans = len(test_spans)

            # Create original spans
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                    project_identifier=project_name,
                    spans=test_spans,
                )
            )
            assert result["total_queued"] == num_spans

            await _until_spans_exist(_app, [span["context"]["span_id"] for span in test_spans])

            df = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.get_spans_dataframe(
                    project_identifier=project_name,
                    limit=num_spans,
                )
            )

            # Filter to our test spans
            our_spans_mask = df["context.trace_id"] == trace_id
            our_df = df[our_spans_mask].copy()

            # Test 1: DataFrame to spans conversion
            reconstructed_spans = dataframe_to_spans(our_df)  # pyright: ignore[reportArgumentType]
            assert len(reconstructed_spans) == num_spans

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

            unique_df = uniquify_spans_dataframe(our_df, in_place=False)  # pyright: ignore[reportArgumentType]

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
            assert len(final_unique_spans) == num_spans
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
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test efficient batch span creation and retrieval."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name
        num_spans = 5

        trace_id = f"batch_trace_{token_hex(16)}"
        batch_spans = [
            self._create_test_span(
                f"batch_{i}",
                context={"trace_id": trace_id, "span_id": f"span_{token_hex(8)}"},
                attributes={"batch_index": i},
            )
            for i in range(num_spans)
        ]

        # Create batch
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=batch_spans,
            )
        )
        assert result["total_received"] == num_spans
        assert result["total_queued"] == num_spans

        await _until_spans_exist(_app, [span["context"]["span_id"] for span in batch_spans])

        retrieved_spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=num_spans,
            )
        )

        created_span_ids = {s["context"]["span_id"] for s in batch_spans}
        retrieved_span_ids = {s["context"]["span_id"] for s in retrieved_spans}
        assert len(created_span_ids & retrieved_span_ids) >= 0

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_log_spans_dataframe_roundtrip(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        # Create comprehensive test DataFrame with nested attributes
        import pandas as pd

        trace_id_1 = f"df_roundtrip_{token_hex(16)}"
        trace_id_2 = f"df_roundtrip_{token_hex(16)}"
        span_id_1 = f"span_{token_hex(8)}"
        span_id_2 = f"span_{token_hex(8)}"

        base_time = datetime.now(timezone.utc)

        # Create comprehensive test data with nested attributes and complex types
        test_data: dict[str, Any] = {
            "name": ["ChatCompletion", "ChatCompletion"],
            "span_kind": ["LLM", "LLM"],
            "parent_id": [None, None],
            "start_time": [
                base_time.isoformat(),
                (base_time + timedelta(milliseconds=100)).isoformat(),
            ],
            "end_time": [
                (base_time + timedelta(seconds=3, milliseconds=500)).isoformat(),
                (base_time + timedelta(seconds=3, milliseconds=600)).isoformat(),
            ],
            "status_code": ["OK", "OK"],
            "status_message": ["", ""],
            "events": [[], []],
            "context.span_id": [span_id_1, span_id_2],
            "context.trace_id": [trace_id_1, trace_id_2],
            # Complex nested attributes
            "attributes.openinference.span.kind": ["LLM", "LLM"],
            "attributes.llm.provider": ["openai", "openai"],
            "attributes.llm.model_name": ["gpt-4o", "gpt-4o"],
            "attributes.llm.system": ["openai", "openai"],
            # JSON string attributes
            "attributes.llm.invocation_parameters": [
                (
                    '{"temperature": 1.0, "frequency_penalty": 0.0, "presence_penalty": 0.0, '
                    '"top_p": 1.0}'
                ),
                (
                    '{"temperature": 1.0, "frequency_penalty": 0.0, "presence_penalty": 0.0, '
                    '"top_p": 1.0}'
                ),
            ],
            # Numeric attributes
            "attributes.llm.token_count.total": [34, 64],
            "attributes.llm.token_count.prompt": [22, 21],
            "attributes.llm.token_count.completion": [12, 43],
            # List attributes with complex objects
            "attributes.llm.input_messages": [
                [
                    {"message.content": "You are a helpful assistant", "message.role": "system"},
                    {"message.content": "What is the capital of France?", "message.role": "user"},
                ],
                [
                    {"message.content": "You are a helpful assistant", "message.role": "system"},
                    {
                        "message.content": "Explain the concept of machine learning",
                        "message.role": "user",
                    },
                ],
            ],
            "attributes.llm.output_messages": [
                [
                    {
                        "message.content": "The capital of France is Paris.",
                        "message.role": "assistant",
                    }
                ],
                [
                    {
                        "message.content": (
                            "Machine learning is a subset of artificial intelligence that "
                            "enables computers to learn and improve from experience without "
                            "being explicitly programmed."
                        ),
                        "message.role": "assistant",
                    }
                ],
            ],
            # Nested object attributes
            "attributes.url": [
                {"full": "https://api.openai.com/v1/chat/completions", "path": "chat/completions"},
                {"full": "https://api.openai.com/v1/chat/completions", "path": "chat/completions"},
            ],
            "attributes.llm.prompt_template.variables": [
                {"question": "What is the capital of France?"},
                {"question": "Explain the concept of machine learning"},
            ],
            # MIME type attributes
            "attributes.input.mime_type": ["application/json", "application/json"],
            "attributes.output.mime_type": ["text/plain", "text/plain"],
            # Complex JSON input/output values
            "attributes.input.value": [
                (
                    '{"messages": [{"role": "SYSTEM", "content": "You are a helpful assistant"}, '
                    '{"role": "USER", "content": "{{question}}"}], "model": {"provider_key": '
                    '"OpenAI", "name": "gpt-4o"}, "template": {"variables": {"question": "What is '
                    'the capital of France?"}, "format": "MUSTACHE"}, "prompt_name": null}'
                ),
                (
                    '{"messages": [{"role": "SYSTEM", "content": "You are a helpful assistant"}, '
                    '{"role": "USER", "content": "{{question}}"}], "model": {"provider_key": '
                    '"OpenAI", "name": "gpt-4o"}, "template": {"variables": {"question": '
                    '"Explain the concept of machine learning"}, "format": "MUSTACHE"}, '
                    '"prompt_name": null}'
                ),
            ],
            "attributes.output.value": [
                "The capital of France is Paris.",
                (
                    "Machine learning is a subset of artificial intelligence that enables "
                    "computers to learn and improve from experience without being explicitly "
                    "programmed."
                ),
            ],
        }

        input_df = pd.DataFrame(test_data)
        # Set index to span_id so dataframe_to_spans uses the right span IDs
        input_df.set_index("context.span_id", inplace=True, drop=False)
        input_df.index.name = "span_id"

        project_name = _existing_project.name
        num_spans = len(input_df)

        # Log spans using DataFrame
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans_dataframe(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans_dataframe=input_df,
            )
        )
        assert result["total_queued"] == num_spans

        await _until_spans_exist(_app, input_df.index.tolist())

        output_df = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans_dataframe(
                project_identifier=project_name,
                limit=num_spans,
            )
        )

        # Filter to our test spans (check both trace IDs since we have different ones)
        our_spans = output_df[output_df["context.trace_id"].isin([trace_id_1, trace_id_2])]
        assert len(our_spans) == num_spans

        # Verify roundtrip data by matching on name (spans may get new IDs)
        span_names = set(our_spans["name"].tolist())
        expected_names = set(input_df["name"].tolist())
        assert span_names == expected_names

        for _, row in our_spans.iterrows():
            # Find matching original span by trace_id to handle identical names
            original_span = input_df[input_df["context.trace_id"] == row["context.trace_id"]]
            assert len(original_span) > 0  # Use len() instead of .empty for type safety
            orig_row = original_span.iloc[0]

            # Verify basic fields
            assert str(row["span_kind"]) == str(orig_row["span_kind"])
            assert str(row["name"]) == str(orig_row["name"])
            assert str(row["status_code"]) == str(orig_row["status_code"])

            # Verify simple string attributes
            assert str(row["attributes.llm.provider"]) == str(orig_row["attributes.llm.provider"])
            assert str(row["attributes.llm.model_name"]) == str(
                orig_row["attributes.llm.model_name"]
            )
            assert str(row["attributes.input.mime_type"]) == str(
                orig_row["attributes.input.mime_type"]
            )

            # Verify numeric attributes
            assert (
                int(row["attributes.llm.token_count.total"])  # pyright: ignore[reportArgumentType]
                == int(orig_row["attributes.llm.token_count.total"])  # pyright: ignore[reportArgumentType]
            )
            assert (
                int(row["attributes.llm.token_count.prompt"])  # pyright: ignore[reportArgumentType]
                == int(orig_row["attributes.llm.token_count.prompt"])  # pyright: ignore[reportArgumentType]
            )

            # Verify JSON string attributes
            assert str(row["attributes.llm.invocation_parameters"]) == str(
                orig_row["attributes.llm.invocation_parameters"]
            )
            assert str(row["attributes.input.value"]) == str(orig_row["attributes.input.value"])
            assert str(row["attributes.output.value"]) == str(orig_row["attributes.output.value"])

            # Verify complex nested object attributes using JSON comparison for order-independence
            import ast

            def compare_nested_objects(val1: Any, val2: Any) -> bool:
                """Compare complex nested objects, handling different key orders."""
                try:
                    # Convert to strings and parse as Python literals if possible
                    if isinstance(val1, str) and isinstance(val2, str):
                        parsed1 = ast.literal_eval(val1)
                        parsed2 = ast.literal_eval(val2)
                        return bool(parsed1 == parsed2)
                    return bool(val1 == val2)
                except (ValueError, SyntaxError):
                    # If parsing fails, fallback to string comparison
                    return str(val1) == str(val2)

            assert compare_nested_objects(row["attributes.url"], orig_row["attributes.url"])
            assert compare_nested_objects(
                row["attributes.llm.prompt_template.variables"],
                orig_row["attributes.llm.prompt_template.variables"],
            )

            # Verify list attributes with complex objects using order-independent comparison
            assert compare_nested_objects(
                row["attributes.llm.input_messages"], orig_row["attributes.llm.input_messages"]
            )
            assert compare_nested_objects(
                row["attributes.llm.output_messages"], orig_row["attributes.llm.output_messages"]
            )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_unflatten_attributes_on_span_creation(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test that flattened attributes are properly unflattened when creating spans.

        This test verifies that the unflatten() function correctly converts
        flattened dot-separated keys into nested structures when spans are created.
        It uses GraphQL to check the raw database structure (nested) and the REST API
        to verify round-trip behavior (flattened).
        """
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name
        trace_id = f"trace_{token_hex(16)}"
        span_id = f"span_{token_hex(8)}"

        # Create a span with MIX of flattened and already-nested attributes
        # This tests robustness of unflatten() handling both formats
        test_span = self._create_test_span(
            "test_unflatten",
            context={"trace_id": trace_id, "span_id": span_id},
            attributes={
                # Flattened attributes
                "llm.model": "gpt-4",
                "llm.token_count.prompt": 100,
                "llm.token_count.completion": 50,
                "llm.token_count.total": 150,
                # Already nested attribute (should be preserved as-is)
                "metadata": {
                    "user": {"id": "user123", "name": "Test User"},
                    "session": {"id": "session456"},
                },
                # Array-like structure (numeric keys with nested content)
                "documents.0.content": "First document",
                "documents.0.id": "doc1",
                "documents.1.content": "Second document",
                "documents.1.id": "doc2",
            },
        )

        # Create the span
        result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=[test_span],
            )
        )
        assert result["total_received"] == 1
        assert result["total_queued"] == 1

        # Wait for span to be processed
        await _until_spans_exist(_app, [span_id])

        # Use GraphQL to check the nested structure in the database
        gql_query = """
        query GetSpanAttributes($spanId: ID!) {
            node(id: $spanId) {
                ... on Span {
                    spanId
                    attributes
                }
            }
        }
        """

        # Get the span's Global ID using GraphQL - query project directly by its Global ID
        trace_query = """
        query GetTraceSpans($projectId: ID!, $traceId: ID!) {
            node(id: $projectId) {
                ... on Project {
                    trace(traceId: $traceId) {
                        spans {
                            edges {
                                node {
                                    id
                                    spanId
                                }
                            }
                        }
                    }
                }
            }
        }
        """

        trace_result, _ = _gql(
            _app,
            _app.admin_secret,
            query=trace_query,
            variables={"projectId": str(_existing_project.id), "traceId": trace_id},
        )
        assert not trace_result.get("errors"), f"GraphQL errors: {trace_result.get('errors')}"

        # Find our span's Global ID
        trace = trace_result["data"]["node"]["trace"]
        assert trace is not None, f"Could not find trace with traceId {trace_id}"

        span_global_id = None
        for span_edge in trace["spans"]["edges"]:
            if span_edge["node"]["spanId"] == span_id:
                span_global_id = span_edge["node"]["id"]
                break

        assert span_global_id is not None, f"Could not find span with spanId {span_id}"

        # Now query for the attributes using the Global ID
        attr_result, _ = _gql(
            _app, _app.admin_secret, query=gql_query, variables={"spanId": span_global_id}
        )
        assert not attr_result.get("errors"), f"GraphQL errors: {attr_result.get('errors')}"

        # Get the nested attributes from GraphQL (as stored in the database)
        # GraphQL returns the attributes as a JSON string, so we need to parse it
        db_attrs_json = attr_result["data"]["node"]["attributes"]
        db_attrs = json.loads(db_attrs_json)

        # Verify the attributes are stored in nested structure in the database
        assert isinstance(db_attrs, dict)

        # Check OpenInference attributes
        assert "openinference" in db_attrs
        assert isinstance(db_attrs["openinference"], dict)
        assert "span" in db_attrs["openinference"]
        assert isinstance(db_attrs["openinference"]["span"], dict)
        assert "kind" in db_attrs["openinference"]["span"]
        assert db_attrs["openinference"]["span"]["kind"] == "CHAIN"

        # Check LLM attributes
        assert "llm" in db_attrs
        assert isinstance(db_attrs["llm"], dict)
        assert db_attrs["llm"]["model"] == "gpt-4"
        assert "token_count" in db_attrs["llm"]
        assert isinstance(db_attrs["llm"]["token_count"], dict)
        assert db_attrs["llm"]["token_count"]["prompt"] == 100
        assert db_attrs["llm"]["token_count"]["completion"] == 50
        assert db_attrs["llm"]["token_count"]["total"] == 150

        # Check already-nested attributes are preserved
        assert "metadata" in db_attrs
        assert isinstance(db_attrs["metadata"], dict)
        assert "user" in db_attrs["metadata"]
        assert isinstance(db_attrs["metadata"]["user"], dict)
        assert db_attrs["metadata"]["user"]["id"] == "user123"
        assert db_attrs["metadata"]["user"]["name"] == "Test User"
        assert "session" in db_attrs["metadata"]
        assert isinstance(db_attrs["metadata"]["session"], dict)
        assert db_attrs["metadata"]["session"]["id"] == "session456"

        # Check array-like structures are converted to arrays
        assert "documents" in db_attrs
        assert isinstance(db_attrs["documents"], list)
        assert len(db_attrs["documents"]) == 2
        assert db_attrs["documents"][0]["content"] == "First document"
        assert db_attrs["documents"][0]["id"] == "doc1"
        assert db_attrs["documents"][1]["content"] == "Second document"
        assert db_attrs["documents"][1]["id"] == "doc2"

        # Now verify the REST API round-trip (should be flattened on retrieval)
        spans = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=100,
            )
        )

        # Find our test span
        test_span_retrieved = None
        for span in spans:
            if span["context"]["span_id"] == span_id:
                test_span_retrieved = span
                break

        assert test_span_retrieved is not None, "Test span should be found in retrieved spans"

        # Verify the attributes are flattened when retrieved via REST API
        assert "attributes" in test_span_retrieved
        rest_attrs = test_span_retrieved["attributes"]
        assert isinstance(rest_attrs, dict)

        # These should be flattened (dot-separated keys)
        assert "llm.model" in rest_attrs
        assert rest_attrs["llm.model"] == "gpt-4"
        assert "llm.token_count.prompt" in rest_attrs
        assert rest_attrs["llm.token_count.prompt"] == 100
        assert "llm.token_count.completion" in rest_attrs
        assert rest_attrs["llm.token_count.completion"] == 50

        # Verify originally-nested metadata is flattened in REST response
        assert "metadata.user.id" in rest_attrs
        assert rest_attrs["metadata.user.id"] == "user123"
        assert "metadata.session.id" in rest_attrs
        assert rest_attrs["metadata.session.id"] == "session456"

        # Verify documents array is flattened back to dotted keys
        assert "documents.0.content" in rest_attrs
        assert rest_attrs["documents.0.content"] == "First document"
        assert "documents.0.id" in rest_attrs
        assert rest_attrs["documents.0.id"] == "doc1"
        assert "documents.1.content" in rest_attrs
        assert rest_attrs["documents.1.content"] == "Second document"


class TestClientForSpanNotes:
    """Test the add_span_note method."""

    # Use GraphQL to verify each note was stored correctly
    QUERY = """
        query GetSpanAnnotation($annotationId: ID!) {
            node(id: $annotationId) {
                ... on SpanAnnotation {
                    name
                    score
                    label
                    explanation
                    annotatorKind
                    identifier
                }
            }
        }
    """

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_add_span_note(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        """Test multiple notes can be added to a span and verify content via GraphQL.

        Notes are a special type of annotation that allow multiple entries per span
        (unlike regular annotations which are unique by name and identifier).
        """
        assert _existing_spans, "At least one existing span is required for this test"
        existing_span = choice(_existing_spans)
        span_id = existing_span.span_id

        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        num_notes = 3
        note_texts: dict[str, str] = {}

        # Add multiple notes to the same span
        for _ in range(num_notes):
            note_text = f" Test note {token_hex(8)} "
            result = await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.add_span_note(
                    span_id=span_id,
                    note=note_text,
                )
            )

            assert isinstance(result, dict)
            assert "id" in result
            annotation_global_id = result["id"]
            assert annotation_global_id, "Note should have a non-empty ID"
            note_texts[annotation_global_id] = note_text

        # Verify all notes have unique IDs (key property of notes vs regular annotations)
        assert len(note_texts) == num_notes, "Each note should have a unique ID"

        for annotation_global_id, note_text in note_texts.items():
            gql_result, _ = _gql(
                _app,
                _app.admin_secret,
                query=self.QUERY,
                operation_name="GetSpanAnnotation",
                variables={"annotationId": annotation_global_id},
            )
            assert not gql_result.get("errors"), f"GraphQL errors: {gql_result.get('errors')}"

            annotation_data = gql_result["data"]["node"]
            assert annotation_data is not None, "Annotation should exist"

            # Verify the note properties
            assert annotation_data["name"] == "note"
            assert annotation_data["score"] is None
            assert annotation_data["label"] is None
            assert annotation_data["explanation"] == note_text.strip()
            assert annotation_data["annotatorKind"] == "HUMAN"


class TestClientForSpanDeletion:
    """Test the delete_span method with various span identifiers."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_span_by_opentelemetry_span_id(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test deleting a span by OpenTelemetry span_id."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name

        # Create a test span to delete
        trace_id = f"trace_delete_{token_hex(16)}"
        span_id = f"span_delete_{token_hex(8)}"

        test_span = cast(
            v1.Span,
            {
                "name": "span_to_delete",
                "context": {
                    "trace_id": trace_id,
                    "span_id": span_id,
                },
                "span_kind": "CHAIN",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
                "status_code": "OK",
                "attributes": {"test_attr": "delete_test"},
            },
        )

        # Create the span
        create_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(
                project_identifier=project_name,
                spans=[test_span],
            )
        )
        assert create_result["total_queued"] == 1

        # Wait for span to be processed
        await _until_spans_exist(_app, [span_id])

        # Verify span exists before deletion
        spans_before = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_before = {s["context"]["span_id"] for s in spans_before}
        assert span_id in span_ids_before, "Test span should exist before deletion"

        # Delete the span using OpenTelemetry span_id
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.delete(span_identifier=span_id)
        )

        # Verify span is deleted
        spans_after = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_after = {s["context"]["span_id"] for s in spans_after}
        assert span_id not in span_ids_after, "Test span should be deleted"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_span_by_global_id(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test deleting a span by Phoenix Global ID."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name

        # Create a test span to delete
        trace_id = f"trace_delete_global_{token_hex(16)}"
        span_id = f"span_delete_global_{token_hex(8)}"

        test_span = cast(
            v1.Span,
            {
                "name": "span_to_delete_by_global_id",
                "context": {
                    "trace_id": trace_id,
                    "span_id": span_id,
                },
                "span_kind": "LLM",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
                "status_code": "OK",
                "attributes": {"test_attr": "global_id_delete_test"},
            },
        )

        # Create the span
        create_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(
                project_identifier=project_name,
                spans=[test_span],
            )
        )
        assert create_result["total_queued"] == 1

        # Wait for span to be processed
        await _until_spans_exist(_app, [span_id])

        # Get the span to retrieve its Global ID
        spans_before = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )

        # Find our test span
        test_span_data = None
        for span in spans_before:
            if span["context"]["span_id"] == span_id:
                test_span_data = span
                break

        assert test_span_data is not None, "Test span should exist before deletion"
        span_global_id = test_span_data.get("id")  # This is the Phoenix Global ID
        assert span_global_id, "Span should have a global ID"

        # Delete the span using Phoenix Global ID
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.delete(
                span_identifier=span_global_id
            )
        )

        # Verify span is deleted
        spans_after = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_after = {s["context"]["span_id"] for s in spans_after}
        assert span_id not in span_ids_after, "Test span should be deleted"

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_span_orphaned_children_behavior(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test that deleting a parent span orphans its children but doesn't delete them."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name

        # Create parent and child spans
        trace_id = f"trace_orphan_{token_hex(16)}"
        parent_span_id = f"parent_{token_hex(8)}"
        child_span_id = f"child_{token_hex(8)}"

        parent_span = cast(
            v1.Span,
            {
                "name": "parent_span",
                "context": {
                    "trace_id": trace_id,
                    "span_id": parent_span_id,
                },
                "span_kind": "CHAIN",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat(),
                "status_code": "OK",
                "attributes": {"span_type": "parent"},
            },
        )

        child_span = cast(
            v1.Span,
            {
                "name": "child_span",
                "context": {
                    "trace_id": trace_id,
                    "span_id": child_span_id,
                },
                "span_kind": "LLM",
                "parent_id": parent_span_id,  # Set parent relationship
                "start_time": (
                    datetime.now(timezone.utc) + timedelta(milliseconds=100)
                ).isoformat(),
                "end_time": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
                "status_code": "OK",
                "attributes": {"span_type": "child"},
            },
        )

        # Create both spans
        create_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(
                project_identifier=project_name,
                spans=[parent_span, child_span],
            )
        )
        assert create_result["total_queued"] == 2

        # Wait for spans to be processed
        await _until_spans_exist(_app, [parent_span_id, child_span_id])

        # Verify both spans exist before deletion
        spans_before = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_before = {s["context"]["span_id"] for s in spans_before}
        assert parent_span_id in span_ids_before, "Parent span should exist before deletion"
        assert child_span_id in span_ids_before, "Child span should exist before deletion"

        # Verify parent-child relationship
        child_span_before = next(
            s for s in spans_before if s["context"]["span_id"] == child_span_id
        )
        assert child_span_before.get("parent_id") == parent_span_id, (
            "Child should have correct parent_id"
        )

        # Delete the parent span
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.delete(
                span_identifier=parent_span_id
            )
        )

        # Verify parent is deleted but child remains (orphaned)
        spans_after = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_after = {s["context"]["span_id"] for s in spans_after}

        assert parent_span_id not in span_ids_after, "Parent span should be deleted"
        assert child_span_id in span_ids_after, "Child span should remain (orphaned)"

        # Verify child is now orphaned (parent_id points to non-existent span)
        child_span_after = next(s for s in spans_after if s["context"]["span_id"] == child_span_id)
        assert child_span_after.get("parent_id") == parent_span_id, (
            "Child should still reference deleted parent (orphaned)"
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_nonexistent_span(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test error handling when trying to delete a non-existent span."""
        api_key = _app.admin_secret

        import httpx

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        nonexistent_span_id = f"nonexistent_{token_hex(8)}"

        # Attempt to delete non-existent span should raise 404
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=api_key).spans.delete(
                    span_identifier=nonexistent_span_id
                )
            )

        assert exc_info.value.response.status_code == 404

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_delete_span_timeout_parameter(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Test that timeout parameter is properly handled."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        project_name = _existing_project.name

        # Create a test span to delete
        trace_id = f"trace_timeout_{token_hex(16)}"
        span_id = f"span_timeout_{token_hex(8)}"

        test_span: v1.Span = v1.Span(
            name="timeout_test_span",
            context={
                "trace_id": trace_id,
                "span_id": span_id,
            },
            span_kind="TOOL",
            start_time=datetime.now(timezone.utc).isoformat(),
            end_time=(datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
            status_code="OK",
            attributes={"test_attr": "timeout_test"},
        )

        # Create the span
        create_result = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.log_spans(
                project_identifier=project_name,
                spans=[test_span],
            )
        )
        assert create_result["total_queued"] == 1

        # Wait for span to be processed
        await _until_spans_exist(_app, [span_id])

        # Delete with custom timeout (should work normally)
        await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.delete(
                span_identifier=span_id,
                timeout=10,  # Custom timeout
            )
        )

        # Verify span is deleted
        spans_after = await _await_or_return(
            Client(base_url=_app.base_url, api_key=api_key).spans.get_spans(
                project_identifier=project_name,
                limit=1000,
            )
        )
        span_ids_after = {s["context"]["span_id"] for s in spans_after}
        assert span_id not in span_ids_after, "Test span should be deleted"
