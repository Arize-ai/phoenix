"""
Tests for dataframe_to_spans conversion and timezone validation.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from phoenix.client.helpers.spans import dataframe_to_spans


def test_dataframe_to_spans_with_timezone_aware_timestamps() -> None:
    """Test that dataframe_to_spans works correctly with timezone-aware timestamps."""
    # Create test data with timezone-aware timestamps
    trace_id = uuid.uuid4().hex
    span_id1 = uuid.uuid4().hex[:16]
    span_id2 = uuid.uuid4().hex[:16]

    base_time = datetime.now(timezone.utc)

    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id1,
                "parent_id": None,
                "name": "root_span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time,
                "end_time": base_time + timedelta(seconds=5),
            },
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id2,
                "parent_id": span_id1,
                "name": "child_span",
                "span_kind": "LLM",
                "status_code": "OK",
                "start_time": base_time + timedelta(seconds=1),
                "end_time": base_time + timedelta(seconds=3),
            },
        ]
    )

    # Should not raise an error
    spans = dataframe_to_spans(df)

    # Verify spans were created correctly
    assert len(spans) == 2
    assert all("context" in span for span in spans)
    assert all("start_time" in span for span in spans)
    assert all("end_time" in span for span in spans)


def test_dataframe_to_spans_rejects_naive_timestamps() -> None:
    """Test that dataframe_to_spans raises ValueError for timezone-naive timestamps."""
    # Create test data with timezone-naive timestamps (no timezone)
    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]

    base_time = datetime.now()  # Naive timestamp (no timezone)

    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "test_span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time,  # Naive timestamp
                "end_time": base_time + timedelta(seconds=5),  # Naive timestamp
            }
        ]
    )

    # Should raise ValueError with helpful message
    with pytest.raises(ValueError) as exc_info:
        dataframe_to_spans(df)

    error_message = str(exc_info.value)
    assert "timezone-naive" in error_message
    assert "start_time" in error_message
    assert "dt.tz_localize" in error_message or "UTC" in error_message


def test_dataframe_to_spans_rejects_naive_end_time() -> None:
    """Test that dataframe_to_spans raises ValueError for naive end_time."""
    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]

    base_time_aware = datetime.now(timezone.utc)
    base_time_naive = datetime.now()  # Naive

    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "test_span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time_aware,  # Aware
                "end_time": base_time_naive,  # Naive - should trigger error
            }
        ]
    )

    with pytest.raises(ValueError) as exc_info:
        dataframe_to_spans(df)

    error_message = str(exc_info.value)
    assert "timezone-naive" in error_message
    # Could be either column depending on which is checked first
    assert "start_time" in error_message or "end_time" in error_message


def test_dataframe_to_spans_with_null_timestamps() -> None:
    """Test that dataframe_to_spans handles null timestamps gracefully."""
    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]

    base_time = datetime.now(timezone.utc)

    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "test_span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time,
                "end_time": None,  # Null is allowed
            }
        ]
    )

    # Should not raise an error - nulls are filtered before validation
    spans = dataframe_to_spans(df)
    assert len(spans) == 1


def test_dataframe_to_spans_with_mixed_timezones() -> None:
    """Test that dataframe_to_spans works with different timezone-aware timestamps."""
    from datetime import timezone as tz

    trace_id = uuid.uuid4().hex
    span_id1 = uuid.uuid4().hex[:16]
    span_id2 = uuid.uuid4().hex[:16]

    base_time_utc = datetime.now(tz.utc)
    # Create a timezone with offset (e.g., UTC+5)
    offset_tz = tz(timedelta(hours=5))
    base_time_offset = datetime.now(offset_tz)

    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id1,
                "parent_id": None,
                "name": "span1",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time_utc,
                "end_time": base_time_utc + timedelta(seconds=2),
            },
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id2,
                "parent_id": span_id1,
                "name": "span2",
                "span_kind": "LLM",
                "status_code": "OK",
                "start_time": base_time_offset,
                "end_time": base_time_offset + timedelta(seconds=1),
            },
        ]
    )

    # Should not raise - both are timezone-aware even if different timezones
    spans = dataframe_to_spans(df)
    assert len(spans) == 2
