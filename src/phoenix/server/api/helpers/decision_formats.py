"""Read decision questions written in a provider's format into Phoenix's question types.

Datasets keep questions in the format they were published in, such as TypeSafe's
System One, and an experiment declares which format to read. Every format becomes the
same Phoenix questions, so the provider adapters are the only code that writes a
provider's format. This module is their inverse.

Phoenix question text is plain text, so a structured value (a JSON object or array, as
System One allows) is written as JSON text. Questions are not validated here; the
write-time rules in :mod:`phoenix.server.api.helpers.decision_versions` run when a
request is built.
"""

import json
from typing import Any, Mapping, Sequence, get_args

from pydantic import TypeAdapter, ValidationError

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionQuestion,
    PredicateCriteria,
    PredicateQuestion,
    QuestionFormat,
    ScaleLevel,
    ScaleQuestion,
)

QUESTION_FORMATS: tuple[QuestionFormat, ...] = get_args(QuestionFormat)

_PHOENIX_QUESTIONS: TypeAdapter[list[DecisionQuestion]] = TypeAdapter(list[DecisionQuestion])


def parse_questions(value: Any, question_format: QuestionFormat) -> list[DecisionQuestion]:
    """Read ``value`` as questions in ``question_format``, in their written order.

    Raises:
        ValueError: ``value`` is not questions in that format; the message says why.
    """
    if question_format == "phoenix":
        try:
            return _PHOENIX_QUESTIONS.validate_python(value)
        except ValidationError as error:
            raise ValueError(f"Not Phoenix questions: {error.errors()[0]['msg']}") from error
    if question_format == "system_one":
        return _from_system_one(value)
    if question_format == "openai":
        return _from_openai(value)
    raise ValueError(f"Unknown question format {question_format!r}")


def _text(value: Any) -> str:
    """Question text: a string as is, a structured value as JSON, nothing as empty."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _optional_text(value: Any) -> str | None:
    return None if value is None else _text(value)


def _from_system_one(value: Any) -> list[DecisionQuestion]:
    """System One questions: an object of named questions, typed ``noul``, ``choice``,
    or ``score``."""
    if not isinstance(value, Mapping):
        raise ValueError("System One questions must be an object keyed by question name")
    questions: list[DecisionQuestion] = []
    for name, question in value.items():
        if not isinstance(question, Mapping):
            raise ValueError(f"Question {name!r} must be an object")
        kind = question.get("type")
        instructions = _text(question.get("instructions"))
        criteria = question.get("criteria")
        if kind == "noul":
            if criteria is not None and not isinstance(criteria, Mapping):
                raise ValueError(f"Criteria for {name!r} must be an object of true and false")
            questions.append(
                PredicateQuestion(
                    type="predicate",
                    name=name,
                    instructions=instructions,
                    criteria=PredicateCriteria(
                        true=_optional_text(criteria.get("true")),
                        false=_optional_text(criteria.get("false")),
                    )
                    if criteria
                    else None,
                )
            )
        elif kind == "choice":
            if not isinstance(criteria, Mapping):
                raise ValueError(f"Criteria for {name!r} must be an object of choices")
            questions.append(
                ChoiceQuestion(
                    type="choice",
                    name=name,
                    instructions=instructions,
                    choices=[
                        ChoiceOption(value=str(choice), description=_optional_text(description))
                        for choice, description in criteria.items()
                    ],
                )
            )
        elif kind == "score":
            if not isinstance(criteria, Sequence) or isinstance(criteria, str):
                raise ValueError(f"Criteria for {name!r} must be a list of levels")
            questions.append(
                ScaleQuestion(
                    type="scale",
                    name=name,
                    instructions=instructions,
                    levels=[ScaleLevel(label=_text(level)) for level in criteria],
                )
            )
        else:
            raise ValueError(f"Question {name!r} has unsupported type {kind!r}")
    return questions


def _objects(items: Sequence[Any], what: str) -> list[Mapping[str, Any]]:
    if not all(isinstance(item, Mapping) for item in items):
        raise ValueError(f"{what} must be objects")
    return list(items)


def _from_openai(value: Any) -> list[DecisionQuestion]:
    """OpenAI Decisions questions: a list of named questions, typed ``predicate``,
    ``choice``, or ``score``."""
    if not isinstance(value, Sequence) or isinstance(value, str):
        raise ValueError("OpenAI questions must be a list")
    questions: list[DecisionQuestion] = []
    for index, question in enumerate(value):
        if not isinstance(question, Mapping):
            raise ValueError(f"Question {index} must be an object")
        name = question.get("name")
        if not isinstance(name, str):
            raise ValueError(f"Question {index} needs a name")
        kind = question.get("type")
        instructions = _text(question.get("instructions"))
        if kind == "predicate":
            questions.append(
                PredicateQuestion(type="predicate", name=name, instructions=instructions)
            )
        elif kind == "choice":
            choices = question.get("choices")
            if not isinstance(choices, Sequence) or isinstance(choices, str):
                raise ValueError(f"Choices for {name!r} must be a list")
            questions.append(
                ChoiceQuestion(
                    type="choice",
                    name=name,
                    instructions=instructions,
                    choices=[
                        ChoiceOption(
                            value=str(choice.get("value")),
                            description=_optional_text(choice.get("description")),
                        )
                        for choice in _objects(choices, f"Choices for {name!r}")
                    ],
                )
            )
        elif kind == "score":
            levels = question.get("levels")
            if not isinstance(levels, Sequence) or isinstance(levels, str):
                raise ValueError(f"Levels for {name!r} must be a list")
            questions.append(
                ScaleQuestion(
                    type="scale",
                    name=name,
                    instructions=instructions,
                    levels=[
                        ScaleLevel(
                            label=_text(level.get("label")),
                            description=_optional_text(level.get("description")),
                        )
                        for level in _objects(levels, f"Levels for {name!r}")
                    ],
                )
            )
        else:
            raise ValueError(f"Question {name!r} has unsupported type {kind!r}")
    return questions
