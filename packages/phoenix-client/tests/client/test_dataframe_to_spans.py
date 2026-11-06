"""
Tests for dataframe_to_spans conversion and timezone validation.
"""

from datetime import datetime, timedelta, timezone
from secrets import token_hex

import pandas as pd
import pytest

from phoenix.client.helpers.spans import dataframe_to_spans


def test_dataframe_to_spans_with_timezone_aware_timestamps() -> None:
    """Timezone-aware timestamps are accepted and converted."""
    trace_id = token_hex(16)
    span_id = token_hex(8)
    base_time = datetime.now(timezone.utc)
    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time,
                "end_time": base_time + timedelta(seconds=1),
            }
        ]
    )
    spans = dataframe_to_spans(df)
    assert len(spans) == 1
    assert spans[0]["context"]["trace_id"] == trace_id
    assert "start_time" in spans[0] and "end_time" in spans[0]


@pytest.mark.parametrize(
    ("naive_start", "naive_end", "column_in_error"),
    [
        (True, True, "start_time"),  # both naive; start_time checked first
        (False, True, "end_time"),  # only end_time naive
    ],
)
def test_dataframe_to_spans_rejects_naive_timestamps(
    naive_start: bool, naive_end: bool, column_in_error: str
) -> None:
    """Raises ValueError with clear message when start_time or end_time is timezone-naive."""
    trace_id = token_hex(16)
    span_id = token_hex(8)
    t_aware = datetime.now(timezone.utc)
    t_naive = datetime.now()
    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": t_naive if naive_start else t_aware,
                "end_time": (t_naive if naive_end else t_aware) + timedelta(seconds=1),
            }
        ]
    )
    with pytest.raises(ValueError) as exc_info:
        dataframe_to_spans(df)
    msg = str(exc_info.value)
    assert "timezone-naive" in msg
    assert column_in_error in msg
    assert "dt.tz_localize" in msg or "UTC" in msg


def test_dataframe_to_spans_with_null_timestamps() -> None:
    """Null end_time is skipped (no validation), span is still created."""
    trace_id = token_hex(16)
    span_id = token_hex(8)
    base_time = datetime.now(timezone.utc)
    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id,
                "parent_id": None,
                "name": "span",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": base_time,
                "end_time": None,
            }
        ]
    )
    spans = dataframe_to_spans(df)
    assert len(spans) == 1


def test_dataframe_to_spans_with_mixed_timezones() -> None:
    """Accepts timezone-aware timestamps in different timezones (UTC and offset)."""
    from datetime import timezone as tz

    trace_id = token_hex(16)
    span_id1, span_id2 = token_hex(8), token_hex(8)
    t_utc = datetime.now(tz.utc)
    t_offset = datetime.now(tz(timedelta(hours=5)))
    df = pd.DataFrame(
        [
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id1,
                "parent_id": None,
                "name": "span1",
                "span_kind": "CHAIN",
                "status_code": "OK",
                "start_time": t_utc,
                "end_time": t_utc + timedelta(seconds=1),
            },
            {
                "context.trace_id": trace_id,
                "context.span_id": span_id2,
                "parent_id": span_id1,
                "name": "span2",
                "span_kind": "LLM",
                "status_code": "OK",
                "start_time": t_offset,
                "end_time": t_offset + timedelta(seconds=1),
            },
        ]
    )
    spans = dataframe_to_spans(df)
    assert len(spans) == 2
