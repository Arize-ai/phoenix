from __future__ import annotations

import argparse

try:
    from ._shared import Generator, Model, add_common_arguments, positive_int, token_usage
except ImportError:  # Support direct execution from this directory.
    from _shared import Generator, Model, add_common_arguments, positive_int, token_usage

MODELS = (
    Model("gpt-4o", "openai", 1_600, 450),
    Model("o3-mini", "openai", 1_900, 800, supports_reasoning=True),
    Model("gpt-4.1-mini-2025-04-14", "openai", 1_300, 420),
    Model("claude-sonnet-4-5-20250929", "anthropic", 2_200, 650),
    Model("claude-opus-4-1-20250805", "anthropic", 2_500, 800),
    Model("anthropic.claude-opus-4-1-20250805-v1:0", "aws", 2_500, 800),
    Model("us.anthropic.claude-sonnet-4-5-20250929-v1:0", "aws", 2_200, 650),
    Model("meta.llama4-maverick-17b-instruct-v1:0", "aws", 1_700, 550),
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate model-name length fixtures for metrics chart label testing."
    )
    add_common_arguments(parser, default_project="axis-labels")
    parser.add_argument("--traces", type=positive_int, default=25)
    parser.add_argument("--min-calls", type=positive_int, default=1)
    parser.add_argument("--max-calls", type=positive_int, default=4)
    return parser


def generate(args: argparse.Namespace) -> Generator:
    if args.min_calls > args.max_calls:
        raise ValueError("--min-calls cannot exceed --max-calls")
    weighted_models = tuple(
        model for model in MODELS for _ in range(1 + min(3, max(0, (len(model.name) - 8) // 10)))
    )
    generator = Generator.from_args(args)
    try:
        for trace_index in range(args.traces):
            with generator.span(
                f"metrics-request-{trace_index + 1}",
                "CHAIN",
                attributes={"session.id": f"axis-session-{trace_index % 5 + 1}"},
                root=True,
            ):
                for call_index in range(generator.rng.randint(args.min_calls, args.max_calls)):
                    model = generator.rng.choice(weighted_models)
                    usage = token_usage(generator.rng, model)
                    with generator.span(
                        f"llm-call-{call_index + 1}",
                        "LLM",
                        attributes={
                            "llm.model_name": model.name,
                            "llm.provider": model.provider,
                            **usage.attributes(),
                            "input.value": "Explain the observed metrics trend.",
                            "output.value": "Traffic rose while latency remained stable.",
                        },
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
