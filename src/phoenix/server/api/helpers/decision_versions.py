"""Building new decision versions and copying a decision's version history.

Shared by the REST and GraphQL APIs, so both accept the same versions. Tag writes are in
:mod:`phoenix.server.api.helpers.decision_version_tags`.
"""

from typing import Any, Mapping, Optional, Sequence, Union

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.db import models
from phoenix.db.types.decisions import DecisionQuestion, DecisionState
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.exceptions import BadRequest, Conflict


class InvalidDecisionVersion(BadRequest):
    """A version that breaks a write-time rule, with where it breaks it.

    ``path`` locates the input within the version (``("questions", 1, "choices")``) and
    ``code`` names the kind of failure, so the REST API can report the field.
    """

    def __init__(self, message: str, path: tuple[Union[str, int], ...], code: str) -> None:
        super().__init__(message)
        self.path = path
        self.code = code


def new_decision_version(
    *,
    template_format: PromptTemplateFormat,
    state: DecisionState,
    questions: Sequence[DecisionQuestion],
    model_provider: ModelProvider,
    model_name: str,
    custom_provider_id: Optional[int],
    description: Optional[str],
    metadata: Mapping[str, Any],
    user_id: Optional[int],
) -> models.DecisionVersion:
    """An unsaved version, checked against the write-time rules a run uses.

    Both the REST and GraphQL APIs build versions here, so they accept the same ones. The
    caller assigns the decision and checks the custom provider in its transaction.

    Raises:
        InvalidDecisionVersion: The provider offers no decision models, the model name is
            empty, or the state template or questions break a rule.
    """
    from phoenix.server.api.helpers.client_registry import CLIENT_REGISTRY
    from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
    from phoenix.server.decisions.validation import (
        DecisionRuleError,
        validate_questions,
        validate_template,
    )

    provider_key = GenerativeProviderKey.from_model_provider(model_provider)
    if not CLIENT_REGISTRY.offers(provider_key, "decision"):
        raise InvalidDecisionVersion(
            f"{provider_key.value} does not offer decision models.",
            ("model_provider",),
            "invalid_choice",
        )
    if not (stripped_model_name := model_name.strip()):
        raise InvalidDecisionVersion(
            "A decision model name is required.", ("model_name",), "too_short"
        )
    try:
        validate_template(template_format, state, questions)
        validate_questions(questions)
    except DecisionRuleError as error:
        raise InvalidDecisionVersion(str(error), error.path, error.code) from error
    return models.DecisionVersion(
        description=description,
        user_id=user_id,
        template_format=template_format,
        state=state,
        questions=list(questions),
        model_provider=model_provider,
        model_name=stripped_model_name,
        custom_provider_id=custom_provider_id,
        metadata_=dict(metadata),
    )


_COPIED_VERSION_FIELDS = (
    "description",
    "user_id",
    "template_format",
    "state",
    "questions",
    "model_provider",
    "model_name",
    "custom_provider_id",
    "metadata_",
)


async def clone_decision(
    session: AsyncSession,
    source: models.Decision,
    *,
    name: Identifier,
    description: Optional[str],
    metadata: Mapping[str, Any],
    user_id: Optional[int],
) -> models.Decision:
    """Copy a decision and its version history, keeping each version's author.

    Tags are not copied: they name releases of the source decision.

    Raises:
        Conflict: A decision with ``name`` already exists.
    """
    versions = (
        await session.scalars(
            select(models.DecisionVersion)
            .where(models.DecisionVersion.decision_id == source.id)
            .order_by(models.DecisionVersion.id)
        )
    ).all()
    decision = models.Decision(
        name=name,
        source_decision_id=source.id,
        description=description,
        metadata_=dict(metadata),
        user_id=user_id,
        decision_versions=[
            models.DecisionVersion(
                **{field: getattr(version, field) for field in _COPIED_VERSION_FIELDS}
            )
            for version in versions
        ],
    )
    try:
        async with session.begin_nested():
            session.add(decision)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise Conflict(f"A decision named '{name}' already exists") from error
    return decision
