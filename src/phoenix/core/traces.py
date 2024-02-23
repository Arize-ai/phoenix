import weakref
from collections import defaultdict
from datetime import datetime, timezone
from queue import SimpleQueue
from threading import RLock, Thread
from types import MappingProxyType, MethodType
from typing import (
    Any,
    DefaultDict,
    Dict,
    Iterable,
    Iterator,
    Optional,
    Set,
    SupportsFloat,
    Tuple,
    cast,
)

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from ddsketch import DDSketch
from openinference.semconv.trace import SpanAttributes
from sortedcontainers import SortedKeyList
from typing_extensions import TypeAlias
from wrapt import ObjectProxy

import phoenix.trace.schemas
from phoenix.datetime_utils import right_open_time_range
from phoenix.trace.otel import decode
from phoenix.trace.schemas import (
    ATTRIBUTE_PREFIX,
    COMPUTED_PREFIX,
    CONTEXT_PREFIX,
    ComputedAttributes,
    Span,
    SpanID,
    SpanStatusCode,
    TraceID,
)

END_OF_QUEUE = None  # sentinel value for queue termination

NAME = "name"
STATUS_CODE = "status_code"
SPAN_KIND = "span_kind"
TRACE_ID = CONTEXT_PREFIX + "trace_id"
SPAN_ID = CONTEXT_PREFIX + "span_id"
PARENT_ID = "parent_id"
START_TIME = "start_time"
END_TIME = "end_time"
LLM_TOKEN_COUNT_TOTAL = ATTRIBUTE_PREFIX + SpanAttributes.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = ATTRIBUTE_PREFIX + SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = ATTRIBUTE_PREFIX + SpanAttributes.LLM_TOKEN_COUNT_COMPLETION


class ReadableSpan(ObjectProxy):  # type: ignore
    """
    A wrapped a protobuf Span, with access methods and ability to decode to
    a python span. It's meant to be interface layer separating use from
    implementation. It can also provide computed values that are not intrinsic
    to the span, e.g. the latency rank percent which can change as more spans
    are ingested, and would need to be re-computed on the fly.
    """

    def __init__(self, otlp_span: otlp.Span) -> None:
        span = decode(otlp_span)
        super().__init__(span)
        self._self_otlp_span = otlp_span
        self._self_computed_values: Dict[str, SupportsFloat] = {}

    @property
    def span(self) -> Span:
        span = decode(self._self_otlp_span)
        # FIXME: Our legacy files have the __computed__ attributes which interferes
        # with our ability to add more computations. As a workaround, we discard the computed
        # attribute if it exists.
        span.attributes.pop(COMPUTED_PREFIX[:-1], None)
        span.attributes.update(
            cast(phoenix.trace.schemas.SpanAttributes, self._self_computed_values)
        )
        # TODO: compute latency rank percent (which can change depending on how
        # many spans already ingested).
        return span

    def __getitem__(self, key: str) -> Any:
        if key.startswith(COMPUTED_PREFIX):
            return self._self_computed_values.get(key)
        if key.startswith(CONTEXT_PREFIX):
            suffix_key = key[len(CONTEXT_PREFIX) :]
            return getattr(self.__wrapped__.context, suffix_key, None)
        if key.startswith(ATTRIBUTE_PREFIX):
            suffix_key = key[len(ATTRIBUTE_PREFIX) :]
            return self.__wrapped__.attributes.get(suffix_key)
        return getattr(self.__wrapped__, key, None)

    def __setitem__(self, key: str, value: Any) -> None:
        if not key.startswith(COMPUTED_PREFIX):
            raise KeyError(f"{key} is not a computed value")
        self._self_computed_values[key] = value

    def __eq__(self, other: Any) -> bool:
        return self is other

    def __hash__(self) -> int:
        return id(self)


ParentSpanID: TypeAlias = SpanID
ChildSpanID: TypeAlias = SpanID


class Traces:
    def __init__(self) -> None:
        self._queue: "SimpleQueue[Optional[otlp.Span]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, END_OF_QUEUE)
        self._lock = RLock()
        self._spans: Dict[SpanID, ReadableSpan] = {}
        self._parent_span_ids: Dict[SpanID, ParentSpanID] = {}
        self._traces: DefaultDict[TraceID, Set[ReadableSpan]] = defaultdict(set)
        self._child_spans: DefaultDict[SpanID, Set[ReadableSpan]] = defaultdict(set)
        self._num_documents: DefaultDict[SpanID, int] = defaultdict(int)
        self._start_time_sorted_spans: SortedKeyList[ReadableSpan] = SortedKeyList(
            key=lambda span: span.start_time,
        )
        self._start_time_sorted_root_spans: SortedKeyList[ReadableSpan] = SortedKeyList(
            key=lambda span: span.start_time,
        )
        self._latency_sorted_root_spans: SortedKeyList[ReadableSpan] = SortedKeyList(
            key=lambda span: span[ComputedAttributes.LATENCY_MS.value],
        )
        self._root_span_latency_ms_sketch = DDSketch()
        self._token_count_total: int = 0
        self._last_updated_at: Optional[datetime] = None
        self._start_consumer()

    def put(self, span: Optional[otlp.Span] = None) -> None:
        self._queue.put(span)

    def get_trace(self, trace_id: TraceID) -> Iterator[Span]:
        with self._lock:
            # make a copy because source data can mutate during iteration
            if not (trace := self._traces.get(trace_id)):
                return
            spans = tuple(trace)
        for span in spans:
            yield span.span

    def get_spans(
        self,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = False,
        span_ids: Optional[Iterable[SpanID]] = None,
    ) -> Iterator[Span]:
        if not self._spans:
            return
        min_start_time, max_stop_time = cast(
            Tuple[datetime, datetime],
            self.right_open_time_range,
        )
        start_time = start_time or min_start_time
        stop_time = stop_time or max_stop_time
        if span_ids is not None:
            with self._lock:
                spans = tuple(
                    span
                    for span_id in span_ids
                    if (
                        (span := self._spans.get(span_id))
                        and start_time <= span.start_time < stop_time
                        and (not root_spans_only or span.parent_id is None)
                    )
                )
        else:
            sorted_spans = (
                self._start_time_sorted_root_spans
                if root_spans_only
                else self._start_time_sorted_spans
            )
            # make a copy because source data can mutate during iteration
            with self._lock:
                spans = tuple(
                    sorted_spans.irange_key(
                        start_time.astimezone(timezone.utc),
                        stop_time.astimezone(timezone.utc),
                        inclusive=(True, False),
                        reverse=True,  # most recent spans first
                    )
                )
        for span in spans:
            yield span.span

    def get_num_documents(self, span_id: SpanID) -> int:
        with self._lock:
            return self._num_documents.get(span_id) or 0

    def latency_rank_percent(self, latency_ms: float) -> Optional[float]:
        """
        Returns a value between 0 and 100 approximating the rank of the
        latency value as percent of the total count of root spans. E.g., for
        a latency value at the 75th percentile, the result is roughly 75.
        """
        root_spans = self._latency_sorted_root_spans
        if not (n := len(root_spans)):
            return None
        with self._lock:
            rank = cast(int, root_spans.bisect_key_left(latency_ms))
        return rank / n * 100

    def root_span_latency_ms_quantiles(self, *probabilities: float) -> Iterator[Optional[float]]:
        """Root span latency quantiles in milliseconds"""
        with self._lock:
            values = tuple(
                self._root_span_latency_ms_sketch.get_quantile_value(probability)
                for probability in probabilities
            )
        yield from values

    def get_descendant_spans(self, span_id: SpanID) -> Iterator[Span]:
        for span in self._get_descendant_spans(span_id):
            yield span.span

    def _get_descendant_spans(self, span_id: SpanID) -> Iterator[ReadableSpan]:
        with self._lock:
            # make a copy because source data can mutate during iteration
            if not (child_spans := self._child_spans.get(span_id)):
                return
            spans = tuple(child_spans)
        for child_span in spans:
            yield child_span
            yield from self._get_descendant_spans(child_span.context.span_id)

    @property
    def last_updated_at(self) -> Optional[datetime]:
        return self._last_updated_at

    @property
    def span_count(self) -> int:
        """Total number of spans"""
        return len(self._spans)

    @property
    def token_count_total(self) -> int:
        return self._token_count_total

    @property
    def right_open_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        if not self._start_time_sorted_spans:
            return None, None
        with self._lock:
            first_span = self._start_time_sorted_spans[0]
            last_span = self._start_time_sorted_spans[-1]
        min_start_time = first_span.start_time
        max_start_time = last_span.start_time
        return right_open_time_range(min_start_time, max_start_time)

    def __getitem__(self, span_id: SpanID) -> Optional[Span]:
        with self._lock:
            if span := self._spans.get(span_id):
                return span.span
        return None

    def _start_consumer(self) -> None:
        Thread(
            target=MethodType(
                self.__class__._consume_spans,
                weakref.proxy(self),
            ),
            daemon=True,
        ).start()

    def _consume_spans(self) -> None:
        while (item := self._queue.get()) is not END_OF_QUEUE:
            with self._lock:
                self._process_span(item)

    def _process_span(self, otlp_span: otlp.Span) -> None:
        span = ReadableSpan(otlp_span)
        span_id = span.context.span_id
        if span_id in self._spans:
            # Update is not allowed.
            return

        parent_span_id = span.parent_id
        is_root_span = parent_span_id is None
        if not is_root_span:
            self._child_spans[parent_span_id].add(span)
            self._parent_span_ids[span_id] = parent_span_id

        # Add computed attributes to span
        start_time = span.start_time
        end_time = span.end_time
        span[ComputedAttributes.LATENCY_MS.value] = latency = (
            end_time - start_time
        ).total_seconds() * 1000
        if is_root_span:
            self._root_span_latency_ms_sketch.add(latency)
        span[ComputedAttributes.ERROR_COUNT.value] = int(span.status_code is SpanStatusCode.ERROR)

        # Store the new span (after adding computed attributes)
        self._spans[span_id] = span
        self._traces[span.context.trace_id].add(span)
        self._start_time_sorted_spans.add(span)
        if is_root_span:
            self._start_time_sorted_root_spans.add(span)
            self._latency_sorted_root_spans.add(span)
        self._propagate_cumulative_values(span)
        self._update_cached_statistics(span)

        # Update last updated timestamp, letting users know
        # when they should refresh the page.
        self._last_updated_at = datetime.now(timezone.utc)

    def _update_cached_statistics(self, span: ReadableSpan) -> None:
        # Update statistics for quick access later
        span_id = span.context.span_id
        if token_count_update := span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_TOTAL):
            self._token_count_total += token_count_update
        if num_documents_update := len(
            span.attributes.get(SpanAttributes.RETRIEVAL_DOCUMENTS) or ()
        ):
            self._num_documents[span_id] += num_documents_update

    def _propagate_cumulative_values(self, span: ReadableSpan) -> None:
        child_spans: Iterable[ReadableSpan] = self._child_spans.get(span.context.span_id) or ()
        for cumulative_attribute, attribute in _CUMULATIVE_ATTRIBUTES.items():
            span[cumulative_attribute] = span[attribute] or 0
            for child_span in child_spans:
                span[cumulative_attribute] += child_span[cumulative_attribute] or 0
        self._update_ancestors(span)

    def _update_ancestors(self, span: ReadableSpan) -> None:
        # Add cumulative values to each of the span's ancestors.
        span_id = span.context.span_id
        for attribute in _CUMULATIVE_ATTRIBUTES.keys():
            value = span[attribute] or 0
            self._add_value_to_span_ancestors(span_id, attribute, value)

    def _add_value_to_span_ancestors(
        self,
        span_id: SpanID,
        attribute_name: str,
        value: float,
    ) -> None:
        while parent_span_id := self._parent_span_ids.get(span_id):
            if not (parent_span := self._spans.get(parent_span_id)):
                return
            cumulative_value = parent_span[attribute_name] or 0
            parent_span[attribute_name] = cumulative_value + value
            span_id = parent_span_id


_CUMULATIVE_ATTRIBUTES = MappingProxyType(
    {
        ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL.value: LLM_TOKEN_COUNT_TOTAL,
        ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT.value: LLM_TOKEN_COUNT_PROMPT,
        ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION.value: LLM_TOKEN_COUNT_COMPLETION,
        ComputedAttributes.CUMULATIVE_ERROR_COUNT.value: ComputedAttributes.ERROR_COUNT.value,
    }
)
