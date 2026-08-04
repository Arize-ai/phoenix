from __future__ import annotations

import argparse

try:
    from ._shared import Generator, add_common_arguments, llm_attributes, positive_int
except ImportError:  # Support direct execution from this directory.
    from _shared import Generator, add_common_arguments, llm_attributes, positive_int

QUESTIONS = (
    "Summarize the account activity and identify the next action.",
    "Which retrieved facts best answer the customer's question?",
    "Explain the observed metric change in one paragraph.",
)
ANSWERS = (
    "The account is healthy; the next action is to confirm the pending renewal.",
    "The product policy and the latest account note provide the strongest evidence.",
    "Traffic increased during business hours while latency remained stable.",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate one deeply nested trace for tree-view and query stress testing."
    )
    add_common_arguments(parser, default_project="deeply-nested")
    parser.add_argument("--branches", type=positive_int, default=3)
    parser.add_argument("--children-per-level", type=positive_int, default=3)
    parser.add_argument("--depth", type=positive_int, default=5)
    parser.add_argument(
        "--max-llm-spans-per-chain",
        type=positive_int,
        default=2,
        help="Maximum LLM children attached to each chain span (default: 2).",
    )
    parser.add_argument(
        "--max-spans",
        type=positive_int,
        default=100_000,
        help="Safety limit for the worst-case generated span count (default: 100000).",
    )
    return parser


def _chain_span_count(branches: int, children: int, depth: int) -> int:
    return 1 + branches * sum(children**level for level in range(depth))


def _generate_llm_spans(generator: Generator, maximum: int, *, at_least_one: bool) -> None:
    minimum = 1 if at_least_one else 0
    for index in range(generator.rng.randint(minimum, maximum)):
        prompt_index = generator.rng.randrange(len(QUESTIONS))
        with generator.span(
            f"llm-answer-{index + 1}",
            "LLM",
            attributes=llm_attributes(
                generator.rng,
                input_value=QUESTIONS[prompt_index],
                output_value=ANSWERS[prompt_index],
            ),
        ):
            pass


def _generate_level(
    generator: Generator,
    *,
    level: int,
    depth: int,
    children: int,
    max_llm_spans: int,
) -> None:
    for child_index in range(children):
        with generator.span(
            f"chain-level-{level}-child-{child_index + 1}",
            "CHAIN",
            attributes={"synthetic.depth": level},
        ):
            _generate_llm_spans(
                generator,
                max_llm_spans,
                at_least_one=level == depth,
            )
            if level < depth:
                _generate_level(
                    generator,
                    level=level + 1,
                    depth=depth,
                    children=children,
                    max_llm_spans=max_llm_spans,
                )


def generate(args: argparse.Namespace) -> Generator:
    chain_spans = _chain_span_count(args.branches, args.children_per_level, args.depth)
    worst_case_spans = chain_spans * (args.max_llm_spans_per_chain + 1)
    if worst_case_spans > args.max_spans:
        raise ValueError(
            "requested topology can generate "
            f"{worst_case_spans:,} spans, above --max-spans={args.max_spans:,}"
        )

    generator = Generator.from_args(args)
    try:
        with generator.span(
            "deeply-nested-request",
            "CHAIN",
            attributes={"session.id": f"nested-session-{args.seed}"},
            root=True,
        ):
            for branch_index in range(args.branches):
                with generator.span(
                    f"branch-{branch_index + 1}",
                    "CHAIN",
                    attributes={"synthetic.branch": branch_index + 1},
                ):
                    _generate_llm_spans(
                        generator,
                        args.max_llm_spans_per_chain,
                        at_least_one=True,
                    )
                    if args.depth > 1:
                        _generate_level(
                            generator,
                            level=2,
                            depth=args.depth,
                            children=args.children_per_level,
                            max_llm_spans=args.max_llm_spans_per_chain,
                        )
    except BaseException:
        generator.close()
        raise
    return generator


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = generate(args)
    generator.close()
    generator.print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
