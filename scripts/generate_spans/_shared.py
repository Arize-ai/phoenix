from __future__ import annotations

import argparse
import json
import math
import os
import random
import socket
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator, Mapping, Optional
from urllib.parse import urlparse

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanLimits, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import (
    NonRecordingSpan,
    Span,
    SpanContext,
    Status,
    StatusCode,
    TraceFlags,
    format_span_id,
    format_trace_id,
    set_span_in_context,
)

DEFAULT_ENDPOINT = "http://localhost:6006"

# OpenTelemetry caps spans at 128 attributes and 128 events by default, silently dropping
# everything past the limit. Synthetic fixtures blow through that routinely — a retriever span
# with 50 documents is 150+ keys — and truncated data is worse than no data, because the
# summary still reports success. Raise the ceiling well above anything a scenario should emit.
SPAN_LIMITS = SpanLimits(max_attributes=16_384, max_events=4_096, max_links=1_024)


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


def base_url(endpoint: str) -> str:
    """Recover the Phoenix base URL from either form of ``--endpoint``."""
    endpoint = endpoint.rstrip("/")
    return endpoint[: -len("/v1/traces")] if endpoint.endswith("/v1/traces") else endpoint


def check_reachable(endpoint: str, *, timeout: float = 2.0) -> None:
    """Fail fast when nothing is listening at ``endpoint``.

    Without this, an unreachable collector is close to invisible: ``SimpleSpanProcessor``
    exports one span at a time and each failure retries with exponential backoff, so a few
    hundred spans spend tens of minutes retrying and the script still exits 0.

    Only TCP reachability is checked — any HTTP response, including 404 or 401, counts as
    reachable, because a bare OTLP collector need not serve anything at its base path.
    """
    parsed = urlparse(endpoint if "//" in endpoint else f"//{endpoint}", scheme="http")
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return
    except OSError as error:
        raise ConnectionError(
            f"nothing is listening at {host}:{port} — start Phoenix, correct --endpoint, "
            f"or pass --dry-run to generate without exporting ({error})"
        ) from error


def span_id(span: Span) -> str:
    """Hex span id, the form the annotation API expects."""
    return format_span_id(span.get_span_context().span_id)


def detached_parent(rng: random.Random, *, within: Optional[int] = None) -> SpanContext:
    """A parent span context that is never exported.

    Attaching a span to one produces an *orphan*: a child whose parent Phoenix never receives.
    Real collectors see these constantly — head sampling drops the root, an exporter dies
    mid-trace, the root is still in flight, or an upstream service is not instrumented.

    Pass ``within=<trace_id>`` to drop a span out of the *middle* of an existing trace, so the
    root still arrives and only the link between it and its descendants is missing. Omitting it
    starts a new trace whose root never shows up at all.
    """
    return SpanContext(
        trace_id=rng.getrandbits(128) if within is None else within,
        span_id=rng.getrandbits(64),
        is_remote=True,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )


def trace_id(span: Span) -> str:
    """Hex trace id, the form the trace annotation API expects."""
    return format_trace_id(span.get_span_context().trace_id)


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
    parser.add_argument(
        "--no-preflight",
        action="store_true",
        help="Skip the endpoint reachability check before exporting.",
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


def document_attributes(
    documents: Iterable[Mapping[str, Any]],
    prefix: str = "retrieval.documents",
) -> dict[str, Any]:
    """Flatten documents into indexed ``<prefix>.N.document.*`` keys.

    Recognized keys are ``id``, ``content``, ``score``, and ``metadata`` (JSON-encoded for
    you). Anything absent is omitted rather than emitted empty. Use ``prefix`` to target
    ``reranker.input_documents`` / ``reranker.output_documents`` instead of retrieval.
    """
    attributes: dict[str, Any] = {}
    for index, document in enumerate(documents):
        base = f"{prefix}.{index}.document"
        if (value := document.get("id")) is not None:
            attributes[f"{base}.id"] = value
        if (value := document.get("content")) is not None:
            attributes[f"{base}.content"] = value
        if (value := document.get("score")) is not None:
            attributes[f"{base}.score"] = value
        if (value := document.get("metadata")) is not None:
            attributes[f"{base}.metadata"] = json.dumps(value)
    return attributes


def message_attributes(messages: Iterable[Mapping[str, Any]], prefix: str) -> dict[str, Any]:
    """Flatten chat messages into indexed ``<prefix>.N.message.*`` keys.

    Recognized keys are ``role``, ``content``, ``tool_call_id``, and ``tool_calls`` — a list
    of ``{"id", "name", "arguments"}`` mappings whose arguments are JSON-encoded for you.
    ``prefix`` is normally ``llm.input_messages`` or ``llm.output_messages``.
    """
    attributes: dict[str, Any] = {}
    for index, message in enumerate(messages):
        base = f"{prefix}.{index}.message"
        if (value := message.get("role")) is not None:
            attributes[f"{base}.role"] = value
        if (value := message.get("content")) is not None:
            attributes[f"{base}.content"] = value
        if (value := message.get("tool_call_id")) is not None:
            attributes[f"{base}.tool_call_id"] = value
        for call_index, call in enumerate(message.get("tool_calls") or ()):
            call_base = f"{base}.tool_calls.{call_index}.tool_call"
            attributes[f"{call_base}.id"] = call["id"]
            attributes[f"{call_base}.function.name"] = call["name"]
            attributes[f"{call_base}.function.arguments"] = json.dumps(call["arguments"])
    return attributes


def duration_for(rng: random.Random, completion_tokens: int, *, overhead: float = 0.35) -> float:
    """Seconds a completion of this size plausibly took.

    Generation time is dominated by how many tokens came *out*, plus a roughly fixed overhead
    for connection setup and prompt processing. Scenarios that pick a duration independently
    of their token counts produce a latency-versus-tokens view that is pure noise, which is
    the same failure as an eval score uncorrelated with its cause — just harder to notice.

    Take the count straight from the attributes ``llm_attributes()`` returned, so the duration
    and the reported usage cannot drift apart.
    """
    per_token = rng.uniform(0.004, 0.011)
    jitter = rng.lognormvariate(0.0, 0.25)
    return max(0.02, (overhead + completion_tokens * per_token) * jitter)


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
        preflight: bool = True,
    ) -> None:
        self.endpoint = trace_endpoint(endpoint)
        self.project_name = project_name
        self.seed = seed
        self.dry_run = dry_run
        self.rng = random.Random(seed)
        self.span_count = 0
        self.trace_count = 0
        self._provider = TracerProvider(
            resource=Resource.create({"openinference.project.name": project_name}),
            span_limits=SPAN_LIMITS,
        )
        if not dry_run:
            if preflight:
                check_reachable(self.endpoint)
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
            preflight=not getattr(args, "no_preflight", False),
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
        status_message: Optional[str] = None,
        root: bool = False,
        parent: Optional[SpanContext] = None,
    ) -> Iterator[Span]:
        """Emit one span.

        ``parent`` attaches the span to a context this process did not create — pass
        ``detached_parent()`` to produce an orphan whose parent Phoenix never receives.

        ``status_message`` is the reason shown beside a failed span. An ERROR carrying neither
        a message nor a recorded exception renders as a red span with no explanation, which no
        real instrumentation produces.
        """
        span_attributes: dict[str, Any] = {"openinference.span.kind": kind}
        if attributes:
            span_attributes.update(attributes)
        with self.tracer.start_as_current_span(
            name,
            context=set_span_in_context(NonRecordingSpan(parent)) if parent else None,
            attributes=span_attributes,
            start_time=start_time,
            end_on_exit=end_time is None,
        ) as span:
            self.span_count += 1
            if root:
                self.trace_count += 1
            yield span
            if span.status.is_unset:
                span.set_status(Status(status, status_message))
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


class Annotations:
    """Buffer span annotations and write them to Phoenix in batches.

    Annotations do not travel over OTLP — they are a separate REST resource, so this needs a
    reachable Phoenix server and is a no-op under ``--dry-run``. Buffering matters: writing
    one annotation per request is usually slower than exporting all of the spans.

    Note the payload shape — ``score``/``label``/``explanation`` are nested under ``result``,
    and at least one of them is required.
    """

    def __init__(
        self,
        *,
        endpoint: str,
        dry_run: bool,
        enabled: bool = True,
        batch_size: int = 500,
    ) -> None:
        self.batch_size = batch_size
        self.count = 0
        self.document_count = 0
        self.trace_count = 0
        self.session_count = 0
        self.note_count = 0
        self.notes: list[tuple[str, str]] = []
        self._pending: list[dict[str, Any]] = []
        self._pending_traces: list[dict[str, Any]] = []
        self._pending_sessions: list[dict[str, Any]] = []
        self._pending_documents: list[dict[str, Any]] = []
        self._client: Any = None
        # Counts are still tallied when disabled, so --dry-run reports the shape it would send.
        if not dry_run and enabled:
            from phoenix.client import Client

            self._client = Client(base_url=base_url(endpoint))

    # Phoenix reserves this name: the bulk annotation endpoint rejects it with a 400 and
    # routes notes through POST /v1/span_notes instead. Catch it here rather than at the
    # server, where the failure arrives mid-run after the spans have already exported.
    RESERVED_NAMES = frozenset({"note"})

    @staticmethod
    def _payload(
        span: Span,
        name: str,
        annotator_kind: str,
        score: Optional[float],
        label: Optional[str],
        explanation: Optional[str],
        metadata: Optional[Mapping[str, Any]],
    ) -> dict[str, Any]:
        if name in Annotations.RESERVED_NAMES:
            raise ValueError(f"{name!r} is reserved by Phoenix; use Annotations.add_note()")
        if score is None and label is None and explanation is None:
            raise ValueError("annotations need at least one of score, label, or explanation")
        annotation: dict[str, Any] = {
            "span_id": span_id(span),
            "name": name,
            "annotator_kind": annotator_kind,
            "result": {
                key: value
                for key, value in (
                    ("score", score),
                    ("label", label),
                    ("explanation", explanation),
                )
                if value is not None
            },
        }
        if metadata:
            annotation["metadata"] = dict(metadata)
        return annotation

    def add(
        self,
        span: Span,
        name: str,
        *,
        score: Optional[float] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        annotator_kind: str = "LLM",
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> None:
        self._pending.append(
            self._payload(span, name, annotator_kind, score, label, explanation, metadata)
        )
        self.count += 1
        if len(self._pending) >= self.batch_size:
            self.flush()

    def add_trace(
        self,
        span: Span,
        name: str,
        *,
        score: Optional[float] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        annotator_kind: str = "LLM",
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Annotate the whole trace the span belongs to.

        Trace annotations are a separate resource keyed by ``trace_id`` — annotating a root
        span is not the same thing, and the two show up in different places in the UI.
        """
        annotation = self._payload(span, name, annotator_kind, score, label, explanation, metadata)
        annotation.pop("span_id")
        annotation["trace_id"] = trace_id(span)
        self._pending_traces.append(annotation)
        self.trace_count += 1
        if len(self._pending_traces) >= self.batch_size:
            self.flush()

    def add_session(
        self,
        session: str,
        name: str,
        *,
        score: Optional[float] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        annotator_kind: str = "LLM",
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Annotate a session by its ``session.id``.

        Unlike the span and trace variants this takes the id string directly, because a
        session is not an OpenTelemetry object — it only exists as an attribute on spans.
        """
        if score is None and label is None and explanation is None:
            raise ValueError("annotations need at least one of score, label, or explanation")
        annotation: dict[str, Any] = {
            "session_id": session,
            "name": name,
            "annotator_kind": annotator_kind,
            "result": {
                key: value
                for key, value in (
                    ("score", score),
                    ("label", label),
                    ("explanation", explanation),
                )
                if value is not None
            },
        }
        if metadata:
            annotation["metadata"] = dict(metadata)
        self._pending_sessions.append(annotation)
        self.session_count += 1
        if len(self._pending_sessions) >= self.batch_size:
            self.flush()

    def add_note(self, span: Span, note: str) -> None:
        """Attach a human note to a span.

        Notes are their own resource, not a `name="note"` annotation — the bulk endpoint
        rejects that name. They are append-only, always `annotator_kind="HUMAN"`, and the text
        lives in the annotation's ``explanation``. There is no batch endpoint, so each note is
        one request; keep the counts modest.
        """
        self.notes.append((span_id(span), note))
        self.note_count += 1

    def add_document(
        self,
        span: Span,
        position: int,
        name: str,
        *,
        score: Optional[float] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        annotator_kind: str = "LLM",
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Annotate one retrieved document.

        ``position`` is the index in the span's flattened ``retrieval.documents.N`` keys —
        documents are addressed by position, not by ``document.id``.
        """
        if position < 0:
            raise ValueError("document position must be non-negative")
        annotation = self._payload(span, name, annotator_kind, score, label, explanation, metadata)
        annotation["document_position"] = position
        self._pending_documents.append(annotation)
        self.document_count += 1
        if len(self._pending_documents) >= self.batch_size:
            self.flush()

    def flush(self) -> None:
        if self._pending:
            batch, self._pending = self._pending, []
            if self._client is not None:
                self._client.spans.log_span_annotations(span_annotations=batch)
        if self._pending_documents:
            batch, self._pending_documents = self._pending_documents, []
            if self._client is not None:
                self._client.spans.log_document_annotations(document_annotations=batch)
        if self._pending_traces:
            batch, self._pending_traces = self._pending_traces, []
            if self._client is not None:
                self._client.traces.log_trace_annotations(trace_annotations=batch)
        if self._pending_sessions:
            batch, self._pending_sessions = self._pending_sessions, []
            if self._client is not None:
                self._client.sessions.log_session_annotations(session_annotations=batch)

    def flush_notes(self, *, attempts: int = 6, delay: float = 0.5) -> int:
        """Post buffered notes, waiting for the spans they reference to be ingested.

        Call this *after* ``Generator.close()``. Unlike bulk annotations, which Phoenix queues
        and resolves later, ``POST /v1/span_notes`` looks the span up immediately and 404s if
        it is not there yet — and span ingestion is asynchronous, so posting a note straight
        after export reliably loses the race. Returns the number of notes written.
        """
        if not self.notes:
            return 0
        notes, self.notes = self.notes, []
        if self._client is None:
            return len(notes)
        written = 0
        for note_span_id, note in notes:
            for attempt in range(attempts):
                try:
                    self._client.spans.add_span_note(span_id=note_span_id, note=note)
                    written += 1
                    break
                except Exception as error:  # noqa: BLE001 - only a 404 is worth retrying
                    if "404" not in str(error) or attempt == attempts - 1:
                        raise
                    time.sleep(delay)
        return written


def random_status(rng: random.Random, *, error_rate: float, unset_rate: float = 0.05) -> StatusCode:
    draw = rng.random()
    if draw < error_rate:
        return StatusCode.ERROR
    if draw < error_rate + unset_rate:
        return StatusCode.UNSET
    return StatusCode.OK
