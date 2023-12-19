from collections import defaultdict
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import (
    Any,
    DefaultDict,
    Dict,
    Hashable,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    cast,
)
from uuid import UUID

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue
from opentelemetry.util.types import Attributes, AttributeValue
from typing_extensions import TypeAlias, assert_never

import phoenix.trace.semantic_conventions as sem_conv
from phoenix.trace.schemas import (
    MimeType,
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
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_MIME_TYPE,
    OPENINFERENCE_SPAN_KIND,
    OUTPUT_MIME_TYPE,
)


def decode(otlp_span: otlp.Span) -> Span:
    trace_id = cast(TraceID, _decode_identifier(otlp_span.trace_id))
    span_id = cast(SpanID, _decode_identifier(otlp_span.span_id))
    parent_id = _decode_identifier(otlp_span.parent_span_id)

    start_time = _decode_unix_nano(otlp_span.start_time_unix_nano)
    end_time = (
        _decode_unix_nano(otlp_span.end_time_unix_nano) if otlp_span.end_time_unix_nano else None
    )

    attributes = dict(_unflatten(_decode_key_values(otlp_span.attributes)))
    span_kind = SpanKind(attributes.pop(OPENINFERENCE_SPAN_KIND, None))

    for mime_type in (INPUT_MIME_TYPE, OUTPUT_MIME_TYPE):
        if mime_type in attributes:
            attributes[mime_type] = MimeType(attributes[mime_type])

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
) -> Iterator[Tuple[str, Any]]:
    return ((kv.key, _decode_value(kv.value)) for kv in key_values)


def _decode_value(any_value: AnyValue) -> Any:
    which = any_value.WhichOneof("value")
    if which == "string_value":
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

_STATUS_DECODING = MappingProxyType(
    {
        otlp.Status.StatusCode.STATUS_CODE_UNSET: SpanStatusCode.UNSET,
        otlp.Status.StatusCode.STATUS_CODE_OK: SpanStatusCode.OK,
        otlp.Status.StatusCode.STATUS_CODE_ERROR: SpanStatusCode.ERROR,
    }
)


def _decode_status(otlp_status: otlp.Status) -> Tuple[SpanStatusCode, StatusMessage]:
    status_code = _STATUS_DECODING.get(otlp_status.code, SpanStatusCode.UNSET)
    return status_code, otlp_status.message


_SEMANTIC_CONVENTIONS: List[str] = sorted(
    (getattr(sem_conv, name) for name in dir(sem_conv) if name.isupper()),
    reverse=True,
)  # sorted so the longer strings go first


def _semantic_convention_prefix_search(key: str) -> Tuple[Optional[str], str]:
    """Return the longest prefix of `key` that is a semantic convention, and the remaining suffix
    separated by `.`. For example, if `key` is "retrieval.documents.2.document.score", return
    "retrieval.documents", "2.document.score".
    """
    for prefix in _SEMANTIC_CONVENTIONS:
        if key == prefix:
            return key, ""
        if key.startswith(prefix) and key[len(prefix)] == ".":
            return prefix, key[len(prefix) + 1 :]
    return None, ""


class _TrieLeaf(Enum):
    """Sentinel keys for marking a leaf node of a Trie"""

    value = object()
    indices = object()


def _build_trie(key_value_pairs: Iterable[Tuple[str, Any]]) -> DefaultDict[Hashable, Any]:
    def _trie() -> DefaultDict[Hashable, Any]:
        # a.k.a. prefix tree
        return defaultdict(_trie)

    trie = _trie()
    for key, value in key_value_pairs:
        t = trie
        while True:
            prefix, suffix = _semantic_convention_prefix_search(key)
            if prefix:
                t = t[prefix]
                key = suffix
            else:
                dot_idx = key.find(".")
                if dot_idx >= 0:
                    word, key = key[:dot_idx], key[dot_idx + 1 :]
                else:
                    word, key = key, ""
                if word.isdigit():
                    index = int(word)
                    indices = t.get(_TrieLeaf.indices)
                    if key:
                        if indices is not None:
                            indices.add(index)
                        else:
                            t[_TrieLeaf.indices] = {index}
                    elif indices is not None:
                        indices.discard(index)
                    t = t[index]
                else:
                    t = t[word]
            if not key:
                break
        t[_TrieLeaf.value] = value
    trie.pop(_TrieLeaf.indices, None)
    return trie


def _walk(trie: DefaultDict[Hashable, Any], prefix: str = "") -> Iterator[Tuple[str, Any]]:
    if _TrieLeaf.value not in trie and _TrieLeaf.indices not in trie:
        if prefix:
            yield prefix, dict(_walk(trie))
        else:
            for key, node in trie.items():
                yield from _walk(node, prefix=f"{key}")
        return
    if _TrieLeaf.value in trie:
        value = trie.pop(_TrieLeaf.value, None)
        yield prefix, value
        # Indices no longer indicate an array, but must be continuations of the prefix
        # key string. Discard the `indices` leaf marker, but not the index keys themselves.
        trie.pop(_TrieLeaf.indices, None)
    elif (indices := cast(Iterable[int], trie.pop(_TrieLeaf.indices, None))) and prefix:
        yield prefix, [dict(_walk(trie.pop(index))) for index in sorted(indices)]
    for key, node in trie.items():
        yield from _walk(node, prefix=f"{prefix}.{key}" if prefix else f"{key}")


def _unflatten(key_value_pairs: Iterable[Tuple[str, Any]]) -> Iterator[Tuple[str, Any]]:
    trie = _build_trie(key_value_pairs)
    yield from _walk(trie)


_BILLION = 1_000_000_000  # for converting seconds to nanoseconds


def encode(span: Span) -> otlp.Span:
    trace_id: bytes = span.context.trace_id.bytes
    span_id: bytes = _span_id_to_bytes(span.context.span_id)
    parent_span_id: bytes = _span_id_to_bytes(span.parent_id) if span.parent_id else bytes()

    # floating point rounding error can cause the timestamp to be slightly different from expected
    start_time_unix_nano: int = int(span.start_time.timestamp() * _BILLION)
    end_time_unix_nano: int = int(span.end_time.timestamp() * _BILLION) if span.end_time else 0

    attributes: Dict[str, Any] = span.attributes.copy()

    for mime_type in (INPUT_MIME_TYPE, OUTPUT_MIME_TYPE):
        if mime_type in attributes:
            attributes[mime_type] = attributes[mime_type].value

    for key, value in span.attributes.items():
        if value is None:
            # None can't be transmitted by OTLP
            attributes.pop(key, None)
        elif isinstance(value, Mapping):
            attributes.pop(key, None)
            attributes.update(_flatten_mapping(value, key))
        elif not isinstance(value, str) and isinstance(value, Sequence) and _has_mapping(value):
            attributes.pop(key, None)
            attributes.update(_flatten_sequence(value, key))

    attributes[OPENINFERENCE_SPAN_KIND] = span.span_kind.value

    status = _encode_status(span.status_code, span.status_message)
    events = map(_encode_event, span.events)

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


_STATUS_ENCODING = MappingProxyType(
    {
        SpanStatusCode.UNSET: otlp.Status.StatusCode.STATUS_CODE_UNSET,
        SpanStatusCode.OK: otlp.Status.StatusCode.STATUS_CODE_OK,
        SpanStatusCode.ERROR: otlp.Status.StatusCode.STATUS_CODE_ERROR,
    }
)


def _encode_status(span_status_code: SpanStatusCode, status_message: str) -> otlp.Status:
    code = _STATUS_ENCODING.get(span_status_code, otlp.Status.StatusCode.STATUS_CODE_UNSET)
    return otlp.Status(code=code, message=status_message)


def _span_id_to_bytes(span_id: SpanID) -> bytes:
    # Note that this is not compliant with the OTEL spec, which uses 8-byte span IDs.
    # This is a stopgap solution for backward compatibility until we move away from UUIDs.
    return span_id.bytes


def _has_mapping(sequence: Sequence[Any]) -> bool:
    for item in sequence:
        if isinstance(item, Mapping):
            return True
    return False


def _flatten_mapping(
    mapping: Mapping[str, Any],
    prefix: str,
) -> Iterator[Tuple[str, Any]]:
    for key, value in mapping.items():
        prefixed_key = f"{prefix}.{key}"
        if isinstance(value, Mapping):
            yield from _flatten_mapping(value, prefixed_key)
        elif isinstance(value, Sequence):
            yield from _flatten_sequence(value, prefixed_key)
        elif value is not None:
            yield prefixed_key, value


def _flatten_sequence(
    sequence: Sequence[Any],
    prefix: str,
) -> Iterator[Tuple[str, Any]]:
    if isinstance(sequence, str) or not _has_mapping(sequence):
        yield prefix, sequence
    for idx, obj in enumerate(sequence):
        if not isinstance(obj, Mapping):
            continue
        yield from _flatten_mapping(obj, f"{prefix}.{idx}")


def _encode_event(event: SpanEvent) -> otlp.Span.Event:
    return otlp.Span.Event(
        name=event.name,
        time_unix_nano=int(event.timestamp.timestamp() * _BILLION),
        attributes=_encode_attributes(cast(Attributes, event.attributes)),
    )


def _encode_attributes(attributes: Attributes) -> Iterator[KeyValue]:
    if not attributes:
        return
    for key, value in attributes.items():
        yield KeyValue(key=key, value=_encode_value(value))


def _encode_value(value: AttributeValue) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    if isinstance(value, bool):
        return AnyValue(bool_value=value)
    if isinstance(value, int):
        return AnyValue(int_value=value)
    if isinstance(value, float):
        return AnyValue(double_value=value)
    if isinstance(value, Sequence):
        return AnyValue(array_value=ArrayValue(values=map(_encode_value, value)))
    if isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    assert_never(value)


__all__ = [
    "encode",
    "decode",
]
