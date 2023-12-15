import json
from collections import defaultdict
from datetime import datetime, timezone
from random import Random
from typing import (
    Any,
    Container,
    DefaultDict,
    Dict,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    cast,
)
from uuid import UUID

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList
from opentelemetry.util.types import Attributes, AttributeValue
from typing_extensions import TypeAlias, assert_never

from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanEvent,
    SpanException,
    SpanID,
    SpanKind,
    SpanStatusCode,
    TraceID,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_METADATA,
    EMBEDDING_EMBEDDINGS,
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    LLM_INPUT_MESSAGES,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    OPENINFERENCE_SPAN_KIND,
    RETRIEVAL_DOCUMENTS,
)


def decode(otlp_span: otlp.Span) -> Span:
    trace_id = cast(TraceID, _decode_identifier(otlp_span.trace_id))
    span_id = cast(SpanID, _decode_identifier(otlp_span.span_id))
    parent_id = _decode_identifier(otlp_span.parent_span_id)

    start_time = _decode_unix_nano(otlp_span.start_time_unix_nano)
    end_time = (
        _decode_unix_nano(otlp_span.end_time_unix_nano) if otlp_span.end_time_unix_nano else None
    )

    attributes = dict(_decode_key_values(otlp_span.attributes))
    span_kind = SpanKind(attributes.pop(OPENINFERENCE_SPAN_KIND, None))

    for prefix, json_loads_sub_keys in (
        (RETRIEVAL_DOCUMENTS, (DOCUMENT_METADATA,)),
        (EMBEDDING_EMBEDDINGS, ()),
        (LLM_INPUT_MESSAGES, ()),
        (LLM_OUTPUT_MESSAGES, ()),
    ):
        attributes = _consolidate_prefixed_keys_into_list(attributes, prefix, json_loads_sub_keys)

    for prefix, json_loads_sub_keys in ((LLM_PROMPT_TEMPLATE_VARIABLES, ()),):
        attributes = _consolidate_prefixed_keys_into_dict(attributes, prefix, json_loads_sub_keys)

    status_code, status_message = _decode_status(otlp_span.status)
    events = [_decode_event(event) for event in otlp_span.events]

    return Span(
        name=otlp_span.name,
        context=SpanContext(
            trace_id=trace_id,
            span_id=span_id,
        ),
        parent_id=parent_id,
        start_time=start_time,
        end_time=end_time,
        attributes=attributes,
        span_kind=span_kind,
        status_code=status_code,
        status_message=status_message,
        events=events,
        conversation=None,
    )


def _decode_identifier(identifier: bytes) -> Optional[UUID]:
    # This is a stopgap solution until we move away from UUIDs.
    # The goal is to convert bytes to UUID in a deterministic way.
    if not identifier:
        return None
    try:
        # OTEL trace_id is 16 bytes, so it matches UUID's length, but
        # OTEL span_id is 8 bytes, so we double up by concatenating.
        return UUID(bytes=identifier[:8] + identifier[-8:])
    except ValueError:
        # Fallback to a seeding a UUID from the bytes.
        return UUID(int=int.from_bytes(identifier, byteorder="big"))


def _decode_events(
    otlp_events: Iterable[otlp.Span.Event],
) -> Iterator[SpanEvent]:
    for otlp_event in otlp_events:
        yield _decode_event(otlp_event)


def _decode_event(otlp_event: otlp.Span.Event) -> SpanEvent:
    name = otlp_event.name
    timestamp = _decode_unix_nano(otlp_event.time_unix_nano)
    attributes = dict(_decode_key_values(otlp_event.attributes))
    if name == "exception":
        return SpanException(
            timestamp=timestamp,
            message=attributes.get(EXCEPTION_MESSAGE) or "",
            exception_type=attributes.get(EXCEPTION_TYPE),
            exception_escaped=attributes.get(EXCEPTION_ESCAPED),
            exception_stacktrace=attributes.get(EXCEPTION_STACKTRACE),
        )
    return SpanEvent(
        name=name,
        timestamp=timestamp,
        attributes=attributes,
    )


def _decode_unix_nano(time_unix_nano: int) -> datetime:
    # floating point rounding error can cause the timestamp to be slightly different from expected
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


def _decode_key_values(
    key_values: Iterable[KeyValue],
    json_loads_sub_keys: Container[str] = (),
) -> Iterator[Tuple[str, Any]]:
    return ((kv.key, _decode_value(kv.value, kv.key in json_loads_sub_keys)) for kv in key_values)


def _decode_value(any_value: AnyValue, json_loadss: bool = False) -> Any:
    which = any_value.WhichOneof("value")
    if which == "string_value":
        if json_loadss:
            return json.loads(any_value.string_value)
        return any_value.string_value
    if which == "bool_value":
        return any_value.bool_value
    if which == "int_value":
        return any_value.int_value
    if which == "double_value":
        return any_value.double_value
    if which == "array_value":
        return [_decode_value(value) for value in any_value.array_value.values]
    if which == "kvlist_value":
        return dict(_decode_key_values(any_value.kvlist_value.values))
    if which == "bytes_value":
        return any_value.bytes_value
    if which is None:
        return None
    assert_never(which)


StatusMessage: TypeAlias = str


def _decode_status(otlp_status: otlp.Status) -> Tuple[SpanStatusCode, StatusMessage]:
    otlp_status_code = otlp_status.code
    if otlp_status_code is otlp.Status.StatusCode.STATUS_CODE_OK:
        status_code = SpanStatusCode.OK
    elif otlp_status_code is otlp.Status.StatusCode.STATUS_CODE_ERROR:
        status_code = SpanStatusCode.ERROR
    elif otlp_status_code is otlp.Status.StatusCode.STATUS_CODE_UNSET:
        status_code = SpanStatusCode.UNSET
    else:
        raise ValueError(f"unknown status code: {otlp_status_code}")
    return status_code, otlp_status.message


def _extract_sub_key(key: str, prefix: str) -> Optional[str]:
    prefix_dot = f"{prefix}."
    if not (len(prefix_dot) < len(key) and key.startswith(prefix_dot)):
        return None
    return key[len(prefix_dot) :]


def _extract_index_and_sub_key(key: str, prefix: str) -> Optional[Tuple[int, str]]:
    prefix_dot = f"{prefix}."
    prefix_dot_len, key_len = len(prefix_dot), len(key)
    if not (prefix_dot_len < key_len and key.startswith(prefix_dot)):
        return None
    next_dot_idx = key.find(".", prefix_dot_len)
    if next_dot_idx < 1:
        return None
    if next_dot_idx == key_len - 1:
        return None
    idx_str = key[prefix_dot_len:next_dot_idx]
    if not idx_str.isdigit():
        return None
    return int(idx_str), key[next_dot_idx + 1 :]


def _consolidate_prefixed_keys_into_list(
    attributes: Mapping[str, Any],
    prefix: str,
    json_loads_sub_keys: Container[str] = (),
) -> Dict[str, Any]:
    """Copy the attributes. Consolidate keys with the given prefix into a single list (of dicts).
    Remove those keys, add the new list under a new key equal to the prefix."""
    _attributes = dict(attributes)
    relevant_keys = [
        (key, idx_and_sub_key, value)
        for key, value in attributes.items()
        if (idx_and_sub_key := _extract_index_and_sub_key(key, prefix)) is not None
    ]
    if not relevant_keys:
        return _attributes
    for key, *_ in relevant_keys:
        _attributes.pop(key)
    indexed: DefaultDict[int, Dict[str, Any]] = defaultdict(dict)
    for _, (idx, sub_key), value in relevant_keys:
        indexed[idx][sub_key] = json.loads(value) if sub_key in json_loads_sub_keys else value
    _attributes[prefix] = [obj for _, obj in sorted(indexed.items())]
    return _attributes


def _consolidate_prefixed_keys_into_dict(
    attributes: Mapping[str, Any],
    prefix: str,
    json_loads_sub_keys: Container[str] = (),
) -> Dict[str, Any]:
    """Copy the attributes. Consolidate keys with the given prefix into a single dictionary.
    Remove those keys, add the new dictionary under a new key equal to the prefix."""
    _attributes = dict(attributes)
    relevant_keys = [
        (key, sub_key, value)
        for key, value in _attributes.items()
        if (sub_key := _extract_sub_key(key, prefix)) is not None
    ]
    if not relevant_keys:
        return _attributes
    for key, *_ in relevant_keys:
        _attributes.pop(key)
    res: Dict[str, Any] = {}
    for _, sub_key, value in relevant_keys:
        res[sub_key] = json.loads(value) if sub_key in json_loads_sub_keys else value
    _attributes[prefix] = res
    return _attributes


NANO = 1_000_000_000  # for converting seconds to nanoseconds


def encode(span: Span) -> otlp.Span:
    trace_id: bytes = span.context.trace_id.bytes
    span_id: bytes = _span_id_to_bytes(span.context.span_id)
    parent_span_id: bytes = _span_id_to_bytes(span.parent_id) if span.parent_id else bytes()

    # floating point rounding error can cause the timestamp to be slightly different from expected
    start_time_unix_nano: int = int(span.start_time.timestamp() * NANO)
    end_time_unix_nano: int = int(span.end_time.timestamp() * NANO) if span.end_time else 0

    attributes: Dict[str, Any] = dict(span.attributes)

    for key, json_dumps_sub_keys in (
        (RETRIEVAL_DOCUMENTS, (DOCUMENT_METADATA,)),
        (EMBEDDING_EMBEDDINGS, ()),
        (LLM_INPUT_MESSAGES, ()),
        (LLM_OUTPUT_MESSAGES, ()),
    ):
        if value := attributes.pop(key, None):
            attributes.update(_flatten_sequence(value, key, (DOCUMENT_METADATA,)))

    for key, json_dumps_sub_keys in ((LLM_PROMPT_TEMPLATE_VARIABLES, ()),):
        if value := attributes.pop(key, None):
            attributes.update(_flatten_mapping(value, key, json_dumps_sub_keys))

    attributes[OPENINFERENCE_SPAN_KIND] = span.span_kind.value

    status = _encode_status(span.status_code, span.status_message)
    events = _encode_events(span.events)

    return otlp.Span(
        name=span.name,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        start_time_unix_nano=start_time_unix_nano,
        end_time_unix_nano=end_time_unix_nano,
        attributes=_encode_attributes(cast(Attributes, attributes)),
        events=events,
        status=status,
    )


def _encode_status(span_status_code: SpanStatusCode, status_message: str) -> otlp.Status:
    if span_status_code is SpanStatusCode.OK:
        code = otlp.Status.StatusCode.STATUS_CODE_OK
    elif span_status_code is SpanStatusCode.ERROR:
        code = otlp.Status.StatusCode.STATUS_CODE_ERROR
    elif span_status_code is SpanStatusCode.UNSET:
        code = otlp.Status.StatusCode.STATUS_CODE_UNSET
    else:
        assert_never(span_status_code)
    return otlp.Status(code=code, message=status_message)


def _span_id_to_bytes(span_id: SpanID) -> bytes:
    return Random(span_id.bytes).getrandbits(64).to_bytes(8, byteorder="big")


def _flatten_mapping(
    mapping: Mapping[str, Any],
    prefix: str,
    json_dumps_sub_keys: Container[str] = (),
) -> Iterator[Tuple[str, Any]]:
    for key, value in mapping.items():
        yield f"{prefix}.{key}", _encode_value(value, key in json_dumps_sub_keys)


def _flatten_sequence(
    sequence: Iterable[Mapping[str, Any]],
    prefix: str,
    json_dumps_sub_keys: Container[str] = (),
) -> Iterator[Tuple[str, Any]]:
    for idx, obj in enumerate(sequence):
        if not isinstance(obj, Mapping):
            continue
        for key, value in obj.items():
            yield (
                f"{prefix}.{idx}.{key}",
                json.dumps(value) if key in json_dumps_sub_keys else value,
            )


def _encode_event(event: SpanEvent) -> otlp.Span.Event:
    return otlp.Span.Event(
        name=event.name,
        time_unix_nano=int(event.timestamp.timestamp() * NANO),
        attributes=_encode_attributes(cast(Attributes, event.attributes)),
    )


def _encode_events(events: Iterable[SpanEvent]) -> Iterator[otlp.Span.Event]:
    return (_encode_event(event) for event in events)


def _encode_attributes(
    attributes: Attributes, json_dumps_sub_keys: Container[str] = ()
) -> Iterator[KeyValue]:
    if not attributes:
        return
    for key, value in attributes.items():
        yield KeyValue(key=key, value=_encode_value(value, key in json_dumps_sub_keys))


def _encode_value(value: AttributeValue, json_dumpss: bool = False) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    if isinstance(value, bool):
        return AnyValue(bool_value=value)
    if isinstance(value, int):
        return AnyValue(int_value=value)
    if isinstance(value, float):
        return AnyValue(double_value=value)
    if isinstance(value, Sequence):
        return AnyValue(array_value=ArrayValue(values=(_encode_value(v) for v in value)))
    if isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    elif isinstance(value, Mapping):
        if json_dumpss:
            return AnyValue(string_value=json.dumps(value))
        return AnyValue(kvlist_value=KeyValueList(values=_encode_attributes(value)))
    assert_never(value)
