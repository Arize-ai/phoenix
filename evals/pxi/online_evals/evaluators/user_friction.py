"""Online `user_friction` evaluator: the built-in phoenix-evals judge over PXI turns.

Judges whether the turn's (human) user message expresses friction with the
assistant's preceding behavior. The conversation history is reconstructed
from the turn's own last LLM span (the history the agent itself saw),
rendered in two tiers (compact prior turns, detailed reacted-to turn), and
passed to the built-in :class:`UserFrictionEvaluator` from phoenix-evals.

The judge provider/model is the shared PXI online judge configuration (see
:mod:`evals.pxi.online_evals.judge`).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from functools import lru_cache

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals import judge
from evals.pxi.online_evals.conversation import Turn, segment_turns, transcript
from evals.pxi.online_evals.message_origin import is_human_message
from evals.pxi.online_evals.models import EvaluatorSpec
from evals.pxi.online_evals.rendering import render_conversation
from evals.pxi.online_evals.topology import PXI_TURN_ROOT_NAME

logger = logging.getLogger(__name__)

MAX_JUDGE_INPUT_CHARS = 50_000


@lru_cache(maxsize=1)
def _judge():  # type: ignore[no-untyped-def]  # heavy import deferred
    from phoenix.evals.metrics import UserFrictionEvaluator

    return UserFrictionEvaluator(llm=judge.judge_llm())


def _target_turn(root: v1.Span, turns: Sequence[Turn]) -> Turn | None:
    """The turn being labeled: the transcript's final turn — this trace's own.

    The final turn's user message must be human-authored
    (:func:`is_human_message`); injected non-human user-role messages are not
    evaluable, and falling back to an earlier human turn would attach a
    judgment about a previous trace's message to this root. Sanity-checked
    against the root span's ``input.value`` (the turn's user message as
    ingested); a missing value or mismatch disqualifies the turn so a
    judgment is never checkpointed on the wrong root.
    """
    if not turns:
        return None
    target = turns[-1]
    if not is_human_message(target.user_message):
        return None
    root_input = root.get("attributes", {}).get("input.value")
    if not isinstance(root_input, str) or root_input.strip() != target.user_message.strip():
        logger.warning(
            "user_friction: skipping trace %s because transcript target differs from "
            "root input.value",
            root.get("context", {}).get("trace_id"),
        )
        return None
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
    if len(conversation) + len(target.user_message) > MAX_JUDGE_INPUT_CHARS:
        logger.warning(
            "user_friction: skipping trace %s because rendered input exceeds %s characters",
            root.get("context", {}).get("trace_id"),
            MAX_JUDGE_INPUT_CHARS,
        )
        return None
    return conversation, target.user_message


async def evaluate_user_friction(root: v1.Span, spans: Sequence[v1.Span]) -> Score | None:
    inputs = _judge_inputs(root, spans)
    if inputs is None:
        return None
    conversation, user_message = inputs
    scores: list[Score] = await _judge().async_evaluate(
        {"conversation": conversation, "user_message": user_message}
    )
    if not scores or scores[0].score is None:
        raise RuntimeError("user_friction judge returned no score")
    return scores[0]


USER_FRICTION = EvaluatorSpec(
    name="user_friction",
    root_span_name=PXI_TURN_ROOT_NAME,
    evaluate=evaluate_user_friction,
    annotator_kind="LLM",
    sample_rate=1.0,
    identifier="pxi-online-evals:user-friction:v1",
)
