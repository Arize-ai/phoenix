"""Decision version tags through which decision evaluators record the version they run."""

from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import Conflict
from phoenix.server.api.helpers.decision_evaluator_service import _signature


async def _lock_decision_evaluators(
    session: AsyncSession, tag_id: int
) -> Sequence[models.DecisionEvaluator]:
    """Lock the decision evaluators that run through the tag, in id order, and reload them so
    the caller sees whatever a transaction it waited on committed."""
    return (
        await session.scalars(
            select(models.DecisionEvaluator)
            .where(models.DecisionEvaluator.decision_version_tag_id == tag_id)
            .order_by(models.DecisionEvaluator.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).all()


def _describe(evaluators: Sequence[models.DecisionEvaluator]) -> tuple[str, str]:
    noun = "evaluator" if len(evaluators) == 1 else "evaluators"
    names = ", ".join(
        f"'{e.name.root}' ({GlobalID('DecisionEvaluator', str(e.id))})" for e in evaluators
    )
    return noun, names


async def validate_decision_version_tag_move(
    session: AsyncSession,
    tag: models.DecisionVersionTag,
    version: models.DecisionVersion,
) -> None:
    """Let a tag that a decision evaluator runs through move only to a version with the same
    inputs and outputs.

    Moving the tag from the decision side changes what the evaluator runs without adapting its
    scoring policy or checking its bindings, so any change to input names, question names,
    types, choices, or scale levels is refused with Conflict naming the evaluators; those
    changes go through the evaluator itself. Tags no evaluator uses move freely.

    Call it before every write to an existing tag: the tag's version is reread under the
    evaluator lock, since an evaluator edit may have moved it.
    """
    # Tag moves and evaluator edits lock the evaluator rows first, so each validates against
    # the other's committed state.
    evaluators = await _lock_decision_evaluators(session, tag.id)
    if not evaluators:
        return
    await session.refresh(tag, attribute_names=["decision_version_id"])
    if tag.decision_version_id == version.id:
        return
    current = await session.get(models.DecisionVersion, tag.decision_version_id)
    assert current is not None
    if _signature(current) != _signature(version):
        noun, names = _describe(evaluators)
        pronoun = "it" if len(evaluators) == 1 else "them"
        raise Conflict(
            f"Tag '{tag.name.root}' records the decision version of {noun} {names}; "
            f"changing inputs, question names, types, choices, or scale levels would break "
            f"{pronoun}. Edit the {noun}, or create a new evaluator from this version"
        )
    now = datetime.now(timezone.utc)
    for evaluator in evaluators:
        evaluator.updated_at = now


async def validate_decision_version_tag_delete(
    session: AsyncSession,
    tag: models.DecisionVersionTag,
) -> None:
    """Refuse to delete a tag that a decision evaluator runs through.

    Raises Conflict naming the evaluators; tags no evaluator uses delete freely. Call it before
    deleting the tag, in the same transaction.
    """
    # Locks the evaluator rows first, as tag moves and evaluator edits do.
    evaluators = await _lock_decision_evaluators(session, tag.id)
    if not evaluators:
        return
    noun, names = _describe(evaluators)
    raise Conflict(
        f"Tag '{tag.name.root}' records the decision version of {noun} {names}, "
        f"so it cannot be deleted; delete the {noun} first"
    )
