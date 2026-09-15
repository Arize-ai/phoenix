"""The comparison table's generated predicates work at every annotation grain."""

from ast import unparse
from typing import Union

import pytest

from phoenix.trace.dsl.filter import SpanFilter
from phoenix.trace.dsl.session_filter import SessionFilter
from phoenix.trace.dsl.trace_filter import TraceFilter


@pytest.mark.parametrize(
    "filter_type,accessor",
    [
        (SpanFilter, "annotations"),
        (TraceFilter, "trace_annotations"),
        (SessionFilter, "session_annotations"),
    ],
)
@pytest.mark.parametrize(
    "expression,operator",
    [
        ("score >= 0.5", ">= 0.5"),
        ("score <= 0.5", "<= 0.5"),
        ("score < 0.5", "< 0.5"),
        ("score > 0.5", "> 0.5"),
        ('label == "harmful"', "== 'harmful'"),
        ("score is not None", "!= None"),
        ("label is not None", "!= None"),
    ],
)
def test_compare_bin_predicate(
    filter_type: Union[type[SpanFilter], type[TraceFilter], type[SessionFilter]],
    accessor: str,
    expression: str,
    operator: str,
) -> None:
    compiled = filter_type(f"{accessor}['A'].{expression}")
    assert operator in unparse(compiled.translated)
    assert [relation.name for relation in compiled._aliased_annotation_relations] == ["A"]


@pytest.mark.parametrize(
    "filter_type,accessor",
    [
        (SpanFilter, "annotations"),
        (TraceFilter, "trace_annotations"),
        (SessionFilter, "session_annotations"),
    ],
)
def test_compare_fold_and_shared_population(
    filter_type: Union[type[SpanFilter], type[TraceFilter], type[SessionFilter]], accessor: str
) -> None:
    label = f"{accessor}['A'].label"
    compiled = filter_type(
        f"({label} is not None and {label} != 'x' and {label} != 'y') "
        f"and ({accessor}['B'].score is not None or {accessor}['B'].label is not None)"
    )
    translated = unparse(compiled.translated)
    assert "!= 'x'" in translated and "!= 'y'" in translated
    assert "or_(" in translated and "and_(" in translated
    assert [relation.name for relation in compiled._aliased_annotation_relations] == ["A", "B"]
