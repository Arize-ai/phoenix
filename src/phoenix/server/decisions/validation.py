"""Write-time rules for decision versions and custom provider compatibility.

The stored types in :mod:`phoenix.db.types.decisions` only describe structure, because
they are validated on every read. These rules apply when a version is accepted, by a
run or a save, and can change without making stored rows unreadable.
"""

from __future__ import annotations

from typing import Sequence

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
from phoenix.db.types.model_provider import model_provider_from_sdk, sdk_offers_decisions
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.decisions.rendering import decision_variables

# Both providers document 2 to 255 choices (TypeSafe at https://docs.typesafe.ai/api,
# OpenAI in its SDK's request types). The 2 to 10 levels are TypeSafe's; OpenAI documents
# no level limit. Neither documents a limit on the number of questions, so there is none
# here: request size and context length are the provider's to enforce.
MIN_CHOICES, MAX_CHOICES = 2, 255
MIN_LEVELS, MAX_LEVELS = 2, 10


def validate_questions(questions: Sequence[DecisionQuestion]) -> None:
    """Check questions being accepted for a run or a save.

    Raises:
        ValueError: The questions are empty, or a question breaks a rule; the message
            names the question.
    """
    if not questions:
        raise ValueError("At least one question is required")
    names: set[str] = set()
    for question in questions:
        name = question.name
        if not name.strip():
            raise ValueError("Question names cannot be empty")
        if name in names:
            raise ValueError(f"Question names must be unique: {name!r} is repeated")
        names.add(name)
        if not question.instructions.strip():
            raise ValueError(f"Instructions for {name} cannot be empty")
        if isinstance(question, ChoiceQuestion):
            values = [option.value for option in question.choices]
            if not MIN_CHOICES <= len(values) <= MAX_CHOICES:
                raise ValueError(f"{name} needs {MIN_CHOICES} to {MAX_CHOICES} choices")
            if any(not value.strip() for value in values):
                raise ValueError(f"Choice values for {name} cannot be empty")
            if len(set(values)) != len(values):
                raise ValueError(f"Choice values for {name} must be unique")
        elif isinstance(question, ScaleQuestion):
            if not MIN_LEVELS <= len(question.levels) <= MAX_LEVELS:
                raise ValueError(f"{name} needs {MIN_LEVELS} to {MAX_LEVELS} levels")
            if any(not level.label.strip() for level in question.levels):
                raise ValueError(f"Level labels for {name} cannot be empty")


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
        ValueError: A text template is empty, a JSON template is a literal number, boolean
            or null or an empty string, or a template can't be parsed.
    """
    if isinstance(state, TextState):
        if not state.template.strip():
            raise ValueError("The state template cannot be empty")
    elif isinstance(state, JsonState):
        template = state.template
        if isinstance(template, str):
            if not template.strip():
                raise ValueError("The state template cannot be empty")
        elif not isinstance(template, (dict, list)):
            raise ValueError("A JSON state template must be an object, a list, or a string")
    else:
        assert_never(state)
    return decision_variables(template_format, state, questions)


async def validate_decision_custom_provider(
    session: AsyncSession, version: models.DecisionVersion
) -> None:
    """Reject a custom provider that is missing, serves no decision models, or speaks another
    API than the version's provider."""
    if (provider_id := version.custom_provider_id) is None:
        return
    provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
    global_id = GlobalID("GenerativeModelCustomProvider", str(provider_id))
    if provider is None:
        raise NotFound(f"Custom provider not found: {global_id}")
    if not sdk_offers_decisions(provider.sdk):
        raise BadRequest(f"Custom provider '{provider.name}' does not serve decision models.")
    provider_model_provider = model_provider_from_sdk(provider.sdk)
    if provider_model_provider is not version.model_provider:
        raise BadRequest(
            f"Custom provider '{provider.name}' speaks the {provider_model_provider.name} API, not "
            f"{version.model_provider.name}."
        )
