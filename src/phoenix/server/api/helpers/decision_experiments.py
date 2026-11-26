"""Turn dataset examples into decision requests, and answers into experiment run outputs.

A decision experiment copies a :class:`DecisionTaskConfig` and reads each example the way
a prompt task does: the variables come from the object at ``template_variables_path``.
The task's questions are fixed across examples.
"""

from typing import Any

from phoenix.db import models
from phoenix.db.types.decisions import DecisionTaskConfig
from phoenix.server.api.helpers.decision_clients import DecisionRequest, DecisionResponse
from phoenix.server.api.helpers.message_helpers import build_template_variables
from phoenix.server.decisions.rendering import render_decision


def build_example_request(
    config: DecisionTaskConfig,
    *,
    input: dict[str, Any],
    output: Any,
    metadata: dict[str, Any],
) -> DecisionRequest:
    """The request one dataset example makes.

    The variables are the object at ``template_variables_path``, values keeping their JSON
    types; fields the templates don't use are ignored.

    Raises:
        ValueError: A path misses, a variable is missing, or the rendered state is
            invalid. The message says which.
    """
    try:
        source = build_template_variables(
            input_data=input,
            output_data=output,
            metadata=metadata,
            template_variables_path=config.template_variables_path,
        )
    except (KeyError, TypeError) as error:
        raise ValueError(f"Template variables: {_reason(error)}") from error
    if not isinstance(source, dict):
        raise ValueError(
            f"Template variables at {config.template_variables_path!r} are not an object"
        )
    rendered = render_decision(config.template_format, config.state, config.questions, source)
    return DecisionRequest(state=rendered.state, questions=rendered.questions)


def _reason(error: Exception) -> str:
    # KeyError's str() is the quoted message.
    return str(error.args[0]) if error.args else str(error)


def decision_run_output(response: DecisionResponse) -> models.ExperimentRunOutput:
    """An experiment run's output: the answers by question name, with no decision rule
    applied, so evaluators apply their own (a predicate's threshold, say).

    The model that answered and the usage stay on the DECISION span, so the output has
    the shape of a dataset's reference answers.
    """
    return models.ExperimentRunOutput(
        task_output={
            name: answer.model_dump(mode="json") for name, answer in response.answers.items()
        }
    )
