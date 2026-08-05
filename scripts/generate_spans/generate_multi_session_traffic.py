"""Many conversational sessions spread across users and time.

`large-session` stresses one session with many turns; this scenario is the other axis — a
population of sessions with realistic shape, so the session list has something to sort,
filter, and paginate. Sessions vary in length (most are short, a few run long), belong to
recurring users, and are backdated so session duration and recency are meaningful.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import timedelta

from opentelemetry.trace import StatusCode

try:
    from ._shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        probability,
        random_status,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        probability,
        random_status,
        utc_now,
    )

# Real instrumentation records why a span failed. An ERROR with no message and no recorded
# exception renders as a red span with no explanation, which is both unrealistic and useless
# for judging how the UI presents failures.
FAILURE_REASONS = (
    "upstream model returned 429 after 3 retries",
    "request exceeded the 30s deadline",
    "connection reset by the model provider",
    "response failed schema validation",
)

# Paired so a session reads as a coherent conversation rather than random turns.
EXCHANGES = (
    ("What changed in the last deploy?", "The retry policy moved from 3 attempts to 5."),
    ("Did that affect latency?", "p95 rose from 240ms to 310ms starting at the same time."),
    ("Which endpoint regressed most?", "The span ingestion endpoint, by roughly 70ms at p95."),
    ("Can we roll back just that change?", "Yes — it is isolated to one config value."),
    ("Draft the incident summary.", "Draft ready: cause, impact, and the rollback plan."),
    ("Who should review it?", "The on-call engineer and the service owner."),
    ("Any similar past incidents?", "One in March with the same retry-amplification shape."),
    ("Close this out for me.", "Closed, with the rollback linked to the incident."),
)


# A user's experience has to be stable across every session they appear in, or per-user
# analysis is just noise: the same person must behave the same way each time. Deriving the
# cohort from the user index rather than drawing it per session is what makes that true.
# Roughly one user in six is on a degraded path (older client, worse network), and one in six
# has an unusually clean one.
def _user_error_scale(user_index: int) -> float:
    if user_index % 6 == 0:
        return 3.0
    if user_index % 6 == 3:
        return 0.4
    return 1.0


# Most sessions are short, with a long tail that keeps pagination and duration sorting honest.
# Buckets rather than fixed lengths: weighting individual values left holes at 4, 6, 7, 9-12
# and 14-20, so a turn-count histogram showed spikes with gaps and range filters returned
# nothing for most spans. Each entry is (low, high, weight) and the length is uniform inside.
TURN_BUCKETS = ((1, 1, 30), (2, 3, 38), (4, 7, 20), (8, 13, 9), (14, 21, 3))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a population of conversational sessions across users and time."
    )
    add_common_arguments(parser, default_project="sessions")
    parser.add_argument(
        "--sessions",
        type=positive_int,
        default=40,
        help="Number of distinct sessions to generate (default: 40).",
    )
    parser.add_argument(
        "--users",
        type=positive_int,
        default=12,
        help="Number of distinct users the sessions belong to (default: 12).",
    )
    parser.add_argument(
        "--days",
        type=positive_int,
        default=7,
        help="How far back sessions may start (default: 7).",
    )
    parser.add_argument(
        "--max-turns",
        type=positive_int,
        default=21,
        help="Cap on turns per session; the distribution is truncated to fit (default: 21).",
    )
    parser.add_argument(
        "--error-rate",
        type=probability,
        default=0.06,
        help="Probability that a turn's LLM call fails (default: 0.06).",
    )
    parser.add_argument(
        "--annotation-rate",
        type=probability,
        default=1.0,
        help="Fraction of sessions receiving a user_satisfaction annotation (default: 1.0).",
    )
    return parser


def _turn_count(generator: Generator, max_turns: int) -> int:
    """Pick a bucket by weight, then a length uniformly inside it."""
    candidates = [
        (low, min(high, max_turns), weight)
        for low, high, weight in TURN_BUCKETS
        if low <= max_turns
    ]
    if not candidates:
        return max_turns
    low, high, _weight = generator.rng.choices(
        candidates, weights=[weight for _, _, weight in candidates]
    )[0]
    return generator.rng.randint(low, high)


def _generate_session(
    generator: Generator,
    args: argparse.Namespace,
    annotations: Annotations,
    index: int,
) -> int:
    """Emit one session and report how many turns it contained."""
    session_id = f"session-{index + 1:04d}"
    user_index = generator.rng.randrange(args.users)
    user_id = f"user-{user_index + 1:03d}"
    error_rate = min(0.9, args.error_rate * _user_error_scale(user_index))
    turns = _turn_count(generator, args.max_turns)
    # Start somewhere in the window, leaving room for the whole conversation to fit before now.
    window_seconds = args.days * 86_400
    start = utc_now() - timedelta(seconds=generator.rng.uniform(turns * 300, window_seconds))

    cursor = start
    errored = 0
    for turn in range(turns):
        question, answer = EXCHANGES[turn % len(EXCHANGES)]
        # Users pause between turns; the gap is what makes session duration interesting.
        if turn:
            cursor += timedelta(seconds=generator.rng.lognormvariate(3.4, 1.1))
        llm = llm_attributes(generator.rng, input_value=question, output_value=answer)
        # The LLM call dominates the turn, so the turn's length follows from how much the
        # model generated. Drawing the two independently makes latency-versus-tokens noise.
        duration = duration_for(generator.rng, int(llm.get("llm.token_count.completion", 0)))
        turn_end = cursor + timedelta(seconds=duration)
        status = random_status(generator.rng, error_rate=error_rate)
        errored += status is StatusCode.ERROR
        with generator.span(
            "conversation-turn",
            "CHAIN",
            attributes={
                "session.id": session_id,
                "user.id": user_id,
                "input.value": question,
                "output.value": answer,
                "metadata": json.dumps({"fixture": "sessions", "turn": turn + 1}),
            },
            start_time=ns(cursor),
            end_time=ns(turn_end),
            root=True,
        ):
            with generator.span(
                "chat-completion",
                "LLM",
                attributes={**llm, "session.id": session_id, "user.id": user_id},
                start_time=ns(cursor + timedelta(seconds=duration * 0.05)),
                end_time=ns(cursor + timedelta(seconds=duration * 0.95)),
                status=status,
                status_message=(
                    generator.rng.choice(FAILURE_REASONS) if status is StatusCode.ERROR else None
                ),
            ):
                pass
        cursor = turn_end

    # Satisfaction is a property of the conversation, not of any single turn, and a session
    # that hit errors is likelier to have left the user unhappy.
    satisfaction = (
        generator.rng.betavariate(2.0, 4.0) if errored else generator.rng.betavariate(5.0, 2.0)
    )
    if generator.rng.random() < args.annotation_rate:
        annotations.add_session(
            session_id,
            "user_satisfaction",
            score=satisfaction,
            label="satisfied" if satisfaction >= 0.5 else "unsatisfied",
            metadata={"turns": turns, "errored_turns": errored},
        )
    return turns


def generate(args: argparse.Namespace) -> tuple[Generator, Annotations, Counter[int]]:
    """Return the generator, the annotation buffer, and a turns-per-session histogram."""
    generator = Generator.from_args(args)
    annotations = Annotations(
        endpoint=args.endpoint,
        dry_run=args.dry_run,
        enabled=args.annotation_rate > 0,
    )
    turn_histogram: Counter[int] = Counter()
    try:
        for index in range(args.sessions):
            turn_histogram[_generate_session(generator, args, annotations, index)] += 1
        annotations.flush()
    except BaseException:
        generator.close()
        raise
    return generator, annotations, turn_histogram


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, annotations, turn_histogram = generate(args)
    generator.close()
    generator.print_summary()
    print(f"sessions={args.sessions}")
    print(f"session_annotations={annotations.session_count}")
    print("turns_per_session=")
    for turns, count in sorted(turn_histogram.items()):
        print(f"  {turns:>3}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
