import json
from collections import defaultdict
from datetime import datetime, timezone
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
    Set,
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
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    OPENINFERENCE_SPAN_KIND,
    RETRIEVAL_DOCUMENTS,
)


def _trie() -> DefaultDict[Hashable, Any]:
    # a.k.a. prefix tree
    return defaultdict(_trie)


_LEAF = 0  # sentinel value for trie leaf nodes


def _build_trie(sentences: Iterable[str], sep: str = ".") -> DefaultDict[Hashable, Any]:
    trie = _trie()
    for sentence in sentences:
        t = trie
        for word in sentence.split(sep):
            t = t[word]
        t[_LEAF] = sentence
    return trie


_SEMANTIC_CONVENTION_TRIE: DefaultDict[Hashable, Any] = _build_trie(
    getattr(sem_conv, name) for name in dir(sem_conv) if name.isupper()
)


def _semantic_convention_prefix_search(key: str) -> Tuple[Optional[str], Optional[List[str]]]:
    """Return the longest prefix of `key` that is a semantic convention, and the remaining suffix
    as a list of words. For example, if `key` is "retrieval.documents.2.document.score", return
    "retrieval.documents", ["2", "document", "score"].
    """
    trie = _SEMANTIC_CONVENTION_TRIE
    words = key.split(".")
    for i, word in enumerate(words):
        if word not in trie:
            return None, None
        trie = trie[word]
        if _LEAF in trie:
            return trie[_LEAF], words[i + 1 :]
    return None, None


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

    attributes_for_list_of_dictionaries: Set[str] = set()
    attributes_for_dictionary: Set[str] = set()

    for key in attributes.keys():
        prefix, suffix_words = _semantic_convention_prefix_search(key)
        if prefix and suffix_words:
            if suffix_words[0].isdigit():
                # e.g. "retrieval.documents.2.document.score"
                # -> "retrieval.documents", ["2", "document", "score"]
                attributes_for_list_of_dictionaries.add(prefix)
            else:
                attributes_for_dictionary.add(prefix)

    for prefix in attributes_for_list_of_dictionaries:
        # Attributes that are supposed to be list of dictionaries must be flattened before OTLP
        # transmission. This reverses that flattening and reconstitutes them as list of
        # dictionaries. The flattened keys look like "{prefix}.{index}.{sub_key}", where `sub_key`
        # is a key in a dictionary item of the original list, and `index` is the position of the
        # dictionary item in the original list. So `"{prefix}.0.{sub_key}": 123` becomes
        # `"{prefix}": [{"{sub_key}": 123}]`.
        (
            consolidated_list,
            flattened_prefixed_indexed_keys,
        ) = _consolidate_flattened_prefixed_indexed_keys_into_list(attributes, prefix)
        if not flattened_prefixed_indexed_keys:
            continue
        for key in flattened_prefixed_indexed_keys:
            attributes.pop(key, None)
        if consolidated_list:
            attributes[prefix] = consolidated_list

    for document in attributes.get(RETRIEVAL_DOCUMENTS) or ():
        if isinstance(metadata := document.get(DOCUMENT_METADATA), str):
            try:
                document[DOCUMENT_METADATA] = json.loads(metadata)
            except json.JSONDecodeError:
                pass

    for prefix in attributes_for_dictionary:
        # Attributes that are supposed to be dictionaries must be flattened before OTLP
        # transmission. This reverses that flattening and reconstitutes them as dictionaries.
        # The flattened keys look like "{prefix}.{sub_key}", where `sub_key` is a key in the
        # original dictionary. So `"{prefix}.{sub_key}": 123` becomes
        # `"{prefix}": {"{sub_key}": 123}`.
        (
            consolidated_dict,
            flattened_prefixed_keys,
        ) = _consolidate_flattened_prefixed_keys_into_dict(attributes, prefix)
        if not flattened_prefixed_keys:
            continue
        for key in flattened_prefixed_keys:
            attributes.pop(key, None)
        if consolidated_dict:
            attributes[prefix] = consolidated_dict

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


def _extract_sub_key(key: str, prefix: str) -> Optional[str]:
    prefix_dot = f"{prefix}."
    if not (len(prefix_dot) < len(key) and key.startswith(prefix_dot)):
        return None
    return key[len(prefix_dot) :]


def _extract_index_and_sub_key(key: str, prefix: str) -> Optional[Tuple[int, str]]:
    indexed_sub_key = _extract_sub_key(key, prefix)
    if not indexed_sub_key:
        return None
    dot_idx = indexed_sub_key.find(".")
    if not (0 < dot_idx < len(indexed_sub_key) - 1):
        return None
    index_prefix = indexed_sub_key[:dot_idx]
    if not index_prefix.isdigit():
        return None
    index = int(index_prefix)
    sub_key = indexed_sub_key[dot_idx + 1 :]
    return index, sub_key


def _consolidate_flattened_prefixed_indexed_keys_into_list(
    attributes: Mapping[str, Any],
    prefix: str,
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[List[str]]]:
    """Consolidate keys with the given prefix into a single list (of dictionaries).
    Return the consolidated list and the list of keys that were consolidated."""
    # Note that the reconstitution is not faithful in the sense that if an index shows up as
    # 999_999_999, we're not going to create a list that long just so that the item can be placed
    # at that exact position. All we'll do is sort the indices and place the items sequentially.
    relevant_keys = [
        (key, idx_and_sub_key, value)
        for key, value in attributes.items()
        if (idx_and_sub_key := _extract_index_and_sub_key(key, prefix)) is not None
    ]
    if not relevant_keys:
        return None, None
    indexed: DefaultDict[int, Dict[str, Any]] = defaultdict(dict)
    for _, (idx, sub_key), value in relevant_keys:
        indexed[idx][sub_key] = value
    return [dictionary for _, dictionary in sorted(indexed.items())], [
        key for key, *_ in relevant_keys
    ]


def _consolidate_flattened_prefixed_keys_into_dict(
    attributes: Mapping[str, Any],
    prefix: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[List[str]]]:
    """Consolidate keys with the given prefix into a single dictionary.
    Return the consolidated dictionary and the list of keys that were consolidated."""
    relevant_keys = [
        (key, sub_key, value)
        for key, value in attributes.items()
        if (sub_key := _extract_sub_key(key, prefix)) is not None
    ]
    if not relevant_keys:
        return None, None
    return {sub_key: value for _, sub_key, value in relevant_keys}, [
        key for key, *_ in relevant_keys
    ]


_BILLION = 1_000_000_000  # for converting seconds to nanoseconds


def encode(span: Span) -> otlp.Span:
    trace_id: bytes = span.context.trace_id.bytes
    span_id: bytes = _span_id_to_bytes(span.context.span_id)
    parent_span_id: bytes = _span_id_to_bytes(span.parent_id) if span.parent_id else bytes()

    # floating point rounding error can cause the timestamp to be slightly different from expected
    start_time_unix_nano: int = int(span.start_time.timestamp() * _BILLION)
    end_time_unix_nano: int = int(span.end_time.timestamp() * _BILLION) if span.end_time else 0

    attributes: Dict[str, Any] = dict(span.attributes)

    for key, value in span.attributes.items():
        if isinstance(value, Sequence):
            if flattened := dict(_flatten_sequence(value, key)):
                attributes.pop(key, None)
                attributes.update(flattened)
        if isinstance(value, Mapping):
            attributes.pop(key, None)
            attributes.update(_flatten_mapping(value, key))

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


def _flatten_mapping(
    mapping: Mapping[str, Any],
    prefix: str,
) -> Iterator[Tuple[str, Any]]:
    for key, value in mapping.items():
        prefixed_key = f"{prefix}.{key}"
        if isinstance(value, Mapping):
            yield prefixed_key, json.dumps(value)
        else:
            yield prefixed_key, value


def _flatten_sequence(
    sequence: Iterable[Any],
    prefix: str,
) -> Iterator[Tuple[str, Any]]:
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
