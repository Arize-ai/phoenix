"""Shipping replayed spans to an OpenInference collector.

Split from ``otel`` so the shape of a trace can be built, diffed and read
without an SDK, a collector or a network: only sending needs those, and only
this module imports them.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import SpanAttributes

from .analyze import rows_for_run, tasks_as_run
from .config import BenchConfig, ConfigError, Task
from .otel import DEFAULT_MAX_CHARS, Span, build_spans, digest_id

DEFAULT_ENDPOINT = "http://localhost:6006"
DEFAULT_PROJECT = "mcpbench"

#: Fields worth carrying onto the root span. The rest of the row is derivable
#: from the spans themselves; these are the ones a trace cannot show -- how the
#: answer was graded, and what the run was being compared against.
_METADATA_FIELDS = (
    "run_id",
    "label",
    "task",
    "task_class",
    "trial",
    "model",
    "effort",
    "passed",
    "graded",
    "graded_as_run",
    "invalid_reason",
    "subtype",
    "num_turns",
    "n_tool_calls",
    "n_tool_errors",
    "sql_tools",
    "tool_sequence",
    "total_cost_usd",
    "duration_api_ms",
    "tool_time_ms",
    "peak_context_tokens",
    "phoenix_git_sha",
    "transcript",
)


def _ns(seconds: float) -> int:
    return int(seconds * 1_000_000_000)


def _verdict(row: dict[str, Any]) -> str:
    if not row.get("graded"):
        return "ungraded"
    return "pass" if row.get("passed") else "fail"


def _metadata(row: dict[str, Any]) -> dict[str, Any]:
    meta = {k: row.get(k) for k in _METADATA_FIELDS if row.get(k) is not None}
    meta["tags"] = [
        row.get("label"),
        row.get("task_class"),
        _verdict(row),
        f"sql:{row.get('sql_tools')}" if row.get("sql_tools") else None,
    ]
    return meta


def plan_run(
    config: BenchConfig,
    tasks: list[Task],
    out_dir: Path,
    *,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> list[tuple[str, list[Span]]]:
    """Every trace for one run directory, keyed by run and cell.

    Keyed by both because a cell id is only unique within its run: two runs of
    the same label produce the same names, and a key that ignores the run seeds
    the same span ids for both. The backend keeps the first and discards the
    second in silence, so the collision costs a whole run and reports nothing.

    Reuses the report's own row derivation rather than re-deriving grading here,
    so a span and the table row beside it cannot disagree about what happened.
    """
    raw_dir = out_dir / "raw"
    if not raw_dir.is_dir():
        raise ConfigError(f"No transcripts under {raw_dir}.")
    manifest: dict[str, Any] = {}
    if (path := out_dir / "manifest.json").is_file():
        manifest = json.loads(path.read_text())
    as_run = tasks_as_run(manifest, tasks)

    rows = {row["transcript"]: row for row in rows_for_run(config, tasks, out_dir)["runs"]}
    traces = []
    for path in sorted(raw_dir.glob("*.jsonl")):
        row = rows.get(path.name)
        if row is None:
            continue
        task = as_run.get(row.get("task") or "")
        spans = build_spans(
            path,
            prompt=" ".join((task.prompt if task else "").split()),
            metadata=_metadata(row),
            session_id=out_dir.name,
            max_chars=max_chars,
        )
        if spans:
            traces.append((f"{out_dir.name}/{path.stem}", spans))
    return traces


def _attributes(span: Span) -> dict[str, Any]:
    """Span attributes as the SDK accepts them: scalars, or sequences of them."""
    out: dict[str, Any] = {SpanAttributes.OPENINFERENCE_SPAN_KIND: span.kind}
    for key, value in span.attributes.items():
        if isinstance(value, (str, bool, int, float)):
            out[key] = value
        elif isinstance(value, (list, tuple)):
            out[key] = [str(v) for v in value if v is not None]
        elif value is not None:
            out[key] = json.dumps(value, default=str)
    return out


@dataclass
class Delivery:
    """What became of the spans a send was asked to make.

    Three numbers rather than one because they fail apart: a span can be built
    and never queued, queued and never accepted, or accepted and still not
    ingested. Only the first two are knowable from here.
    """

    planned: int = 0
    accepted: int = 0
    rejected: int = 0

    @property
    def missing(self) -> int:
        """Spans that reached no exporter at all -- dropped from a full queue."""
        return max(0, self.planned - self.accepted - self.rejected)

    @property
    def ok(self) -> bool:
        return self.planned > 0 and self.accepted == self.planned

    def describe(self) -> str:
        parts = [f"{self.accepted}/{self.planned} spans accepted"]
        if self.rejected:
            parts.append(f"{self.rejected} rejected by the collector")
        if self.missing:
            parts.append(f"{self.missing} dropped before export")
        return ", ".join(parts)


def send(
    traces: list[tuple[str, list[Span]]],
    *,
    endpoint: str,
    project: str,
    headers: Optional[dict[str, str]] = None,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> Delivery:
    """Emit every trace and report what the collector did with it.

    The SDK reports a failed export by logging it, so a caller that only counts
    what it queued cannot tell a delivered run from one that went to a closed
    port -- both look like success. The exporter is wrapped to count outcomes
    instead. Acceptance is still not ingestion: the collector answers as soon as
    it has the batch, and stores it after.
    """
    from opentelemetry.context import Context
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import SpanLimits, TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
    from opentelemetry.sdk.trace.id_generator import IdGenerator
    from opentelemetry.trace import Status, StatusCode, set_span_in_context

    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (  # isort: skip
        OTLPSpanExporter,
    )

    class SeededIds(IdGenerator):
        """Ids derived from the cell, so a repeated replay is not a duplicate."""

        seed = ""
        count = 0

        def generate_span_id(self) -> int:
            self.count += 1
            return digest_id(f"{self.seed}|span|{self.count}", 8)

        def generate_trace_id(self) -> int:
            return digest_id(f"{self.seed}|trace", 16)

    class CountingExporter(SpanExporter):
        """Passes batches through and keeps score of what came back."""

        def __init__(self, inner: SpanExporter) -> None:
            self.inner = inner
            self.delivery = Delivery()

        def export(self, spans: Any) -> Any:
            outcome = self.inner.export(spans)
            if outcome is SpanExportResult.SUCCESS:
                self.delivery.accepted += len(spans)
            else:
                self.delivery.rejected += len(spans)
            return outcome

        def shutdown(self) -> None:
            self.inner.shutdown()

        def force_flush(self, timeout_millis: int = 30_000) -> bool:
            return self.inner.force_flush(timeout_millis)

    ids = SeededIds()
    exporter = CountingExporter(OTLPSpanExporter(endpoint=endpoint, headers=headers or {}))
    provider = TracerProvider(
        resource=Resource.create({ResourceAttributes.PROJECT_NAME: project}),
        id_generator=ids,
        # A replayed conversation is one attribute per field per message, so a
        # long run passes the SDK's default of 128 partway through its history.
        # The bound evicts what was written first, which is the span kind and
        # the token counts -- the span arrives as an untyped bag of messages.
        span_limits=SpanLimits(max_attributes=16_384, max_span_attribute_length=None),
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    tracer = provider.get_tracer("mcpbench")

    def emit(span: Span, context: Optional[Any], bounds: tuple[float, float]) -> Any:
        # Clamped to the run: a child that starts before its parent or outlives
        # it renders as a broken tree, and the transcript's clock is coarse
        # enough to produce one at the edges.
        low, high = bounds
        start = min(max(span.start, low), high)
        emitted = tracer.start_span(
            span.name,
            context=context if context is not None else Context(),
            start_time=_ns(start),
            attributes=_attributes(span),
        )
        if span.status_error:
            emitted.set_status(Status(StatusCode.ERROR, span.status_error))
        else:
            emitted.set_status(Status(StatusCode.OK))
        emitted.end(end_time=_ns(min(max(span.end, start), high)))
        return emitted

    delivery = exporter.delivery
    for cell_id, spans in traces:
        # Every input that changes what a span says belongs in the seed. The
        # backend keeps the first span it sees for an id, so a setting left out
        # of the seed is a setting that silently does nothing on a re-export.
        ids.seed = f"{project}|{cell_id}|{max_chars}"
        ids.count = 0
        root, *children = spans
        bounds = (root.start, root.end)
        # Opened by hand rather than as a context manager: the children are
        # parented explicitly, and nothing here runs inside the span it describes.
        emitted_root = tracer.start_span(
            root.name,
            context=Context(),
            start_time=_ns(root.start),
            attributes=_attributes(root),
        )
        if root.status_error:
            emitted_root.set_status(Status(StatusCode.ERROR, root.status_error))
        else:
            emitted_root.set_status(Status(StatusCode.OK))
        context = set_span_in_context(emitted_root)
        for child in children:
            emit(child, context, bounds)
        emitted_root.end(end_time=_ns(root.end))
        delivery.planned += len(spans)

    provider.force_flush()
    provider.shutdown()
    return delivery


def as_json(traces: list[tuple[str, list[Span]]]) -> list[dict[str, Any]]:
    """The traces as data, for inspection without a collector."""
    return [
        {
            "cell": cell_id,
            "spans": [
                {
                    "name": span.name,
                    "kind": span.kind,
                    "start": span.start,
                    "duration_ms": round((span.end - span.start) * 1000),
                    "status_error": span.status_error,
                    "attributes": span.attributes,
                }
                for span in spans
            ],
        }
        for cell_id, spans in traces
    ]


def resolve_endpoint(endpoint: str) -> str:
    """Accept a Phoenix base URL as readily as a collector path."""
    endpoint = endpoint.rstrip("/")
    return endpoint if endpoint.endswith("/v1/traces") else f"{endpoint}/v1/traces"


def resolve_headers() -> dict[str, str]:
    """Auth from the environment, so a key is never a shell argument."""
    key = (os.environ.get("PHOENIX_API_KEY") or "").strip()
    return {"authorization": f"Bearer {key}"} if key else {}
