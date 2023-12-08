from datetime import datetime, timezone
from typing import Generator, Iterator
from uuid import UUID

from llama_index.callbacks.schema import TIMESTAMP_FORMAT

from phoenix.trace.schemas import SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import OUTPUT_VALUE

_LOCAL_TZINFO = datetime.now().astimezone().tzinfo


class TokenGenInstrumentor(Iterator[str]):
    def __init__(self, stream: Generator[str, None, None], tracer, event_data):
        self._stream = stream
        self._token_stream = []
        self._finished = False
        self._tracer = tracer
        self._event_data = event_data

    def __iter__(self) -> "TokenGenInstrumentor":
        return self

    def __next__(self) -> str:
        if self._finished:
            raise StopIteration

        try:
            value = next(self._stream)
            self._token_stream.append(value)
            return value
        except StopIteration:
            self._finished = True
            self._handle_end_of_stream()
            raise

    def _handle_end_of_stream(self):
        # Handle the end-of-stream logic here
        parent_id = self._event_data.parent_id
        output = "".join(self._token_stream)
        start_time = _timestamp_to_tz_aware_datetime(self._event_data.start_event.time)
        attributes = self._event_data.attributes
        attributes.update({OUTPUT_VALUE: output})
        self._tracer.create_span(
            name=self._event_data.name,
            span_kind=SpanKind.LLM,
            trace_id=self._event_data.trace_id,
            start_time=start_time,
            end_time=datetime.now(timezone.utc),
            status_code=SpanStatusCode.OK,
            status_message="",
            parent_id=UUID(parent_id) if parent_id else None,
            attributes=self._event_data.attributes,
            events=[],
            conversation=None,
            span_id=UUID(self._event_data.span_id),
        )


def instrument_streaming_response(
    response,
    tracer,
    event_data,
):
    if response.response_gen is not None:
        response.response_gen = TokenGenInstrumentor(response.response_gen, tracer, event_data)
    return response


def _timestamp_to_tz_aware_datetime(timestamp: str) -> datetime:
    """Converts a timestamp string to a timezone-aware datetime."""
    return _tz_naive_to_tz_aware_datetime(_timestamp_to_tz_naive_datetime(timestamp))


def _timestamp_to_tz_naive_datetime(timestamp: str) -> datetime:
    """Converts a timestamp string to a timezone-naive datetime."""
    return datetime.strptime(timestamp, TIMESTAMP_FORMAT)


def _tz_naive_to_tz_aware_datetime(timestamp: datetime) -> datetime:
    """Converts a timezone-naive datetime to a timezone-aware datetime."""
    return timestamp.replace(tzinfo=_LOCAL_TZINFO)
