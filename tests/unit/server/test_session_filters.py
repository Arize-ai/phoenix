import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.session_filters import (
    SessionFilterConditionError,
    apply_session_filter_to_page,
    compile_session_filter,
    get_filtered_session_rowids_subquery,
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
