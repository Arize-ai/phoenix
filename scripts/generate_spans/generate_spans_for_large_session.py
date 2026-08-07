from __future__ import annotations

import argparse
from datetime import timedelta

try:
    from ._shared import (
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        utc_now,
    )

USER_REQUESTS = (
    "Summarize today's support activity.",
    "Find the most relevant account update.",
    "Draft a concise response for the customer.",
    "Compare this result with the previous run.",
)
ASSISTANT_RESPONSES = (
    "Support volume was steady, with two issues awaiting follow-up.",
    "The renewal note is the most recent and relevant account update.",
    "I've drafted a concise response with the next action and owner.",
    "Quality improved while latency and token use remained stable.",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate many realistic LLM turns in one session."
    )
    add_common_arguments(parser, default_project="large-session")
    parser.add_argument(
        "--turns",
        type=positive_int,
        default=500,
        help="Number of LLM turns in the session (default: 500).",
    )
    parser.add_argument(
        "--session-id",
        help="Session identifier (default: a deterministic value derived from --seed).",
    )
    return parser


def generate(args: argparse.Namespace) -> Generator:
    generator = Generator.from_args(args)
    session_id = args.session_id or f"large-session-{args.seed}"
    # Plan the turns first so the conversation can be backdated to end about now. Emitting at
    # wall clock put 500 turns inside 9 milliseconds, which left the session view — the very
    # thing this scenario exists to stress — showing a multi-hour conversation as instant.
    turns = []
    for turn in range(args.turns):
        content_index = turn % len(USER_REQUESTS)
        attributes = llm_attributes(
            generator.rng,
            input_value=USER_REQUESTS[content_index],
            output_value=ASSISTANT_RESPONSES[content_index],
        )
        duration = duration_for(generator.rng, int(attributes.get("llm.token_count.completion", 0)))
        think = 0.0 if turn == 0 else generator.rng.lognormvariate(3.4, 1.1)
        turns.append((attributes, duration, think))
    total = sum(duration + think for _attributes, duration, think in turns)
    cursor = utc_now() - timedelta(seconds=total)

    try:
        for turn, (attributes, duration, think) in enumerate(turns):
            cursor += timedelta(seconds=think)
            with generator.span(
                f"assistant-turn-{turn + 1}",
                "LLM",
                attributes={
                    **attributes,
                    "session.id": session_id,
                    "synthetic.turn": turn + 1,
                },
                start_time=ns(cursor),
                end_time=ns(cursor + timedelta(seconds=duration)),
                root=True,
            ):
                pass
            cursor += timedelta(seconds=duration)
    except BaseException:
        generator.close()
        raise
    return generator


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = generate(args)
    generator.close()
    generator.print_summary()
    print(f"session_id={args.session_id or f'large-session-{args.seed}'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
