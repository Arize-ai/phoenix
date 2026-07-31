from datetime import datetime, timezone
from unittest.mock import Mock

import pytest

from phoenix.server import trace_filters
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.trace_filters import (
    TraceFilterConditionError,
    compile_trace_filter,
    get_filtered_trace_rowids_subquery,
)


@pytest.mark.parametrize(
    "error",
    [
        AttributeError("attribute"),
        IndexError("index"),
        KeyError("key"),
        NameError("name"),
        SyntaxError("syntax"),
        TypeError("type"),
        ValueError("value"),
    ],
    ids=lambda error: type(error).__name__,
)
def test_compile_normalizes_caller_expression_errors(
    monkeypatch: pytest.MonkeyPatch, error: Exception
) -> None:
    monkeypatch.setattr(trace_filters, "TraceFilter", Mock(side_effect=error))

    with pytest.raises(TraceFilterConditionError) as exc_info:
        compile_trace_filter("condition")

    assert isinstance(exc_info.value, BadRequest)
    assert str(exc_info.value)


def test_sql_application_normalizes_caller_expression_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trace_filter = Mock()
    trace_filter.as_trace_rowids_subquery.side_effect = TypeError("invalid SQL expression")
    monkeypatch.setattr(trace_filters, "compile_trace_filter", Mock(return_value=trace_filter))

    with pytest.raises(TraceFilterConditionError, match="invalid SQL expression"):
        get_filtered_trace_rowids_subquery("condition", project_rowids=[1])


def test_unexpected_compiler_failures_remain_server_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(trace_filters, "TraceFilter", Mock(side_effect=RuntimeError("failure")))

    with pytest.raises(RuntimeError, match="failure"):
        compile_trace_filter("condition")


def test_rowid_subquery_forwards_scope_and_lowering(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end_time = datetime(2026, 2, 1, tzinfo=timezone.utc)
    expected = Mock()
    trace_filter = Mock()
    trace_filter.as_trace_rowids_subquery.return_value = expected
    monkeypatch.setattr(trace_filters, "compile_trace_filter", Mock(return_value=trace_filter))

    actual = get_filtered_trace_rowids_subquery(
        "num_spans > 2",
        project_rowids=(1, 2),
        start_time=start_time,
        end_time=end_time,
        candidate_trace_rowids=(3, 4),
        lowering="probe",
    )

    assert actual is expected
    trace_filter.as_trace_rowids_subquery.assert_called_once_with(
        project_rowids=[1, 2],
        start_time=start_time,
        end_time=end_time,
        candidate_trace_rowids=(3, 4),
        lowering="probe",
    )
