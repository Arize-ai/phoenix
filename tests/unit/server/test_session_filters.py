from datetime import datetime, timezone
from typing import Any
from unittest.mock import Mock

import pytest
from sqlalchemy import Select, select

from phoenix.db import models
from phoenix.server.api.dataloaders import (
    annotation_summaries,
    record_counts,
    span_cost_summary_by_project,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.Project import _apply_project_session_filters
from phoenix.server.session_filters import (
    SessionFilterConditionError,
    apply_session_filter_to_page,
    compile_session_filter,
    get_filtered_session_rowids_subquery,
)

_MIXED_ANY_AND_ALL = (
    'any(s.status_code == "ERROR" for s in spans) and all(s.span_kind == "LLM" for s in spans)'
)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("hello world", id="prose-that-does-not-parse"),
        pytest.param("refund", id="bare-name-that-parses-but-binds-to-nothing"),
        pytest.param("num_traces >= ", id="truncated-expression"),
    ],
)
def test_unusable_expressions_are_reported_as_client_errors(condition: str) -> None:
    """Every entrypoint that compiles a session filter rejects the same expressions the same way.

    A caller can reach these resolvers without validating first, so an expression the compiler
    cannot use has to read as a bad request rather than a server fault.
    """
    for compile_it in (
        lambda: compile_session_filter(condition),
        lambda: get_filtered_session_rowids_subquery(condition, project_rowids=[1]),
        lambda: apply_session_filter_to_page(
            select(models.ProjectSession), condition, project_rowids=[1]
        ),
    ):
        with pytest.raises(SessionFilterConditionError) as exc_info:
            compile_it()
        assert isinstance(exc_info.value, BadRequest)
        assert str(exc_info.value)


def test_usable_expressions_compile() -> None:
    assert get_filtered_session_rowids_subquery("num_traces >= 2", project_rowids=[1]) is not None


def test_rowid_subquery_forwards_scope_and_lowering(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end_time = datetime(2026, 2, 1, tzinfo=timezone.utc)
    expected = Mock()
    session_filter = Mock()
    session_filter.as_session_rowids_subquery.return_value = expected
    monkeypatch.setattr(
        "phoenix.server.session_filters.compile_session_filter",
        Mock(return_value=session_filter),
    )

    actual = get_filtered_session_rowids_subquery(
        "num_traces > 2",
        project_rowids=(1, 2),
        start_time=start_time,
        end_time=end_time,
        lowering="probe",
    )

    assert actual is expected
    session_filter.as_session_rowids_subquery.assert_called_once_with(
        project_rowids=[1, 2],
        start_time=start_time,
        end_time=end_time,
        lowering="probe",
    )


def _compiled_sql(stmt: Select[Any]) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()


def _assert_probe_shaped_any_and_all(compiled: str) -> None:
    """Probe renders `any` as EXISTS and `all` as NOT EXISTS, both correlated to the session.

    Scan would render `any` as an uncorrelated `id IN (SELECT session_key …)` semi-join instead.
    """
    assert "exists (select 1" in compiled
    assert "not (exists" in compiled
    assert "project_sessions.id in (select traces.project_session_rowid" not in compiled


def test_probe_lowering_keeps_mixed_any_and_all_correlated() -> None:
    compiled = _compiled_sql(
        select(models.ProjectSession.id).where(
            models.ProjectSession.id.in_(
                get_filtered_session_rowids_subquery(
                    _MIXED_ANY_AND_ALL,
                    project_rowids=[1],
                    lowering="probe",
                )
            )
        )
    )
    _assert_probe_shaped_any_and_all(compiled)


def test_scan_lowering_renders_any_as_uncorrelated_semi_join() -> None:
    compiled = _compiled_sql(
        select(models.ProjectSession.id).where(
            models.ProjectSession.id.in_(
                get_filtered_session_rowids_subquery(
                    _MIXED_ANY_AND_ALL,
                    project_rowids=[1],
                    lowering="scan",
                )
            )
        )
    )
    assert "not (exists" in compiled
    assert "project_sessions.id in (select traces.project_session_rowid" in compiled


def test_session_statistics_queries_use_probe_lowering() -> None:
    """Aside statistics wrap matching rowids in an IN predicate and have no LIMIT to protect,
    but still select probe so `all(...)` mixed with `any` stays correlated.
    """
    statements = [
        _apply_project_session_filters(
            select(models.ProjectSession),
            project_rowid=1,
            time_range=None,
            session_filter_condition=_MIXED_ANY_AND_ALL,
        ),
        record_counts._get_stmt(
            ("trace", (None, None), None, _MIXED_ANY_AND_ALL),
            1,
        ),
        span_cost_summary_by_project._get_stmt(
            ((None, None), None, _MIXED_ANY_AND_ALL),
            1,
        ),
        annotation_summaries._get_stmt(
            ("trace", 1, (None, None), None, _MIXED_ANY_AND_ALL),
            "quality",
        ),
    ]
    for stmt in statements:
        _assert_probe_shaped_any_and_all(_compiled_sql(stmt))
