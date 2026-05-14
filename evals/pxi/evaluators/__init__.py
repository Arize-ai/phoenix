"""Code evaluators for PXI experiment suites."""

from typing import Any

from evals.pxi.evaluators.tools import (
    correct_tools_called,
    set_spans_filter_args_match,
    tool_call_args_match,
)

# Registry of evaluators by name. The runner uses this to look up the
# concrete ``@create_evaluator`` objects for the names a dataset declares
# in its ``evaluators:`` field. Values are ``phoenix.evals.Evaluator``
# instances, typed as ``Any`` here to match how the runner forwards them
# into ``client.experiments.run_experiment``. Keep in sync with the
# ``@create_evaluator`` decorators in this package.
EVALUATORS_BY_NAME: dict[str, Any] = {
    "correct_tools_called": correct_tools_called,
    "tool_call_args_match": tool_call_args_match,
    "set_spans_filter_args_match": set_spans_filter_args_match,
}

__all__ = [
    "EVALUATORS_BY_NAME",
    "correct_tools_called",
    "set_spans_filter_args_match",
    "tool_call_args_match",
]
