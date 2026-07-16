"""Offline `user_friction` evaluator: the built-in phoenix-evals judge over PXI turns.

Judges whether the turn's (human) user message expresses friction with the
assistant's preceding behavior. The conversation history is reconstructed
from the turn's own last LLM span (the history the agent itself saw), rendered
with the canonical two-tier rendering from the user-friction validation work,
and passed to the built-in :class:`UserFrictionEvaluator` from phoenix-evals.

Model choice: GPT-5.5 (best available cost/quality from the v0.5 judge sweep
after Claude Opus; selected 2026-07-16). Override with the
``PXI_USER_FRICTION_PROVIDER`` / ``PXI_USER_FRICTION_MODEL`` env vars.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from functools import lru_cache

from phoenix.client.__generated__ import v1

from evals.pxi.offline_evals.conversation import Turn, segment_turns, transcript
from evals.pxi.offline_evals.message_origin import classify_user_message
from evals.pxi.offline_evals.models import EvaluationResult, EvaluatorSpec
from evals.pxi.offline_evals.rendering import render_conversation
from evals.pxi.offline_evals.topology import PXI_TURN_ROOT_NAME
from phoenix.db.types.annotation_configs import OptimizationDirection

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-5.5"
_PROVIDER_ENV_KEYS = {
    "openai": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
    "google": ("GOOGLE_GENERATIVE_AI_API_KEY",),
}


def _provider() -> str:
    return os.getenv("PXI_USER_FRICTION_PROVIDER") or DEFAULT_PROVIDER


def _model() -> str:
    return os.getenv("PXI_USER_FRICTION_MODEL") or DEFAULT_MODEL


def required_env() -> tuple[str, ...]:
    return _PROVIDER_ENV_KEYS.get(_provider(), ())


@lru_cache(maxsize=1)
def _judge():  # type: ignore[no-untyped-def]  # heavy import deferred
    from phoenix.evals.llm import LLM
    from phoenix.evals.metrics import UserFrictionEvaluator

    return UserFrictionEvaluator(llm=LLM(provider=_provider(), model=_model()))


def _target_turn(root: v1.Span, turns: Sequence[Turn]) -> Turn | None:
    """The turn being labeled: the last human user turn in the transcript.

    Sanity-checked against the root span's ``input.value`` (the turn's user
    message as ingested); a mismatch is logged but does not disqualify the
    turn, since the transcript is the judge-facing source of truth.
    """
    target: Turn | None = None
    for turn in turns:
        if classify_user_message(turn.user_message).is_human:
            target = turn
    if target is None:
        return None
    root_input = root.get("attributes", {}).get("input.value")
    if isinstance(root_input, str) and root_input.strip() != target.user_message.strip():
        logger.warning(
            "user_friction: transcript target differs from root input.value (trace %s)",
            root.get("context", {}).get("trace_id"),
        )
    return target


def _judge_inputs(root: v1.Span, spans: Sequence[v1.Span]) -> tuple[str, str] | None:
    """Build (conversation, user_message) for the judge, or None if not applicable.

    Not applicable when the trace has no reconstructable transcript, the turn's
    user message is not human-authored, or there is no preceding human turn to
    react to (a first message has no assistant behavior to express friction
    with — trivially no_friction, not worth an LLM call).
    """
    turns = segment_turns(transcript(spans))
    if not turns:
        return None
    target = _target_turn(root, turns)
    if target is None:
        return None
    conversation = render_conversation(list(turns), target.index)
    if not conversation.strip():
        return None
    return conversation, target.user_message


def applies_to_user_friction(root: v1.Span, spans: Sequence[v1.Span]) -> bool:
    return _judge_inputs(root, spans) is not None


def evaluate_user_friction(root: v1.Span, spans: Sequence[v1.Span]) -> EvaluationResult | None:
    inputs = _judge_inputs(root, spans)
    if inputs is None:
        return None
    conversation, user_message = inputs
    scores = _judge().evaluate({"conversation": conversation, "user_message": user_message})
    if not scores or scores[0].score is None:
        raise RuntimeError("user_friction judge returned no score")
    score = scores[0]
    return EvaluationResult(
        score=float(score.score),
        explanation=score.explanation,
        metadata={"label": score.label, "model": _model(), "provider": _provider()},
    )


USER_FRICTION = EvaluatorSpec(
    name="user_friction",
    target="trace",
    root_span_name=PXI_TURN_ROOT_NAME,
    evaluate=evaluate_user_friction,
    applies_to=applies_to_user_friction,
    annotator_kind="LLM",
    sample_rate=1.0,
    optimization_direction=OptimizationDirection.MINIMIZE,
    required_env_fn=required_env,
)
