from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from ._shared import Generator, Model, add_common_arguments, positive_int, token_usage
except ImportError:  # Support direct execution from this directory.
    from _shared import Generator, Model, add_common_arguments, positive_int, token_usage

DEFAULT_MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "phoenix"
    / "server"
    / "cost_tracking"
    / "model_cost_manifest.json"
)


@dataclass(frozen=True)
class PricedModel:
    name: str
    provider: str
    supports_cache: bool


def _provider_for_model(name: str) -> str:
    lowered = name.lower()
    if lowered.startswith(("anthropic.", "amazon.", "eu.", "meta.", "us.")):
        return "aws"
    if "claude" in lowered:
        return "anthropic"
    if lowered.startswith(("gpt", "chatgpt", "o1", "o3", "o4")):
        return "openai"
    if lowered.startswith(("gemini", "gemma")):
        return "google"
    if lowered.startswith(("command", "rerank")):
        return "cohere"
    if "mistral" in lowered or lowered.startswith(("codestral", "devstral", "magistral")):
        return "mistral"
    if lowered.startswith("grok"):
        return "xai"
    if lowered.startswith("deepseek"):
        return "deepseek"
    return "unknown"


def load_models(path: Path) -> list[PricedModel]:
    with path.open(encoding="utf-8") as manifest_file:
        payload: dict[str, Any] = json.load(manifest_file)
    models = []
    for entry in payload["models"]:
        token_types = {price["token_type"] for price in entry.get("token_prices", ())}
        models.append(
            PricedModel(
                name=entry["name"],
                provider=entry.get("provider") or _provider_for_model(entry["name"]),
                supports_cache=bool({"cache_read", "cache_write"} & token_types),
            )
        )
    return models


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate realistic token usage for models in Phoenix's cost manifest."
    )
    add_common_arguments(parser, default_project="cost-calculations")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Model cost manifest to exercise.",
    )
    parser.add_argument(
        "--provider",
        action="append",
        dest="providers",
        help="Only generate a provider; repeat to select multiple providers.",
    )
    parser.add_argument(
        "--spans-per-model",
        type=positive_int,
        default=1,
        help="Number of LLM spans per manifest model (default: 1).",
    )
    parser.add_argument(
        "--model-limit",
        type=int,
        default=0,
        help="Maximum models to use after filtering; 0 means all (default: 0).",
    )
    parser.add_argument(
        "--token-scale",
        type=float,
        default=1.0,
        help="Multiplier for generated token counts (default: 1.0).",
    )
    return parser


def generate(args: argparse.Namespace) -> tuple[Generator, int]:
    if args.model_limit < 0:
        raise ValueError("--model-limit must be at least 0")
    if args.token_scale <= 0:
        raise ValueError("--token-scale must be positive")
    models = load_models(args.manifest)
    if args.providers:
        requested = set(args.providers)
        models = [model for model in models if model.provider in requested]
        found = {model.provider for model in models}
        if missing := requested - found:
            raise ValueError(f"providers not found in manifest: {', '.join(sorted(missing))}")
    if args.model_limit:
        models = models[: args.model_limit]
    if not models:
        raise ValueError("no models matched the requested filters")

    generator = Generator.from_args(args)
    try:
        for model_index, priced_model in enumerate(models):
            model = Model(
                name=priced_model.name,
                provider=priced_model.provider,
                typical_prompt_tokens=1_800,
                typical_completion_tokens=550,
                supports_cache=priced_model.supports_cache,
                supports_reasoning=any(
                    marker in priced_model.name.lower() for marker in ("o1", "o3", "o4", "reason")
                ),
            )
            with generator.span(
                f"cost-check-{priced_model.name}",
                "CHAIN",
                attributes={
                    "session.id": f"cost-batch-{model_index // 25 + 1}",
                    "synthetic.fixture": "cost-calculation",
                },
                root=True,
            ):
                for sample_index in range(args.spans_per_model):
                    usage = token_usage(generator.rng, model, scale=args.token_scale)
                    with generator.span(
                        f"{priced_model.name}-completion-{sample_index + 1}",
                        "LLM",
                        attributes={
                            "llm.model_name": priced_model.name,
                            "llm.provider": priced_model.provider,
                            **usage.attributes(),
                        },
                    ):
                        pass
    except BaseException:
        generator.close()
        raise
    return generator, len(models)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, model_count = generate(args)
    generator.close()
    generator.print_summary()
    print(f"models={model_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
