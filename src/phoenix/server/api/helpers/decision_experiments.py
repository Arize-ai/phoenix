"""Turn dataset examples into decision requests, and answers into experiment run outputs.

A decision experiment freezes a :class:`DecisionTaskConfig`. Each example's state is
built exactly as a saved decision's is: the input mapping reads values from the
example's evaluation context and the state renders them. Questions are the config's own,
or read from the example in a declared format.
"""

import json
import re
from typing import Any, Mapping

from pydantic import ValidationError

from phoenix.db.types.decisions import DecisionTaskConfig, FixedQuestions
from phoenix.db.types.evaluators import InputMapping, validate_jsonpath
from phoenix.server.api.evaluators import apply_input_mapping
from phoenix.server.api.helpers.decision_clients import DecisionRequest, DecisionResponse
from phoenix.server.api.helpers.decision_formats import parse_questions
from phoenix.server.api.helpers.decision_versions import render_state


def build_example_request(
    config: DecisionTaskConfig, context: Mapping[str, Any]
) -> DecisionRequest:
    """The request one example makes, from its evaluation context.

    Raises:
        ValueError: The example lacks a mapped value, its questions can't be read, or
            the request breaks a write-time rule. The message says which.
    """
    context = dict(context)
    values = apply_input_mapping(
        input_schema={}, input_mapping=config.input_mapping, context=context
    )
    state = render_state(config.inputs, config.state, values)
    if isinstance(config.questions, FixedQuestions):
        questions = config.questions.questions
    else:
        (raw_questions,) = apply_input_mapping(
            input_schema={},
            input_mapping=InputMapping(
                literal_mapping={}, path_mapping={"questions": config.questions.path}
            ),
            context=context,
        ).values()
        questions = parse_questions(raw_questions, config.questions.format)
    try:
        return DecisionRequest(state=state, questions=questions)
    except ValidationError as error:
        raise ValueError(error.errors()[0]["msg"].removeprefix("Value error, ")) from error


def decision_run_output(response: DecisionResponse) -> dict[str, Any]:
    """An experiment run's output: the answers by question name, with no decision rule
    applied, so scores can be recomputed under other settings without asking again.

    Usage stays on the DECISION span.
    """
    return {
        "task_output": {
            "model": response.model,
            "answers": {
                name: answer.model_dump(mode="json") for name, answer in response.answers.items()
            },
        }
    }


QUESTION_PLACEHOLDER = "{question}"
_PLACEHOLDER_SEGMENT = re.compile(r"\.?\{question\}")


def reference_path(template: str, question_name: str) -> str:
    """The path to one question's reference: ``{question}`` in the template becomes the
    name as a quoted segment, so any question name is a valid path."""
    segment = f"[{json.dumps(question_name)}]"
    return _PLACEHOLDER_SEGMENT.sub(lambda _: segment, template)


def validate_reference_template(template: str) -> None:
    """Check a reference path template before anything runs.

    Raises:
        ValueError: The template does not name the question, or is not a valid path.
    """
    if QUESTION_PLACEHOLDER not in template:
        raise ValueError(
            f"A reference path must contain {QUESTION_PLACEHOLDER}, such as "
            f"reference.{QUESTION_PLACEHOLDER}.label"
        )
    validate_jsonpath(reference_path(template, "question"))
