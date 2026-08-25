"""Rewrite and schedule recorded trace requests."""

from __future__ import annotations

import hashlib
import json
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass, replace
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping, Sequence, cast
from zoneinfo import ZoneInfo

import numpy as np
from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span, Status

from phoenix.datagen.composer import ComposerConfig, SessionComposer
from phoenix.datagen.loader import Scenario
from phoenix.datagen.schema import Archetype

_SESSION_ID = "session.id"
_PROMPT_TOKENS = "llm.token_count.prompt"
_COMPLETION_TOKENS = "llm.token_count.completion"
_TOTAL_TOKENS = "llm.token_count.total"
_ANOMALY = "datagen.anomaly"
_COST_PREFIX = "llm.cost."
_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
_PARENT_END_MARGIN_NS = 1
_ERROR_EXCEPTION_TYPE = "PhoenixDatagenReplayError"
_ERROR_EXCEPTION_MESSAGE = "Synthetic replay error"
_ERROR_EXCEPTION_STACKTRACE = "PhoenixDatagenReplayError: Synthetic replay error"
_ERROR_SPAN_KINDS = frozenset(
    (OpenInferenceSpanKindValues.LLM.value, OpenInferenceSpanKindValues.TOOL.value)
)

AnomalyKind = Literal["token_inflation", "error_injection"]


@dataclass(frozen=True)
class Anomaly:
    """Ground truth for one contaminated emitted span."""

    run_nonce: str
    trace_id: str
    span_id: str
    inflated_fields: Mapping[str, int | float]
    kind: AnomalyKind = "token_inflation"
    virtual_time_ns: int | None = None

    def as_json(self) -> Mapping[str, Any]:
        """Return the stable JSONL representation of this anomaly."""
        return {
            "run_nonce": self.run_nonce,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "inflated_fields": dict(self.inflated_fields),
            "kind": self.kind,
            "virtual_time_ns": self.virtual_time_ns,
        }


@dataclass(frozen=True)
class EmittedTrace:
    """One rewritten OTLP trace request and its anomaly ground truth."""

    request: ExportTraceServiceRequest
    anomalies: Sequence[Anomaly]


class AnomalyManifest:
    """Append emitted anomaly ground truth to a JSONL file."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)

    def write(self, anomalies: Iterable[Anomaly], *, emitted_at_ns: int) -> None:
        """Append one JSON object for each anomaly."""
        records = tuple(anomalies)
        if not records:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            for anomaly in records:
                record = dict(anomaly.as_json())
                record["emitted_at_ns"] = emitted_at_ns
                file.write(json.dumps(record, sort_keys=True))
                file.write("\n")


@dataclass(frozen=True)
class _TraceTemplate:
    request: ExportTraceServiceRequest
    session_key: str
    has_session: bool


class Replayer:
    """Continuously produce varied traces while preserving recorded structure."""

    def __init__(
        self,
        scenario: Scenario,
        *,
        epsilon: float = 0.02,
        seed: int | None = None,
        project_name: str | None = None,
        session_fragments_median: float | None = None,
        session_fragments_sigma: float | None = None,
        session_fragments_max: int | None = None,
        archetype_mix: Mapping[Archetype, float] | None = None,
        fragment_gap_median_seconds: float | None = None,
        fragment_gap_sigma: float | None = None,
        fragment_gap_max_seconds: float | None = None,
        error_rate: float = 0.0,
    ) -> None:
        if not 0.0 <= epsilon <= 1.0:
            raise ValueError("epsilon must be between 0 and 1")
        if not 0.0 <= error_rate <= 1.0:
            raise ValueError("error_rate must be between 0 and 1")
        self.run_nonce = secrets.token_hex(16)
        self._seed = seed
        self._random = np.random.default_rng(seed)
        self._schedule_random: np.random.Generator | None = None
        self._error_rate = error_rate
        self._error_random: np.random.Generator | None = None
        identity_seed = int.from_bytes(
            hashlib.sha256(f"{seed}:".encode() + bytes.fromhex(self.run_nonce)).digest(),
            "big",
        )
        self._identity_random = np.random.default_rng(identity_seed)
        self._project_name = project_name or "phoenix-datagen"
        composer_overrides: Mapping[str, Any] = {
            "session_fragments_median": session_fragments_median,
            "session_fragments_sigma": session_fragments_sigma,
            "session_fragments_max": session_fragments_max,
            "archetype_mix": archetype_mix,
            "fragment_gap_median_seconds": fragment_gap_median_seconds,
            "fragment_gap_sigma": fragment_gap_sigma,
            "fragment_gap_max_seconds": fragment_gap_max_seconds,
        }
        self._composer = (
            SessionComposer(
                scenario,
                config=ComposerConfig(
                    **{
                        name: value
                        for name, value in composer_overrides.items()
                        if value is not None
                    }
                ),
                random=self._random,
            )
            if scenario.fragments
            else None
        )
        self._numerics = _NumericsEngine.from_requests(
            scenario.requests,
            epsilon=epsilon,
            random=self._random,
        )
        templates_by_session: dict[str, list[_TraceTemplate]] = defaultdict(list)
        trace_number = 0
        for request in scenario.requests:
            for trace_request in _split_traces(request):
                session_ids = {
                    session_id
                    for span in _iter_spans(trace_request)
                    if (session_id := _string_attribute(span, _SESSION_ID))
                }
                if len(session_ids) > 1:
                    raise ValueError("A scenario trace contains multiple session.id values")
                has_session = bool(session_ids)
                session_key = next(iter(session_ids), f"__trace_{trace_number}")
                templates_by_session[session_key].append(
                    _TraceTemplate(trace_request, session_key, has_session)
                )
                trace_number += 1
        if not templates_by_session:
            raise ValueError("scenario contains no traces")
        self._sessions = {key: tuple(templates) for key, templates in templates_by_session.items()}
        self._queues: dict[str, deque[_TraceTemplate]] = {}
        self._session_ids: dict[str, str] = {}
        self._ready_sessions: deque[str] = deque()
        self._composed_queue: deque[EmittedTrace] = deque()

    def emit(
        self,
        *,
        now_ns: int | None = None,
        scheduled_start_ns: int | None = None,
    ) -> EmittedTrace:
        """Emit the next scheduled trace with fresh identity and numeric values."""
        current_time_ns = time.time_ns() if now_ns is None else now_ns
        if self._composer is not None:
            if not self._composed_queue:
                self._begin_composed_session(
                    now_ns=current_time_ns,
                    scheduled_start_ns=scheduled_start_ns,
                )
            return self._composed_queue.popleft()
        if not any(self._queues.values()):
            self._begin_cycle()
        if not self._ready_sessions:
            available_sessions = [key for key, queue in self._queues.items() if queue]
            self._random.shuffle(available_sessions)
            self._ready_sessions.extend(available_sessions)
        session_key = self._ready_sessions.popleft()
        template = self._queues[session_key].popleft()
        return self._rewrite(
            template,
            now_ns=(current_time_ns if scheduled_start_ns is None else scheduled_start_ns),
            session_id=self._session_ids.get(session_key),
        )

    def interarrival_seconds(
        self,
        *,
        rate: float,
        burstiness: float,
        rate_schedule: str = "flat",
        timezone: str | ZoneInfo = "UTC",
        now_ns: int | None = None,
    ) -> float:
        """Draw the delay before the next trace for a traces-per-minute rate."""
        if rate <= 0:
            raise ValueError("rate must be greater than zero")
        if burstiness < 0:
            raise ValueError("burstiness must not be negative")
        if rate_schedule == "flat":
            effective_rate = rate
        elif rate_schedule == "business-hours":
            timestamp_ns = time.time_ns() if now_ns is None else now_ns
            zone = timezone if isinstance(timezone, ZoneInfo) else ZoneInfo(timezone)
            effective_rate = rate * _business_hours_multiplier(timestamp_ns, zone)
        else:
            raise ValueError(f"unsupported rate schedule: {rate_schedule}")
        mean_interval = 60.0 / effective_rate
        if burstiness == 0:
            return mean_interval
        random = self._random if rate_schedule == "flat" else self._get_schedule_random()
        multiplier = random.lognormal(
            mean=-(burstiness**2) / 2,
            sigma=burstiness,
        )
        return float(mean_interval * multiplier)

    def _begin_cycle(self) -> None:
        self._queues = {key: deque(templates) for key, templates in self._sessions.items()}
        self._session_ids = {
            key: f"datagen-{self._fresh_id(16).hex()}"
            for key, templates in self._sessions.items()
            if templates[0].has_session
        }
        self._ready_sessions.clear()

    def _begin_composed_session(
        self,
        *,
        now_ns: int,
        scheduled_start_ns: int | None,
    ) -> None:
        assert self._composer is not None
        session = self._composer.compose(now_ns=now_ns)
        session_id = f"datagen-{self._fresh_id(16).hex()}"
        emissions = [
            self._rewrite(
                _TraceTemplate(
                    request=trace.request,
                    session_key=trace.fragment_id,
                    has_session=True,
                ),
                now_ns=trace.virtual_start_ns,
                session_id=session_id,
            )
            for trace in session.traces
        ]
        if scheduled_start_ns is not None:
            earliest_start_ns = min(
                span.start_time_unix_nano
                for emission in emissions
                for span in _iter_spans(emission.request)
            )
            offset_ns = scheduled_start_ns - earliest_start_ns
            emissions = [_shift_emission_times(emission, offset_ns) for emission in emissions]
        else:
            latest_end_ns = max(
                span.end_time_unix_nano
                for emission in emissions
                for span in _iter_spans(emission.request)
            )
            if latest_end_ns > now_ns:
                offset_ns = now_ns - latest_end_ns
                emissions = [_shift_emission_times(emission, offset_ns) for emission in emissions]
        self._composed_queue.extend(emissions)

    def _get_schedule_random(self) -> np.random.Generator:
        if self._schedule_random is None:
            schedule_seed = (
                None
                if self._seed is None
                else int.from_bytes(
                    hashlib.sha256(f"{self._seed}:schedule".encode()).digest(),
                    "big",
                )
            )
            self._schedule_random = np.random.default_rng(schedule_seed)
        return self._schedule_random

    def _get_error_random(self) -> np.random.Generator:
        if self._error_random is None:
            error_seed = (
                None
                if self._seed is None
                else int.from_bytes(
                    hashlib.sha256(f"{self._seed}:error".encode()).digest(),
                    "big",
                )
            )
            self._error_random = np.random.default_rng(error_seed)
        return self._error_random

    def _rewrite(
        self,
        template: _TraceTemplate,
        *,
        now_ns: int,
        session_id: str | None,
    ) -> EmittedTrace:
        request = ExportTraceServiceRequest()
        request.CopyFrom(template.request)
        _set_project_name(request, self._project_name)
        spans = tuple(_iter_spans(request))
        first_start = min(span.start_time_unix_nano for span in spans)
        time_offset = now_ns - first_start
        trace_id = self._fresh_id(16)
        span_ids = {span.span_id: self._fresh_id(8) for span in spans}
        resolved_span_ids = set(span_ids.values())
        dangling_parent_ids: dict[bytes, bytes] = {}
        for span in spans:
            recorded_parent_id = span.parent_span_id
            if not recorded_parent_id or recorded_parent_id in span_ids:
                continue
            if recorded_parent_id not in dangling_parent_ids:
                parent_id = self._fresh_id(8)
                while parent_id in resolved_span_ids:
                    parent_id = self._fresh_id(8)
                dangling_parent_ids[recorded_parent_id] = parent_id
                resolved_span_ids.add(parent_id)

        for span in spans:
            duration = max(1, span.end_time_unix_nano - span.start_time_unix_nano)
            span.start_time_unix_nano += time_offset
            span.end_time_unix_nano = span.start_time_unix_nano + duration
            for event in span.events:
                event.time_unix_nano += time_offset
            span.trace_id = trace_id
            old_span_id = span.span_id
            span.span_id = span_ids[old_span_id]
            if span.parent_span_id:
                span.parent_span_id = (
                    span_ids[span.parent_span_id]
                    if span.parent_span_id in span_ids
                    else dangling_parent_ids[span.parent_span_id]
                )
            if session_id is not None:
                _set_string_attribute(span, _SESSION_ID, session_id)

        anomalies = self._numerics.apply(spans, run_nonce=self.run_nonce)
        if self._error_rate:
            anomalies += _inject_errors(
                spans,
                error_rate=self._error_rate,
                random=self._get_error_random(),
                run_nonce=self.run_nonce,
            )
        _extend_parent_end_times(spans)
        _clamp_event_times(spans)
        anomalies = _refresh_anomaly_latencies(anomalies, spans)
        return EmittedTrace(request=request, anomalies=anomalies)

    def _fresh_id(self, size: int) -> bytes:
        identifier = bytes(self._identity_random.bytes(size))
        while not any(identifier):
            identifier = bytes(self._identity_random.bytes(size))
        return identifier


def _business_hours_multiplier(timestamp_ns: int, timezone: ZoneInfo) -> float:
    local_time = datetime.fromtimestamp(timestamp_ns // 1_000_000_000, tz=timezone)
    if local_time.weekday() >= 5:
        return 0.10
    if 9 <= local_time.hour < 17:
        return 1.00
    if 17 <= local_time.hour < 23:
        return 0.15
    return 0.025


@dataclass(frozen=True)
class _LognormalFit:
    mean: float
    sigma: float

    @classmethod
    def from_values(cls, values: Sequence[int], default: int) -> _LognormalFit:
        logs = np.log(np.asarray(values or [default], dtype=float))
        return cls(mean=float(np.mean(logs)), sigma=max(0.15, float(np.std(logs))))


@dataclass(frozen=True)
class _NumericsEngine:
    prompt_fit: _LognormalFit
    completion_fit: _LognormalFit
    nanoseconds_per_completion_token: float
    epsilon: float
    random: np.random.Generator

    @classmethod
    def from_requests(
        cls,
        requests: Sequence[ExportTraceServiceRequest],
        *,
        epsilon: float,
        random: np.random.Generator,
    ) -> _NumericsEngine:
        prompt_values = []
        completion_values = []
        latency_per_token = []
        for request in requests:
            for span in _iter_spans(request):
                prompt = _numeric_attribute(span, _PROMPT_TOKENS)
                completion = _numeric_attribute(span, _COMPLETION_TOKENS)
                if prompt is not None and prompt > 0:
                    prompt_values.append(int(prompt))
                if completion is not None and completion > 0:
                    completion_values.append(int(completion))
                    duration = span.end_time_unix_nano - span.start_time_unix_nano
                    if duration > 0:
                        latency_per_token.append(duration / completion)
        return cls(
            prompt_fit=_LognormalFit.from_values(prompt_values, 100),
            completion_fit=_LognormalFit.from_values(completion_values, 50),
            nanoseconds_per_completion_token=float(
                np.median(latency_per_token) if latency_per_token else 5_000_000
            ),
            epsilon=epsilon,
            random=random,
        )

    def apply(self, spans: Sequence[Span], *, run_nonce: str) -> tuple[Anomaly, ...]:
        anomalies = []
        for span in spans:
            _remove_attributes(span, lambda key: key.startswith(_COST_PREFIX) or key == _ANOMALY)
            has_tokens = any(
                _numeric_attribute(span, key) is not None
                for key in (_PROMPT_TOKENS, _COMPLETION_TOKENS, _TOTAL_TOKENS)
            )
            if not has_tokens:
                continue

            prompt_tokens = max(
                1,
                int(round(self.random.lognormal(self.prompt_fit.mean, self.prompt_fit.sigma))),
            )
            completion_tokens = max(
                1,
                int(
                    round(
                        self.random.lognormal(
                            self.completion_fit.mean,
                            self.completion_fit.sigma,
                        )
                    )
                ),
            )
            is_anomaly = bool(self.random.random() < self.epsilon)
            if is_anomaly:
                inflation = 3.0 + float(self.random.pareto(2.0))
                prompt_tokens = max(prompt_tokens + 1, int(round(prompt_tokens * inflation)))
                completion_tokens = max(
                    completion_tokens + 1,
                    int(round(completion_tokens * inflation)),
                )

            total_tokens = prompt_tokens + completion_tokens
            latency_noise = float(self.random.lognormal(mean=-0.01125, sigma=0.15))
            latency_ns = max(
                1,
                int(
                    20_000_000
                    + completion_tokens * self.nanoseconds_per_completion_token * latency_noise
                ),
            )
            _set_int_attribute(span, _PROMPT_TOKENS, prompt_tokens)
            _set_int_attribute(span, _COMPLETION_TOKENS, completion_tokens)
            _set_int_attribute(span, _TOTAL_TOKENS, total_tokens)
            span.end_time_unix_nano = span.start_time_unix_nano + latency_ns
            if is_anomaly:
                _set_bool_attribute(span, _ANOMALY, True)
                anomalies.append(
                    Anomaly(
                        run_nonce=run_nonce,
                        trace_id=span.trace_id.hex(),
                        span_id=span.span_id.hex(),
                        inflated_fields={
                            _PROMPT_TOKENS: prompt_tokens,
                            _COMPLETION_TOKENS: completion_tokens,
                            _TOTAL_TOKENS: total_tokens,
                            "latency_ms": latency_ns / 1_000_000,
                        },
                        virtual_time_ns=span.start_time_unix_nano,
                    )
                )
        return tuple(anomalies)


def _inject_errors(
    spans: Sequence[Span],
    *,
    error_rate: float,
    random: np.random.Generator,
    run_nonce: str,
) -> tuple[Anomaly, ...]:
    spans_by_id = {span.span_id: span for span in spans}
    anomalies = []
    for span in spans:
        if _string_attribute(span, _SPAN_KIND) not in _ERROR_SPAN_KINDS:
            continue
        if random.random() >= error_rate:
            continue

        span.status.code = Status.STATUS_CODE_ERROR
        retained_events = [event for event in span.events if event.name != "exception"]
        del span.events[:]
        span.events.extend(retained_events)
        event = span.events.add(name="exception", time_unix_nano=span.end_time_unix_nano)
        for key, value in (
            ("exception.type", _ERROR_EXCEPTION_TYPE),
            ("exception.message", _ERROR_EXCEPTION_MESSAGE),
            ("exception.stacktrace", _ERROR_EXCEPTION_STACKTRACE),
        ):
            event.attributes.add(key=key).value.string_value = value
        anomalies.append(
            Anomaly(
                run_nonce=run_nonce,
                trace_id=span.trace_id.hex(),
                span_id=span.span_id.hex(),
                inflated_fields={},
                kind="error_injection",
                virtual_time_ns=span.start_time_unix_nano,
            )
        )

        ancestor_id = span.parent_span_id
        visited = {span.span_id}
        while ancestor := spans_by_id.get(ancestor_id):
            if ancestor.span_id in visited:
                break
            ancestor.status.code = Status.STATUS_CODE_ERROR
            visited.add(ancestor.span_id)
            ancestor_id = ancestor.parent_span_id
    return tuple(anomalies)


def _extend_parent_end_times(spans: Sequence[Span]) -> None:
    spans_by_id = {span.span_id: span for span in spans}
    children_by_parent_id: dict[bytes, list[Span]] = defaultdict(list)
    for span in spans:
        if span.parent_span_id in spans_by_id:
            children_by_parent_id[span.parent_span_id].append(span)

    visiting: set[bytes] = set()
    finished: set[bytes] = set()

    def extend(span: Span) -> None:
        if span.span_id in finished or span.span_id in visiting:
            return
        visiting.add(span.span_id)
        children = children_by_parent_id[span.span_id]
        for child in children:
            extend(child)
        if children:
            span.end_time_unix_nano = max(
                span.end_time_unix_nano,
                max(child.end_time_unix_nano for child in children) + _PARENT_END_MARGIN_NS,
            )
        visiting.remove(span.span_id)
        finished.add(span.span_id)

    for span in spans:
        extend(span)


def _clamp_event_times(spans: Sequence[Span]) -> None:
    for span in spans:
        for event in span.events:
            event.time_unix_nano = min(
                span.end_time_unix_nano,
                max(span.start_time_unix_nano, event.time_unix_nano),
            )


def _shift_request_times(request: ExportTraceServiceRequest, offset_ns: int) -> None:
    for span in _iter_spans(request):
        span.start_time_unix_nano += offset_ns
        span.end_time_unix_nano += offset_ns
        for event in span.events:
            event.time_unix_nano += offset_ns


def _shift_emission_times(emission: EmittedTrace, offset_ns: int) -> EmittedTrace:
    _shift_request_times(emission.request, offset_ns)
    return EmittedTrace(
        request=emission.request,
        anomalies=tuple(
            replace(
                anomaly,
                virtual_time_ns=(
                    None if anomaly.virtual_time_ns is None else anomaly.virtual_time_ns + offset_ns
                ),
            )
            for anomaly in emission.anomalies
        ),
    )


def _refresh_anomaly_latencies(
    anomalies: Sequence[Anomaly],
    spans: Sequence[Span],
) -> tuple[Anomaly, ...]:
    spans_by_id = {span.span_id.hex(): span for span in spans}
    refreshed = []
    for anomaly in anomalies:
        if anomaly.kind != "token_inflation":
            refreshed.append(anomaly)
            continue
        span = spans_by_id[anomaly.span_id]
        inflated_fields = dict(anomaly.inflated_fields)
        inflated_fields["latency_ms"] = (
            span.end_time_unix_nano - span.start_time_unix_nano
        ) / 1_000_000
        refreshed.append(replace(anomaly, inflated_fields=inflated_fields))
    return tuple(refreshed)


def _set_project_name(request: ExportTraceServiceRequest, project_name: str) -> None:
    for resource_spans in request.resource_spans:
        attributes = resource_spans.resource.attributes
        retained = [
            attribute
            for attribute in attributes
            if attribute.key != ResourceAttributes.PROJECT_NAME
        ]
        del attributes[:]
        attributes.extend(retained)
        attribute = attributes.add(key=ResourceAttributes.PROJECT_NAME)
        attribute.value.string_value = project_name


def _split_traces(
    request: ExportTraceServiceRequest,
) -> tuple[ExportTraceServiceRequest, ...]:
    trace_ids = list(dict.fromkeys(span.trace_id for span in _iter_spans(request)))
    requests = []
    for trace_id in trace_ids:
        trace_request = ExportTraceServiceRequest()
        for resource_spans in request.resource_spans:
            matching_scopes = []
            for scope_spans in resource_spans.scope_spans:
                matching_spans = [span for span in scope_spans.spans if span.trace_id == trace_id]
                if matching_spans:
                    matching_scopes.append((scope_spans, matching_spans))
            if not matching_scopes:
                continue
            new_resource_spans = trace_request.resource_spans.add()
            new_resource_spans.resource.CopyFrom(resource_spans.resource)
            new_resource_spans.schema_url = resource_spans.schema_url
            for scope_spans, matching_spans in matching_scopes:
                new_scope_spans = new_resource_spans.scope_spans.add()
                new_scope_spans.scope.CopyFrom(scope_spans.scope)
                new_scope_spans.schema_url = scope_spans.schema_url
                new_scope_spans.spans.extend(matching_spans)
        requests.append(trace_request)
    return tuple(requests)


def _iter_spans(request: ExportTraceServiceRequest):  # type: ignore[no-untyped-def]
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _attribute(span: Span, key: str):  # type: ignore[no-untyped-def]
    return next((attribute for attribute in span.attributes if attribute.key == key), None)


def _numeric_attribute(span: Span, key: str) -> int | float | None:
    attribute = _attribute(span, key)
    if attribute is None:
        return None
    value_type = attribute.value.WhichOneof("value")
    if value_type == "int_value":
        return cast(int, attribute.value.int_value)
    if value_type == "double_value":
        return cast(float, attribute.value.double_value)
    return None


def _string_attribute(span: Span, key: str) -> str | None:
    attribute = _attribute(span, key)
    if attribute is None or attribute.value.WhichOneof("value") != "string_value":
        return None
    return cast(str, attribute.value.string_value)


def _ensure_attribute(span: Span, key: str):  # type: ignore[no-untyped-def]
    attribute = _attribute(span, key)
    if attribute is None:
        attribute = span.attributes.add(key=key)
    attribute.value.Clear()
    return attribute


def _set_int_attribute(span: Span, key: str, value: int) -> None:
    _ensure_attribute(span, key).value.int_value = value


def _set_string_attribute(span: Span, key: str, value: str) -> None:
    _ensure_attribute(span, key).value.string_value = value


def _set_bool_attribute(span: Span, key: str, value: bool) -> None:
    _ensure_attribute(span, key).value.bool_value = value


def _remove_attributes(span: Span, predicate):  # type: ignore[no-untyped-def]
    retained = [attribute for attribute in span.attributes if not predicate(attribute.key)]
    del span.attributes[:]
    span.attributes.extend(retained)
