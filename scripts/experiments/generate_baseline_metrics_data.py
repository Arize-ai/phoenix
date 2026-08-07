from __future__ import annotations

import argparse
import random
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
import pandas as pd
from opentelemetry import trace as trace_api
from phoenix.client import Client
from phoenix.client.experiments import create_evaluator
from phoenix.otel import register

try:
    from ._shared import add_common_arguments, clamp_score, examples, positive_int
except ImportError:  # Support direct execution from this directory.
    from _shared import add_common_arguments, clamp_score, examples, positive_int


@dataclass(frozen=True)
class IterationProfile:
    quality: float
    latency_seconds: float
    prompt_tokens: int
    completion_tokens: int
    error_rate: float


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Seed a realistic sequence of improving experiments and mark a baseline."
    )
    add_common_arguments(parser, default_examples=25)
    parser.add_argument("--experiments", type=positive_int, default=10)
    parser.add_argument(
        "--baseline",
        type=positive_int,
        default=2,
        help="One-based experiment index to mark as the baseline (default: 2).",
    )
    parser.add_argument(
        "--latency-scale",
        type=float,
        default=1.0,
        help="Multiplier for simulated task latency; use 0 for instant runs (default: 1).",
    )
    return parser


def _profiles(count: int) -> list[IterationProfile]:
    """Improving iterations, with two that regress.

    The trend rises overall, but a strictly monotonic sequence would make the fixture unable
    to show the comparison people actually care about — an experiment that came out *worse*
    than the one before it. The setback iterations move quality, latency, and error rate
    together, the way a real bad change does.
    """
    denominator = max(1, count - 1)
    # Never the final iteration: the sequence as a whole must still read as an improvement.
    setbacks = {
        index for index in (max(1, count // 3), max(2, count * 2 // 3)) if index < count - 1
    }
    # Scaled to the per-step gain, so a setback always reads as a dip rather than merely a
    # smaller improvement. A fixed penalty vanishes at low --experiments counts, where each
    # step already moves further than the penalty subtracts.
    quality_penalty = (0.4 / denominator) * 1.6
    latency_penalty = (0.09 / denominator) * 1.6
    profiles = []
    for index in range(count):
        progress = index / denominator
        regressed = index in setbacks
        error_rate = 0.12 - progress * 0.09 + (0.1 if regressed else 0.0)
        quality = 0.5 + progress * 0.4 - (quality_penalty if regressed else 0.0)
        latency = 0.16 - progress * 0.09 + (latency_penalty if regressed else 0.0)
        profiles.append(
            IterationProfile(
                quality=max(0.05, quality),
                latency_seconds=latency,
                prompt_tokens=180 - round(progress * 65),
                completion_tokens=84 - round(progress * 35),
                error_rate=min(0.3, error_rate),
            )
        )
    return profiles


def _make_task(
    rng: random.Random,
    tracer: trace_api.Tracer,
    profile: IterationProfile,
    *,
    latency_scale: float,
) -> Callable[[dict[str, Any]], str]:
    def task(input: dict[str, Any], expected: dict[str, Any]) -> str:
        latency = max(0.0, rng.gauss(profile.latency_seconds, 0.01) * latency_scale)
        time.sleep(latency)
        prompt_tokens = max(1, round(rng.gauss(profile.prompt_tokens, 8)))
        completion_tokens = max(1, round(rng.gauss(profile.completion_tokens, 5)))
        with tracer.start_as_current_span("answer-question") as span:
            span.set_attributes(
                {
                    "openinference.span.kind": "LLM",
                    "llm.provider": "openai",
                    "llm.model_name": "gpt-4.1-mini",
                    "llm.token_count.prompt": prompt_tokens,
                    "llm.token_count.completion": completion_tokens,
                    "llm.token_count.total": prompt_tokens + completion_tokens,
                }
            )
        if rng.random() < profile.error_rate:
            raise RuntimeError("Synthetic model timeout")
        return str(expected["answer"])

    return task


def _make_evaluator(
    rng: random.Random,
    name: str,
    bias: float,
) -> Callable[..., float]:
    @create_evaluator(name=name, kind="code")
    def evaluator(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
        return clamp_score(rng.gauss(bias, 0.08))

    return evaluator


def _set_baseline(endpoint: str, experiment_id: str) -> None:
    response = httpx.post(
        f"{endpoint.rstrip('/')}/graphql",
        json={
            "query": """
              mutation SetBaseline($id: ID!) {
                setExperimentBaseline(experimentId: $id, baseline: true) {
                  experiment { id isBaseline }
                }
              }
            """,
            "variables": {"id": experiment_id},
        },
        timeout=30,
    )
    response.raise_for_status()
    if errors := response.json().get("errors"):
        raise RuntimeError(errors)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.baseline > args.experiments:
        raise ValueError("--baseline cannot exceed --experiments")
    if args.latency_scale < 0:
        raise ValueError("--latency-scale must be non-negative")
    rng = random.Random(args.seed)
    dataset_rows = examples(args.examples, rng)
    dataset_name = args.dataset_name or f"baseline-metrics-{uuid.uuid4()}"
    profiles = _profiles(args.experiments)
    if args.dry_run:
        print(f"dataset={dataset_name}")
        print(f"examples={len(dataset_rows)}")
        print(f"experiments={len(profiles)}")
        print(f"baseline={args.baseline}")
        print("dry_run=true")
        return 0

    register(project_name=dataset_name, endpoint=args.endpoint, auto_instrument=False)
    tracer = trace_api.get_tracer("baseline-experiment-seed")
    client = Client(base_url=args.endpoint)
    dataset = client.datasets.create_dataset(
        name=dataset_name,
        dataframe=pd.DataFrame(dataset_rows),
        input_keys=["question"],
        output_keys=["answer"],
        metadata_keys=["metadata"],
    )
    experiment_ids = []
    for index, profile in enumerate(profiles):
        experiment = client.experiments.run_experiment(
            dataset=dataset,
            task=_make_task(rng, tracer, profile, latency_scale=args.latency_scale),
            evaluators=[
                _make_evaluator(rng, "correctness", profile.quality),
                _make_evaluator(rng, "conciseness", profile.quality + 0.04),
                _make_evaluator(rng, "groundedness", profile.quality - 0.03),
            ],
            experiment_name=f"iteration-{index + 1}",
            retries=0,
        )
        experiment_id = experiment.get("experiment_id") or experiment.get("id")
        if not isinstance(experiment_id, str):
            raise RuntimeError(f"Could not find experiment id in response: {experiment}")
        experiment_ids.append(experiment_id)
        print(f"experiment={index + 1} id={experiment_id}")
    baseline_id = experiment_ids[args.baseline - 1]
    _set_baseline(args.endpoint, baseline_id)
    print(f"dataset={dataset_name}")
    print(f"baseline_experiment_id={baseline_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
