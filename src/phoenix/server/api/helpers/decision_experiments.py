"""Turn dataset examples into decision requests, and answers into experiment run outputs.

A decision experiment copies a :class:`DecisionTaskConfig` and reads each example the way
a prompt task does: input values come from ``input_values_path``, as template variables
come from ``template_variables_path``. The task's questions are fixed across examples.
"""

from typing import Any

from phoenix.db.types.decisions import DecisionTaskConfig
from phoenix.server.api.helpers.decision_clients import DecisionRequest, DecisionResponse
from phoenix.server.api.helpers.decision_versions import render_state
from phoenix.server.api.helpers.message_helpers import build_template_variables


def build_example_request(
    config: DecisionTaskConfig,
    *,
    input: dict[str, Any],
    output: Any,
    metadata: dict[str, Any],
) -> DecisionRequest:
    """The request one dataset example makes.

    Only the declared inputs are read from the object at ``input_values_path``, so an
    example may carry other fields beside them.

    Raises:
        ValueError: A path misses, a declared input is missing, or the rendered state is
            invalid. The message says which.
    """
    try:
        source = build_template_variables(
            input_data=input,
            output_data=output,
            metadata=metadata,
            template_variables_path=config.input_values_path,
        )
    except (KeyError, TypeError) as error:
        raise ValueError(f"Input values: {_reason(error)}") from error
    if not isinstance(source, dict):
        raise ValueError(f"Input values at {config.input_values_path!r} are not an object")
    names = [declared.name for declared in config.inputs]
    state = render_state(
        config.inputs, config.state, {name: source[name] for name in names if name in source}
    )
    return DecisionRequest(state=state, questions=config.questions)


def _reason(error: Exception) -> str:
    # KeyError's str() is the quoted message.
    return str(error.args[0]) if error.args else str(error)


def decision_run_output(response: DecisionResponse) -> dict[str, Any]:
    """An experiment run's output: the answers by question name, with no decision rule
    applied, so evaluators apply their own (a predicate's threshold, say).

    The model that answered and the usage stay on the DECISION span, so the output has
    the shape of a dataset's reference answers.
    """
    return {
        "task_output": {
            name: answer.model_dump(mode="json") for name, answer in response.answers.items()
        }
    }
