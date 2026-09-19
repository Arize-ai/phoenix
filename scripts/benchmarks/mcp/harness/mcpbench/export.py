"""Shipping replayed spans to an OpenInference collector.

Split from ``otel`` so the shape of a trace can be built, diffed and read
without an SDK, a collector or a network: only sending needs those, and only
this module imports them.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import SpanAttributes

from .analyze import rows_for_transcript, split_cell_id, tasks_as_run, write_destination
from .config import BenchConfig, ConfigError, Task
from .invocation import safe_label
from .otel import DEFAULT_MAX_CHARS, Span, build_spans

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


class Planner:
    """Turns transcripts from one run directory into traces, one at a time.

    Holds what every cell in a run shares -- the manifest, and the questions as
    they were asked -- so a run can plan a cell the moment it finishes without
    re-reading the directory each time.
    """

    def __init__(
        self,
        config: BenchConfig,
        tasks: list[Task],
        out_dir: Path,
        *,
        max_chars: int = DEFAULT_MAX_CHARS,
    ) -> None:
        self.config = config
        self.out_dir = out_dir
        self.max_chars = max_chars
        self._tasks = tasks

    def manifest(self) -> dict[str, Any]:
        """What the run recorded about itself, re-read for every cell.

        Not held from construction: a live run builds its planner before the
        matrix starts, and the matrix is what writes the manifest. Read once, up
        front, it is absent -- and every span then claims the run predates the
        manifest and carries a sanitised label, while the table beside it, which
        re-reads from disk, says otherwise about the same cell.

        Re-read rather than cached-on-first-use because the file is 3.5 KB and
        costs 0.06 ms to parse. Caching it bought nothing and was what made the
        lifetime worth getting wrong.
        """
        path = self.out_dir / "manifest.json"
        return json.loads(path.read_text()) if path.is_file() else {}

    def cell(self, path: Path) -> Optional[tuple[str, list[Span]]]:
        """One transcript as a trace, or ``None`` if it is not a run of a task.

        Grading comes from the report's own row derivation, so a span and the
        table row beside it cannot disagree about what happened.
        """
        if not (parsed := split_cell_id(path.stem)):
            return None
        manifest = self.manifest()
        file_label, task_name, trial = parsed
        # The filename is authoritative: a run directory can hold transcripts
        # from several labels, and the manifest describes only the most recent.
        label = file_label
        if (typed := manifest.get("label")) and safe_label(typed) == file_label:
            label = typed  # same label -- recover the exact wording
        task = tasks_as_run(manifest, self._tasks).get(task_name)
        rows = rows_for_transcript(
            path,
            run_id=self.out_dir.name,
            label=label,
            task=task,
            task_name=task_name,
            trial=trial,
            meta=manifest,
        )["runs"]
        if not rows:
            return None
        # Whether this run recorded the questions it asked; a run predating that
        # is graded against today's wording, which the row carries as a warning.
        graded_as_run = any("expect" in e for e in (manifest.get("tasks") or []))
        row = {**rows[0], "graded_as_run": graded_as_run}
        spans = build_spans(
            path,
            prompt=" ".join((task.prompt if task else "").split()),
            metadata=_metadata(row),
            session_id=self.out_dir.name,
            max_chars=self.max_chars,
        )
        # Keyed by both because a cell id is only unique within its run: two
        # runs of the same label produce the same names, and a key that ignores
        # the run seeds the same span ids for both. The backend keeps the first
        # and discards the second in silence, so the collision costs a whole run
        # and reports nothing.
        return (f"{self.out_dir.name}/{path.stem}", spans) if spans else None

    def all(self) -> list[tuple[str, list[Span]]]:
        raw_dir = self.out_dir / "raw"
        if not raw_dir.is_dir():
            raise ConfigError(f"No transcripts under {raw_dir}.")
        planned = (self.cell(path) for path in sorted(raw_dir.glob("*.jsonl")))
        return [trace for trace in planned if trace]


def plan_run(
    config: BenchConfig,
    tasks: list[Task],
    out_dir: Path,
    *,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> list[tuple[str, list[Span]]]:
    """Every trace for one run directory."""
    return Planner(config, tasks, out_dir, max_chars=max_chars).all()


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


class Sink:
    """An open connection to a collector, held for as long as traces are made.

    Held open rather than built per trace so a run can ship each cell as it
    finishes: the provider owns a background exporter and a batch queue, and
    building one per cell would flush and tear that down thirty times over.
    """

    def __init__(self, provider: Any, tracer: Any, exporter: Any):
        self._provider = provider
        self._tracer = tracer
        self._exporter = exporter
        # Guards the bookkeeping, not the emitting: the SDK is safe to call from
        # several threads, and cells finish on a pool.
        self._lock = threading.Lock()
        #: The trace each cell was given, keyed as the cell is. This is the
        #: record of what was sent -- both what to link to and what not to send
        #: again -- so it is the caller's to persist.
        self.traces: dict[str, str] = {}

    def send(self, cell_id: str, spans: list[Span]) -> Optional[str]:
        """Emit one trace and return the id it was given.

        The id is read back rather than decided in advance. Deriving it meant
        smuggling a seed into the SDK's id generator, which has no argument to
        carry one -- so the seed lived on one shared object and the spans took
        their identity from the order the calls happened to arrive in. Under a
        pool that silently stitched cells into each other's traces. Letting the
        SDK do what it is for costs nothing here, because what the id is never
        mattered; only knowing it afterwards did.
        """
        from opentelemetry.context import Context
        from opentelemetry.trace import Status, StatusCode, set_span_in_context

        if not spans:
            return None
        root, *children = spans
        low, high = root.start, root.end

        def emit(span: Span, context: Optional[Any]) -> Any:
            # Clamped to the run: a child that starts before its parent or
            # outlives it renders as a broken tree, and the transcript's clock
            # is coarse enough to produce one at the edges.
            start = min(max(span.start, low), high)
            emitted = self._tracer.start_span(
                span.name,
                context=context or Context(),
                start_time=_ns(start),
                attributes=_attributes(span),
            )
            if span.status_error:
                emitted.set_status(Status(StatusCode.ERROR, span.status_error))
            else:
                emitted.set_status(Status(StatusCode.OK))
            emitted.end(end_time=_ns(min(max(span.end, start), high)))
            return emitted

        # Opened by hand rather than as a context manager: the children are
        # parented explicitly, and nothing here runs inside the span it describes.
        emitted_root = emit(root, None)
        context = set_span_in_context(emitted_root)
        for child in children:
            emit(child, context)
        trace_id = format(emitted_root.get_span_context().trace_id, "032x")
        with self._lock:
            self.traces[cell_id] = trace_id
            self._exporter.delivery.planned += len(spans)
        return trace_id

    def close(self) -> Delivery:
        """Flush, shut down, and report what the collector took."""
        self._provider.force_flush()
        self._provider.shutdown()
        return self._exporter.delivery


def open_sink(
    *,
    endpoint: str,
    project: str,
    headers: Optional[dict[str, str]] = None,
) -> Sink:
    """Connect to a collector.

    The SDK reports a failed export by logging it, so a caller that only counts
    what it queued cannot tell a delivered run from one that went to a closed
    port -- both look like success. The exporter is wrapped to count outcomes
    instead. Acceptance is still not ingestion: the collector answers as soon as
    it has the batch, and stores it after.

    """
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import SpanLimits, TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult

    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (  # isort: skip
        OTLPSpanExporter,
    )

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

    exporter = CountingExporter(OTLPSpanExporter(endpoint=endpoint, headers=headers or {}))
    provider = TracerProvider(
        resource=Resource.create({ResourceAttributes.PROJECT_NAME: project}),
        # A replayed conversation is one attribute per field per message, so a
        # long run passes the SDK's default of 128 partway through its history.
        # The bound evicts what was written first, which is the span kind and
        # the token counts -- the span arrives as an untyped bag of messages.
        span_limits=SpanLimits(max_attributes=16_384, max_span_attribute_length=None),
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    return Sink(provider, provider.get_tracer("mcpbench"), exporter)


def record_destination(
    out_dir: Path, *, endpoint: str, project: str, traces: dict[str, str]
) -> None:
    """Note where this run's spans went, and which trace each cell became.

    The map is the record of what was sent: it is what the report links to, and
    what a later export consults to avoid sending a cell twice. Written after
    every cell rather than at the end, so an interrupted run still leaves a page
    whose links work.
    """
    write_destination(out_dir, endpoint=endpoint, project=project, traces=traces)


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
