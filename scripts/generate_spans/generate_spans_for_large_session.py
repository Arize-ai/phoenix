from __future__ import annotations

import argparse

try:
    from ._shared import Generator, add_common_arguments, llm_attributes, positive_int
except ImportError:  # Support direct execution from this directory.
    from _shared import Generator, add_common_arguments, llm_attributes, positive_int

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
    try:
        for turn in range(args.turns):
            content_index = turn % len(USER_REQUESTS)
            with generator.span(
                f"assistant-turn-{turn + 1}",
                "LLM",
                attributes={
                    **llm_attributes(
                        generator.rng,
                        input_value=USER_REQUESTS[content_index],
                        output_value=ASSISTANT_RESPONSES[content_index],
                    ),
                    "session.id": session_id,
                    "synthetic.turn": turn + 1,
                },
                root=True,
            ):
                pass
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
