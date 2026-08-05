"""Code evaluators for PXI experiment suites."""

from typing import Any

from evals.pxi.evaluators.links import documentation_links_valid, in_app_links_valid
from evals.pxi.evaluators.text import assistant_text_substrings_match
from evals.pxi.evaluators.tools import (
    bash_command_substrings_match,
    correct_tools_called,
    documentation_tools_used,
    forbidden_tool_call_args_match,
    tool_call_args_match,
    tool_call_count_within_limit,
)

# Registry of evaluators by name. The runner uses this to look up the
# concrete ``@create_evaluator`` objects for the names a dataset declares
# in its ``evaluators:`` field. Values are ``phoenix.evals.Evaluator``
# instances, typed as ``Any`` here to match how the runner forwards them
# into ``client.experiments.run_experiment``. Keep in sync with the
# ``@create_evaluator`` decorators in this package.
EVALUATORS_BY_NAME: dict[str, Any] = {
    "assistant_text_substrings_match": assistant_text_substrings_match,
    "bash_command_substrings_match": bash_command_substrings_match,
    "correct_tools_called": correct_tools_called,
    "documentation_links_valid": documentation_links_valid,
    "documentation_tools_used": documentation_tools_used,
    "forbidden_tool_call_args_match": forbidden_tool_call_args_match,
    "in_app_links_valid": in_app_links_valid,
    "tool_call_args_match": tool_call_args_match,
    "tool_call_count_within_limit": tool_call_count_within_limit,
}

__all__ = [
    "EVALUATORS_BY_NAME",
    "assistant_text_substrings_match",
    "bash_command_substrings_match",
    "correct_tools_called",
    "documentation_links_valid",
    "documentation_tools_used",
    "forbidden_tool_call_args_match",
    "in_app_links_valid",
    "tool_call_args_match",
    "tool_call_count_within_limit",
]
