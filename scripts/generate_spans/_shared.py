from __future__ import annotations

import argparse
import math
import os
import random
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterator, Mapping, Optional

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Span, Status, StatusCode

DEFAULT_ENDPOINT = "http://localhost:6006"


@dataclass(frozen=True)
class Model:
    name: str
    provider: str
    typical_prompt_tokens: int
    typical_completion_tokens: int
    supports_cache: bool = False
    supports_reasoning: bool = False


MODELS = (
    Model("gpt-4.1", "openai", 1_800, 550, supports_cache=True),
    Model("gpt-4.1-mini", "openai", 1_300, 420, supports_cache=True),
    Model("o3", "openai", 2_200, 1_100, supports_cache=True, supports_reasoning=True),
    Model("claude-sonnet-4-6", "anthropic", 2_400, 700, supports_cache=True),
    Model("claude-haiku-4-5-20251001", "anthropic", 1_500, 450, supports_cache=True),
    Model("gemini-2.5-pro", "google", 2_600, 850, supports_cache=True, supports_reasoning=True),
    Model("gemini-2.5-flash", "google", 1_700, 500, supports_cache=True),
)


@dataclass(frozen=True)
class TokenUsage:
    prompt: int
    completion: int
    cache_read: int = 0
    cache_write: int = 0
    reasoning: int = 0

    @property
    def total(self) -> int:
        return self.prompt + self.completion

    def attributes(self) -> dict[str, int]:
        attributes = {
            "llm.token_count.prompt": self.prompt,
            "llm.token_count.completion": self.completion,
            "llm.token_count.total": self.total,
            "llm.token_count.prompt_details.cache_read": self.cache_read,
            "llm.token_count.prompt_details.cache_write": self.cache_write,
            "llm.token_count.completion_details.reasoning": self.reasoning,
        }
        return {key: value for key, value in attributes.items() if value}


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def non_negative_int(value: str) -> int:
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be at least 0")
    return parsed


def probability(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def trace_endpoint(endpoint: str) -> str:
    endpoint = endpoint.rstrip("/")
    return endpoint if endpoint.endswith("/v1/traces") else f"{endpoint}/v1/traces"


def add_common_arguments(
    parser: argparse.ArgumentParser,
    *,
    default_project: str,
) -> None:
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Phoenix base URL or OTLP trace endpoint (default: {DEFAULT_ENDPOINT}).",
    )
    parser.add_argument(
        "--project-name",
        default=default_project,
        help=f"Phoenix project name (default: {default_project}).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Seed for reproducible generated data (default: 42).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and validate spans without exporting them.",
    )


def ns(timestamp: datetime) -> int:
    if timestamp.tzinfo is None:
        raise ValueError("timestamps must be timezone-aware")
    return int(timestamp.timestamp() * 1_000_000_000)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def poisson(rng: random.Random, rate: float) -> int:
    """Sample a Poisson count without requiring NumPy."""
    if rate < 0:
        raise ValueError("rate must be non-negative")
    if rate == 0:
        return 0
    if rate >= 30:
        return max(0, round(rng.gauss(rate, math.sqrt(rate))))
    threshold = math.exp(-rate)
    product = 1.0
    count = 0
    while product > threshold:
        count += 1
        product *= rng.random()
    return count - 1


def model_for_provider(rng: random.Random, provider: Optional[str] = None) -> Model:
    candidates = tuple(model for model in MODELS if provider is None or model.provider == provider)
    if not candidates:
        raise ValueError(f"unknown provider: {provider}")
    return rng.choice(candidates)


def token_usage(rng: random.Random, model: Model, *, scale: float = 1.0) -> TokenUsage:
    """Generate correlated token counts around a model's typical workload."""
    if scale <= 0:
        raise ValueError("token scale must be positive")
    prompt = max(8, round(rng.lognormvariate(math.log(model.typical_prompt_tokens), 0.55) * scale))
    completion = max(
        4,
        min(
            prompt * 2,
            round(rng.lognormvariate(math.log(model.typical_completion_tokens), 0.45) * scale),
        ),
    )
    cache_read = 0
    cache_write = 0
    if model.supports_cache:
        draw = rng.random()
        if draw < 0.35:
            cache_read = round(prompt * rng.uniform(0.15, 0.75))
        elif draw < 0.45:
            cache_write = round(prompt * rng.uniform(0.1, 0.4))
    reasoning = (
        round(completion * rng.uniform(0.15, 0.65))
        if model.supports_reasoning and rng.random() < 0.7
        else 0
    )
    return TokenUsage(prompt, completion, cache_read, cache_write, reasoning)


def llm_attributes(
    rng: random.Random,
    *,
    model: Optional[Model] = None,
    scale: float = 1.0,
    input_value: Optional[str] = None,
    output_value: Optional[str] = None,
) -> dict[str, Any]:
    model = model or model_for_provider(rng)
    attributes: dict[str, Any] = {
        "openinference.span.kind": "LLM",
        "llm.provider": model.provider,
        "llm.model_name": model.name,
        **token_usage(rng, model, scale=scale).attributes(),
    }
    if input_value is not None:
        attributes["input.value"] = input_value
    if output_value is not None:
        attributes["output.value"] = output_value
    return attributes


class Generator:
    """Own seeded data generation and the OpenTelemetry export lifecycle."""

    def __init__(
        self,
        *,
        endpoint: str,
        project_name: str,
        seed: int,
        dry_run: bool,
    ) -> None:
        self.endpoint = trace_endpoint(endpoint)
        self.project_name = project_name
        self.seed = seed
        self.dry_run = dry_run
        self.rng = random.Random(seed)
        self.span_count = 0
        self.trace_count = 0
        self._provider = TracerProvider(
            resource=Resource.create({"openinference.project.name": project_name})
        )
        if not dry_run:
            headers = None
            if api_key := os.getenv("PHOENIX_API_KEY"):
                headers = {"Authorization": f"Bearer {api_key}"}
            self._provider.add_span_processor(
                SimpleSpanProcessor(OTLPSpanExporter(endpoint=self.endpoint, headers=headers))
            )
        self.tracer = self._provider.get_tracer("phoenix.synthetic-data")

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> Generator:
        return cls(
            endpoint=args.endpoint,
            project_name=args.project_name,
            seed=args.seed,
            dry_run=args.dry_run,
        )

    @contextmanager
    def span(
        self,
        name: str,
        kind: str,
        *,
        attributes: Optional[Mapping[str, Any]] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        status: StatusCode = StatusCode.OK,
        root: bool = False,
    ) -> Iterator[Span]:
        span_attributes: dict[str, Any] = {"openinference.span.kind": kind}
        if attributes:
            span_attributes.update(attributes)
        with self.tracer.start_as_current_span(
            name,
            attributes=span_attributes,
            start_time=start_time,
            end_on_exit=end_time is None,
        ) as span:
            self.span_count += 1
            if root:
                self.trace_count += 1
            yield span
            if span.status.is_unset:
                span.set_status(Status(status))
            if end_time is not None:
                span.end(end_time=end_time)

    def close(self) -> None:
        if not self.dry_run:
            self._provider.force_flush()
        self._provider.shutdown()

    def print_summary(self, *, started_at: Optional[datetime] = None) -> None:
        print(f"project={self.project_name}")
        print(f"seed={self.seed}")
        print(f"traces={self.trace_count}")
        print(f"spans={self.span_count}")
        if started_at is not None:
            print(f"start_time={started_at.astimezone(timezone.utc).isoformat()}")
        print(f"dry_run={str(self.dry_run).lower()}")
        if not self.dry_run:
            print(f"exported_to={self.endpoint}")


def random_status(rng: random.Random, *, error_rate: float, unset_rate: float = 0.05) -> StatusCode:
    draw = rng.random()
    if draw < error_rate:
        return StatusCode.ERROR
    if draw < error_rate + unset_rate:
        return StatusCode.UNSET
    return StatusCode.OK
