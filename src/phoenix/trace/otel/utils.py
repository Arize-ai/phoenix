import json
from datetime import datetime, timezone
from typing import Any, Container, Iterable, Iterator, Mapping, Sequence, Tuple

from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList
from opentelemetry.util.types import Attributes, AttributeValue
from typing_extensions import assert_never

from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
)


def decode_document(key_values: Iterable[KeyValue]) -> Iterator[Tuple[str, Any]]:
    for kv in key_values:
        key, value = kv.key, kv.value
        if key == DOCUMENT_ID:
            if value.HasField("string_value"):
                yield DOCUMENT_ID, value.string_value
        elif key == DOCUMENT_CONTENT:
            if value.HasField("string_value"):
                yield DOCUMENT_CONTENT, value.string_value
        elif key == DOCUMENT_SCORE:
            which = value.WhichOneof("value")
            if which == "double_value":
                yield DOCUMENT_SCORE, value.double_value
            elif which == "int_value":
                yield DOCUMENT_SCORE, value.int_value
        elif key == DOCUMENT_METADATA:
            if value.HasField("kvlist_value") and (values := value.kvlist_value.values):
                yield DOCUMENT_METADATA, dict(decode_key_values(values))


def decode_embedding(key_values: Iterable[KeyValue]) -> Iterator[Tuple[str, Any]]:
    for kv in key_values:
        key, value = kv.key, kv.value
        if key == EMBEDDING_TEXT:
            if value.WhichOneof("value") == "string_value":
                yield EMBEDDING_TEXT, value.string_value
        elif key == EMBEDDING_VECTOR:
            if (
                value.WhichOneof("value") == "array_value"
                and len(values := value.array_value.values)
                and values[0].WhichOneof("value") == "double_value"
            ):
                yield EMBEDDING_VECTOR, list(v.double_value for v in values)


def decode_unix_nano(time_unix_nano: int) -> datetime:
    # floating point rounding error can cause the timestamp to be slightly different from expected
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


def decode_key_values(
    key_values: Iterable[KeyValue],
    json_load_keys: Container[str] = (),
) -> Iterator[Tuple[str, Any]]:
    return ((kv.key, decode_value(kv.value, kv.key in json_load_keys)) for kv in key_values)


def decode_value(any_value: AnyValue, json_loads: bool = False) -> Any:
    which = any_value.WhichOneof("value")
    if which == "string_value":
        if json_loads:
            return json.loads(any_value.string_value)
        return any_value.string_value
    if which == "bool_value":
        return any_value.bool_value
    if which == "int_value":
        return any_value.int_value
    if which == "double_value":
        return any_value.double_value
    if which == "array_value":
        return [decode_value(value) for value in any_value.array_value.values]
    if which == "kvlist_value":
        return dict(decode_key_values(any_value.kvlist_value.values))
    if which == "bytes_value":
        return any_value.bytes_value
    if which is None:
        return None
    assert_never(which)


def encode_attributes(
    attributes: Attributes, json_dump_keys: Container[str] = ()
) -> Iterator[KeyValue]:
    if not attributes:
        return
    for key, value in attributes.items():
        yield KeyValue(key=key, value=encode_value(value, key in json_dump_keys))


def encode_value(value: AttributeValue, json_dumps: bool = False) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    if isinstance(value, bool):
        return AnyValue(bool_value=value)
    if isinstance(value, int):
        return AnyValue(int_value=value)
    if isinstance(value, float):
        return AnyValue(double_value=value)
    if isinstance(value, Sequence):
        return AnyValue(array_value=ArrayValue(values=(encode_value(v) for v in value)))
    if isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    elif isinstance(value, Mapping):
        if json_dumps:
            return AnyValue(string_value=json.dumps(value))
        return AnyValue(kvlist_value=KeyValueList(values=encode_attributes(value)))
    assert_never(value)
