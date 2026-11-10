"""Write-time rules for decision versions and custom provider compatibility.

The stored types in :mod:`phoenix.db.types.decisions` only describe structure, because
they are validated on every read. These rules apply when a version is accepted, by a
run or a save, and can change without making stored rows unreadable.
"""

from __future__ import annotations

from typing import Sequence, Union

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionQuestion,
    DecisionState,
    JsonState,
    ScaleQuestion,
    TextState,
)
from phoenix.db.types.model_provider import model_provider_from_sdk
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.decisions.rendering import decision_variables

# Both providers document 2 to 255 choices (TypeSafe at https://docs.typesafe.ai/api,
# OpenAI in its SDK's request types). The 2 to 10 levels are TypeSafe's; OpenAI documents
# no level limit. Neither documents a limit on the number of questions, so there is none
# here: request size and context length are the provider's to enforce.
MIN_CHOICES, MAX_CHOICES = 2, 255
MIN_LEVELS, MAX_LEVELS = 2, 10


FieldPath = tuple[Union[str, int], ...]


class DecisionRuleError(ValueError):
    """A write-time rule a version breaks, and where.

    ``path`` locates the offending input within the version, e.g. ``("questions", 1,
    "choices")``, so an API can point at the field. ``code`` is a short kind of failure:
    ``too_short``, ``out_of_range``, or ``invalid``.
    """

    def __init__(self, message: str, path: FieldPath, code: str = "invalid") -> None:
        super().__init__(message)
        self.path = path
        self.code = code


def validate_questions(questions: Sequence[DecisionQuestion]) -> None:
    """Check questions being accepted for a run or a save.

    Raises:
        DecisionRuleError: The questions are empty, or a question breaks a rule; the
            message names the question and the error's path locates it.
    """
    if not questions:
        raise DecisionRuleError("At least one question is required", ("questions",), "too_short")
    names: set[str] = set()
    for index, question in enumerate(questions):
        at: FieldPath = ("questions", index)
        name = question.name
        if not name.strip():
            raise DecisionRuleError("Question names cannot be empty", (*at, "name"), "too_short")
        if name in names:
            raise DecisionRuleError(
                f"Question names must be unique: {name!r} is repeated", (*at, "name")
            )
        names.add(name)
        if not question.instructions.strip():
            raise DecisionRuleError(
                f"Instructions for {name} cannot be empty", (*at, "instructions"), "too_short"
            )
        if isinstance(question, ChoiceQuestion):
            values = [option.value for option in question.choices]
            if not MIN_CHOICES <= len(values) <= MAX_CHOICES:
                raise DecisionRuleError(
                    f"{name} needs {MIN_CHOICES} to {MAX_CHOICES} choices",
                    (*at, "choices"),
                    "out_of_range",
                )
            for choice_index, value in enumerate(values):
                if not value.strip():
                    raise DecisionRuleError(
                        f"Choice values for {name} cannot be empty",
                        (*at, "choices", choice_index, "value"),
                        "too_short",
                    )
            if len(set(values)) != len(values):
                raise DecisionRuleError(
                    f"Choice values for {name} must be unique", (*at, "choices")
                )
        elif isinstance(question, ScaleQuestion):
            if not MIN_LEVELS <= len(question.levels) <= MAX_LEVELS:
                raise DecisionRuleError(
                    f"{name} needs {MIN_LEVELS} to {MAX_LEVELS} levels",
                    (*at, "levels"),
                    "out_of_range",
                )
            for level_index, level in enumerate(question.levels):
                if not level.label.strip():
                    raise DecisionRuleError(
                        f"Level labels for {name} cannot be empty",
                        (*at, "levels", level_index, "label"),
                        "too_short",
                    )


def validate_template(
    template_format: PromptTemplateFormat,
    state: DecisionState,
    questions: Sequence[DecisionQuestion],
) -> list[str]:
    """Check a version's state template and the templates in its questions.

    Variables are derived from the templates, so there is no list of inputs to check them
    against; a call that leaves one out fails when it renders.

    Returns:
        The decision's variables, in first-appearance order.

    Raises:
        DecisionRuleError: A text template is empty, a JSON template is a literal number,
            boolean or null or an empty string, or a template can't be parsed.
    """
    state_path: FieldPath = ("state", "template")
    if isinstance(state, TextState):
        if not state.template.strip():
            raise DecisionRuleError("The state template cannot be empty", state_path, "too_short")
    elif isinstance(state, JsonState):
        template = state.template
        if isinstance(template, str):
            if not template.strip():
                raise DecisionRuleError(
                    "The state template cannot be empty", state_path, "too_short"
                )
        elif not isinstance(template, (dict, list)):
            raise DecisionRuleError(
                "A JSON state template must be an object, a list, or a string", state_path
            )
    else:
        assert_never(state)
    try:
        return decision_variables(template_format, state, questions)
    except ValueError as error:
        raise DecisionRuleError(
            str(error), _unparseable_template_path(template_format, state, questions)
        ) from error


def _unparseable_template_path(
    template_format: PromptTemplateFormat,
    state: DecisionState,
    questions: Sequence[DecisionQuestion],
) -> FieldPath:
    """Which part of the version holds the template that failed to parse."""
    try:
        decision_variables(template_format, state, ())
    except ValueError:
        return ("state", "template")
    for index, question in enumerate(questions):
        try:
            decision_variables(template_format, state, (question,))
        except ValueError:
            return ("questions", index)
    return ()


def custom_provider_without_decisions_error(provider_name: str) -> BadRequest:
    return BadRequest(
        f"Custom provider '{provider_name}' is not set up for decision models. Turn on "
        "Decision models for it under Settings > AI Providers, or choose another provider."
    )


async def validate_decision_custom_provider(
    session: AsyncSession, version: models.DecisionVersion
) -> None:
    """Reject a custom provider that is missing, does not serve decision models, or
    mismatches ``version.model_provider``."""
    if (provider_id := version.custom_provider_id) is None:
        return
    provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
    global_id = GlobalID("GenerativeModelCustomProvider", str(provider_id))
    if provider is None:
        raise NotFound(f"Custom provider not found: {global_id}")
    if provider.models.decision is None:
        raise custom_provider_without_decisions_error(provider.name)
    provider_model_provider = model_provider_from_sdk(provider.sdk)
    if provider_model_provider is not version.model_provider:
        raise BadRequest(
            f"Custom provider '{provider.name}' saves decisions with model provider "
            f"{provider_model_provider.name}, not {version.model_provider.name}."
        )
