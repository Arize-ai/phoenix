import weakref
from collections import defaultdict
from datetime import datetime, timedelta
from queue import SimpleQueue
from threading import Lock, Thread
from typing import (
    Any,
    DefaultDict,
    Dict,
    Iterable,
    List,
    Mapping,
    Optional,
    SupportsFloat,
    cast,
)

from sortedcontainers import SortedKeyList
from typing_extensions import TypeAlias
from wrapt import ObjectProxy

import phoenix.trace.semantic_conventions as sc
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span, SpanID, TraceID

NAME = "name"
STATUS_CODE = "status_code"
SPAN_KIND = "span_kind"
TRACE_ID = CONTEXT_PREFIX + "trace_id"
SPAN_ID = CONTEXT_PREFIX + "span_id"
PARENT_ID = "parent_id"
START_TIME = "start_time"
END_TIME = "end_time"
LLM_TOKEN_COUNT_TOTAL = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_TOTAL
LLM_TOKEN_COUNT_PROMPT = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = ATTRIBUTE_PREFIX + sc.LLM_TOKEN_COUNT_COMPLETION
COMPUTED_NUMERIC_PREFIX = "__computed_numeric__."
LATENCY_MS = COMPUTED_NUMERIC_PREFIX + "latency_ms"
"The latency (or duration) of the span in milliseconds"
CUMULATIVE_LLM_TOKEN_COUNT_TOTAL = COMPUTED_NUMERIC_PREFIX + "cumulative_token_count_total"
CUMULATIVE_LLM_TOKEN_COUNT_PROMPT = COMPUTED_NUMERIC_PREFIX + "cumulative_token_count_prompt"
CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION = (
    COMPUTED_NUMERIC_PREFIX + "cumulative_token_count_completion"
)


class ReadableSpan(ObjectProxy):  # type: ignore
    __wrapped__: Span

    def __init__(self, span: Span) -> None:
        super().__init__(span)
        self._self_computed_numeric_values: Dict[str, SupportsFloat] = {}

    def __getitem__(self, key: str) -> Any:
        if key.startswith(COMPUTED_NUMERIC_PREFIX):
            return self._self_computed_numeric_values.get(key)
        if key.startswith(CONTEXT_PREFIX):
            return getattr(
                self.__wrapped__.context,
                key[len(CONTEXT_PREFIX) :],
                None,
            )
        if key.startswith(ATTRIBUTE_PREFIX):
            return self.__wrapped__.attributes.get(
                key[len(ATTRIBUTE_PREFIX) :],
            )
        return getattr(self.__wrapped__, key, None)

    def __setitem__(self, key: str, value: Any) -> None:
        if not key.startswith(COMPUTED_NUMERIC_PREFIX):
            raise KeyError(f"{key} is not a computed value")
        self._self_computed_numeric_values[key] = value


ParentSpanID: TypeAlias = SpanID
ChildSpanID: TypeAlias = SpanID


class Traces:
    def __init__(
        self,
        spans: Optional[Iterable[Span]] = None,
    ) -> None:
        self._queue: "SimpleQueue[Optional[Span]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._queue.put, None)
        for span in spans or ():
            self._queue.put(span)
        self._lock = Lock()
        self._spans: Dict[SpanID, ReadableSpan] = {}
        self._parent_span_ids: Dict[SpanID, ParentSpanID] = {}
        self._traces: Dict[TraceID, List[SpanID]] = defaultdict(list)
        self._child_span_ids: DefaultDict[SpanID, List[ChildSpanID]] = defaultdict(list)
        self._orphan_spans: DefaultDict[ParentSpanID, List[Span]] = defaultdict(list)
        self._start_time_sorted_span_ids: SortedKeyList[SpanID] = SortedKeyList(
            key=lambda span_id: self._spans[span_id].start_time.timestamp(),
        )
        self._start_time_sorted_root_span_ids: SortedKeyList[SpanID] = SortedKeyList(
            key=lambda span_id: self._spans[span_id].start_time.timestamp(),
        )
        self._latency_sorted_root_span_ids: SortedKeyList[SpanID] = SortedKeyList(
            key=lambda span_id: self._spans[span_id][LATENCY_MS],
        )
        self._min_start_time: Optional[datetime] = None
        self._max_start_time: Optional[datetime] = None
        Thread(target=self._consume_spans, daemon=True).start()

    def put(self, span: Optional[Span] = None) -> None:
        self._queue.put(span)

    def get_trace(
        self,
        trace_id: TraceID,
    ) -> List[ReadableSpan]:
        with self._lock:
            return list(
                map(
                    self._spans.__getitem__,
                    self._traces[trace_id],
                )
            )

    def get_spans(
        self,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = False,
    ) -> List[ReadableSpan]:
        if not self._spans:
            return []
        start_time = start_time or cast(
            datetime,
            self._min_start_time,
        )
        stop_time = stop_time or (
            cast(
                datetime,
                self._max_start_time,
            )
            + timedelta(minutes=1)
        )
        sorted_span_ids = (
            self._start_time_sorted_root_span_ids
            if root_spans_only
            else self._start_time_sorted_span_ids
        )
        with self._lock:
            return list(
                map(
                    self._spans.__getitem__,
                    sorted_span_ids.irange_key(
                        start_time.timestamp(),
                        stop_time.timestamp(),
                        inclusive=(True, False),
                        reverse=True,  # most recent spans first
                    ),
                )
            )

    def latency_rank_percent(
        self,
        latency_ms: float,
    ) -> float:
        root_span_ids = self._latency_sorted_root_span_ids
        with self._lock:
            return cast(
                int,
                root_span_ids.bisect_key_left(
                    latency_ms,
                ),
            ) / len(root_span_ids)

    def get_descendant_span_ids(self, span_id: SpanID) -> List[SpanID]:
        with self._lock:
            return list(
                _get_descendant_span_ids(
                    span_id,
                    self._child_span_ids,
                )
            )

    @property
    def span_count(self) -> int:
        """Total number of spans (excluding orphan spans if any)"""
        with self._lock:
            return len(self._spans)

    @property
    def min_start_time(self) -> Optional[datetime]:
        with self._lock:
            return self._min_start_time

    @property
    def max_start_time(self) -> Optional[datetime]:
        with self._lock:
            return self._max_start_time

    def __len__(self) -> int:
        """Total number of traces"""
        with self._lock:
            return len(self._start_time_sorted_root_span_ids)

    def __getitem__(self, key: SpanID) -> Optional[ReadableSpan]:
        with self._lock:
            return self._spans.get(key)

    def _consume_spans(self) -> None:
        while True:
            if not (span := self._queue.get()):
                return
            with self._lock:
                self._process_span(span)

    def _process_span(self, span: Span) -> None:
        span_id = span.context.span_id
        existing_span = self._spans.get(span_id)
        if existing_span and existing_span.end_time:
            # Reject updates if span has ended
            return
        if parent_id := span.parent_id:
            if parent_id not in self._spans:
                # Span can't be processed before its parent
                self._orphan_spans[parent_id].append(span)
                return
            self._child_span_ids[parent_id].append(span_id)
            self._parent_span_ids[span_id] = parent_id
        new_span = ReadableSpan(span)
        if span.end_time:
            new_span[LATENCY_MS] = (span.end_time - span.start_time).total_seconds() * 1000
        self._spans[span_id] = new_span
        if not parent_id and span.end_time:
            self._latency_sorted_root_span_ids.add(span_id)
        if not existing_span:
            if not parent_id:
                self._start_time_sorted_root_span_ids.add(span_id)
            self._start_time_sorted_span_ids.add(span_id)
            self._min_start_time = (
                span.start_time
                if self._min_start_time is None
                else min(self._min_start_time, span.start_time)
            )
            self._max_start_time = (
                span.start_time
                if self._max_start_time is None
                else max(self._max_start_time, span.start_time)
            )
        # Update cumulative values for span's ancestors
        for attribute_name, cumulative_attribute_name in (
            (LLM_TOKEN_COUNT_TOTAL, CUMULATIVE_LLM_TOKEN_COUNT_TOTAL),
            (LLM_TOKEN_COUNT_PROMPT, CUMULATIVE_LLM_TOKEN_COUNT_PROMPT),
            (LLM_TOKEN_COUNT_COMPLETION, CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION),
        ):
            existing_value = (existing_span[attribute_name] or 0) if existing_span else 0
            new_value = new_span[attribute_name] or 0
            if not (difference := new_value - existing_value):
                continue
            existing_cumulative_value = (
                (existing_span[cumulative_attribute_name] or 0) if existing_span else 0
            )
            new_span[cumulative_attribute_name] = difference + existing_cumulative_value
            self._add_value_to_span_ancestors(
                difference,
                span_id,
                cumulative_attribute_name,
            )
        # Process previously orphan spans if any
        for orphan_span in self._orphan_spans[span_id]:
            self._process_span(orphan_span)

    def _add_value_to_span_ancestors(
        self,
        value: float,
        span_id: SpanID,
        cumulative_attribute_name: str,
    ) -> None:
        while parent_span_id := self._parent_span_ids.get(span_id):
            parent_span = self._spans[parent_span_id]
            cumulative_value = parent_span[cumulative_attribute_name] or 0
            parent_span[cumulative_attribute_name] = cumulative_value + value
            span_id = parent_span_id


def _get_descendant_span_ids(
    span_id: SpanID,
    child_span_ids: Mapping[SpanID, List[ChildSpanID]],
) -> Iterable[SpanID]:
    for child_span_id in child_span_ids.get(span_id) or []:
        yield child_span_id
        yield from _get_descendant_span_ids(child_span_id, child_span_ids)
