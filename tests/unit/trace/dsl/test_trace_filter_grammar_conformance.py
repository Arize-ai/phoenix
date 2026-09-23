import pytest

from phoenix.trace.dsl import TraceFilter
from tests.unit.trace.dsl.trace_filter_reference import FIXTURE_TRACES, matching_trace_ids

OUT_OF_GRAMMAR_CONDITIONS = (
    pytest.param("True", id="bare-boolean"),
    pytest.param(
        'start_time >= "2026-07-01T12:00:00"',
        id="naive-datetime-literal",
    ),
    pytest.param("error_count // 2 >= 0", id="floor-division"),
    pytest.param('int(attributes["retry_count"]) > 1', id="int-cast"),
    pytest.param(
        "any(d.is_prompt is True for d in span_cost_details)",
        id="identity-with-non-none",
    ),
)


@pytest.mark.parametrize("condition", OUT_OF_GRAMMAR_CONDITIONS)
def test_trace_filter_reference_rejects_out_of_grammar_condition(condition: str) -> None:
    with pytest.raises(SyntaxError):
        matching_trace_ids(condition, FIXTURE_TRACES)


@pytest.mark.parametrize("condition", OUT_OF_GRAMMAR_CONDITIONS)
def test_trace_filter_compiler_rejects_out_of_grammar_condition(condition: str) -> None:
    with pytest.raises(SyntaxError):
        TraceFilter(condition)
