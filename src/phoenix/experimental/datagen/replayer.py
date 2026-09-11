"""Rewrite and schedule recorded trace requests."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from math import log
from typing import Sequence, cast

import numpy as np
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span

from phoenix.experimental.datagen.composer import SessionComposer
from phoenix.experimental.datagen.loader import Corpus

_SESSION_ID = "session.id"
_PROMPT_TOKENS = "llm.token_count.prompt"
_COMPLETION_TOKENS = "llm.token_count.completion"
_TOTAL_TOKENS = "llm.token_count.total"
_COST_PREFIX = "llm.cost."
_PARENT_END_MARGIN_NS = 1
_JITTER_SIGMA = 0.1
_SLOW_TAIL_PROBABILITY = 0.05
_SLOW_TAIL_MEDIAN = 4.0
_SLOW_TAIL_SIGMA = 0.75


class Replayer:
    """Continuously produce varied traces while preserving recorded structure."""

    def __init__(
        self,
        corpus: Corpus,
        *,
        project_name: str | None = None,
        _random: np.random.Generator | None = None,
    ) -> None:
        self._random = _random or np.random.default_rng()
        self._project_name = project_name or "phoenix-datagen"
        self._composer = SessionComposer(corpus, random=self._random)
        self._queue: deque[ExportTraceServiceRequest] = deque()

    def emit(self, *, now_ns: int | None = None) -> ExportTraceServiceRequest:
        """Emit the next scheduled trace with fresh identity and numeric values."""
        current_time_ns = time.time_ns() if now_ns is None else now_ns
        if not self._queue:
            self._begin_composed_session(now_ns=current_time_ns)
        return self._queue.popleft()

    def interarrival_seconds(self, *, rate: float, burstiness: float) -> float:
        """Draw the delay before the next trace for a traces-per-minute rate."""
        if rate <= 0:
            raise ValueError("rate must be greater than zero")
        if burstiness < 0:
            raise ValueError("burstiness must not be negative")
        mean_interval = 60.0 / rate
        if burstiness == 0:
            return mean_interval
        multiplier = self._random.lognormal(
            mean=-(burstiness**2) / 2,
            sigma=burstiness,
        )
        return float(mean_interval * multiplier)

    def _begin_composed_session(self, *, now_ns: int) -> None:
        session = self._composer.compose(now_ns=now_ns)
        domain = session.fragments[0].domain
        session_id = f"{domain}-{self._fresh_id(16).hex()}"
        emissions = [
            self._rewrite(
                trace.request,
                now_ns=trace.virtual_start_ns,
                session_id=session_id,
            )
            for trace in session.traces
        ]
        latest_end_ns = max(
            span.end_time_unix_nano for emission in emissions for span in _iter_spans(emission)
        )
        if latest_end_ns > now_ns:
            offset_ns = now_ns - latest_end_ns
            for emission in emissions:
                _shift_request_times(emission, offset_ns)
        self._queue.extend(emissions)

    def _rewrite(
        self,
        template: ExportTraceServiceRequest,
        *,
        now_ns: int,
        session_id: str,
    ) -> ExportTraceServiceRequest:
        request = ExportTraceServiceRequest()
        request.CopyFrom(template)
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
            _set_string_attribute(span, _SESSION_ID, session_id)

        _jitter_numerics(spans, random=self._random)
        _extend_parent_end_times(spans)
        _clamp_event_times(spans)
        return request

    def _fresh_id(self, size: int) -> bytes:
        identifier = bytes(self._random.bytes(size))
        while not any(identifier):
            identifier = bytes(self._random.bytes(size))
        return identifier


def _jitter_numerics(
    spans: Sequence[Span],
    *,
    random: np.random.Generator,
) -> None:
    for span in spans:
        _remove_attributes(span, lambda key: key.startswith(_COST_PREFIX))
        prompt = _positive_int_attribute(span, _PROMPT_TOKENS)
        completion = _positive_int_attribute(span, _COMPLETION_TOKENS)
        total = _positive_int_attribute(span, _TOTAL_TOKENS)
        if prompt is not None:
            prompt = _jitter_positive_int(prompt, random=random)
            _set_int_attribute(span, _PROMPT_TOKENS, prompt)
        if completion is not None:
            completion = _jitter_positive_int(completion, random=random)
            _set_int_attribute(span, _COMPLETION_TOKENS, completion)
        if prompt is not None or completion is not None:
            if total is not None:
                _set_int_attribute(span, _TOTAL_TOKENS, (prompt or 0) + (completion or 0))
        elif total is not None:
            _set_int_attribute(
                span,
                _TOTAL_TOKENS,
                _jitter_positive_int(total, random=random),
            )

        duration = max(1, span.end_time_unix_nano - span.start_time_unix_nano)
        span.end_time_unix_nano = span.start_time_unix_nano + _jitter_positive_int(
            duration,
            random=random,
        )

    # Occasionally stretch one span into a genuine slow outlier so latency
    # distributions carry a fat tail instead of hugging the recorded durations.
    if spans and random.random() < _SLOW_TAIL_PROBABILITY:
        parent_ids = {span.parent_span_id for span in spans}
        leaves = [span for span in spans if span.span_id not in parent_ids] or list(spans)
        span = max(leaves, key=lambda s: s.end_time_unix_nano - s.start_time_unix_nano)
        duration = max(1, span.end_time_unix_nano - span.start_time_unix_nano)
        factor = float(random.lognormal(mean=log(_SLOW_TAIL_MEDIAN), sigma=_SLOW_TAIL_SIGMA))
        span.end_time_unix_nano = span.start_time_unix_nano + max(1, round(duration * factor))


def _jitter_positive_int(value: int, *, random: np.random.Generator) -> int:
    factor = float(random.lognormal(mean=0.0, sigma=_JITTER_SIGMA))
    jittered = max(1, round(value * factor))
    if jittered == value:
        return value + 1 if factor >= 1.0 or value == 1 else value - 1
    return jittered


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


def _positive_int_attribute(span: Span, key: str) -> int | None:
    value = _numeric_attribute(span, key)
    if value is None or value <= 0:
        return None
    return int(value)


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


def _remove_attributes(span: Span, predicate):  # type: ignore[no-untyped-def]
    retained = [attribute for attribute in span.attributes if not predicate(attribute.key)]
    del span.attributes[:]
    span.attributes.extend(retained)
