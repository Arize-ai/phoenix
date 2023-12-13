import json
from datetime import datetime, timezone
from typing import Any, Container, Iterable, Iterator, Mapping, Sequence, Tuple

from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList
from opentelemetry.util.types import Attributes, AttributeValue
from typing_extensions import assert_never


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
