import inspect
import json
from binascii import hexlify, unhexlify
from datetime import datetime, timezone
from types import MappingProxyType
from typing import (
    Any,
    DefaultDict,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Set,
    SupportsFloat,
    Tuple,
    Union,
    cast,
)

import numpy as np
import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from openinference.semconv import trace
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, ArrayValue, KeyValue
from opentelemetry.util.types import Attributes, AttributeValue
from typing_extensions import TypeAlias, assert_never

from phoenix.trace.schemas import (
    EXCEPTION_ESCAPED,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
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

DOCUMENT_METADATA = DocumentAttributes.DOCUMENT_METADATA
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
METADATA = SpanAttributes.METADATA
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
TOOL_PARAMETERS = SpanAttributes.TOOL_PARAMETERS
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES


def decode_otlp_span(otlp_span: otlp.Span) -> Span:
    trace_id = cast(TraceID, _decode_identifier(otlp_span.trace_id))
    span_id = cast(SpanID, _decode_identifier(otlp_span.span_id))
    parent_id = _decode_identifier(otlp_span.parent_span_id)

    start_time = _decode_unix_nano(otlp_span.start_time_unix_nano)
    end_time = (
        _decode_unix_nano(otlp_span.end_time_unix_nano) if otlp_span.end_time_unix_nano else None
    )

    attributes = dict(_unflatten(_load_json_strings(_decode_key_values(otlp_span.attributes))))
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


def _decode_identifier(identifier: bytes) -> Optional[str]:
    if not identifier:
        return None
    # Hex encoding is used for trace and span identifiers in OTLP.
    # See e.g. https://github.com/open-telemetry/opentelemetry-go/blob/ce3faf1488b72921921f9589048835dddfe97f33/trace/trace.go#L33  # noqa: E501
    return hexlify(identifier).decode()


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


_JSON_STRING_ATTRIBUTES = (
    DOCUMENT_METADATA,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    METADATA,
    TOOL_PARAMETERS,
)


def _load_json_strings(key_values: Iterable[Tuple[str, Any]]) -> Iterator[Tuple[str, Any]]:
    for key, value in key_values:
        if key.endswith(_JSON_STRING_ATTRIBUTES):
            try:
                dict_value = json.loads(value)
            except Exception:
                yield key, value
            else:
                if dict_value:
                    yield key, dict_value
        else:
            yield key, value


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
    (
        getattr(klass, attr)
        for name in dir(trace)
        if name.endswith("Attributes") and inspect.isclass(klass := getattr(trace, name))
        for attr in dir(klass)
        if attr.isupper()
    ),
    reverse=True,
)  # sorted so the longer strings go first


def _semantic_convention_prefix_partition(key: str, separator: str = ".") -> Tuple[str, str, str]:
    """Return the longest prefix of `key` that is a semantic convention, and the remaining suffix
    separated by `.`. For example, if `key` is "retrieval.documents.2.document.score", return
    ("retrieval.documents", ".", "2.document.score"). The return signature is based on Python's
    `.partition` method for strings.
    """
    for prefix in _SEMANTIC_CONVENTIONS:
        if key == prefix:
            return key, "", ""
        if key.startswith(prefix) and key[len(prefix) :].startswith(separator):
            return prefix, separator, key[len(prefix) + len(separator) :]
    return "", "", ""


class _Trie(DefaultDict[Union[str, int], "_Trie"]):
    """Prefix Tree with special handling for indices (i.e. all-digit keys)."""

    def __init__(self) -> None:
        super().__init__(_Trie)
        self.value: Any = None
        self.indices: Set[int] = set()
        self.branches: Set[Union[str, int]] = set()

    def set_value(self, value: Any) -> None:
        self.value = value
        # value and indices must not coexist
        self.branches.update(self.indices)
        self.indices.clear()

    def add_index(self, index: int) -> "_Trie":
        if self.value is not None:
            self.branches.add(index)
        elif index not in self.branches:
            self.indices.add(index)
        return self[index]

    def add_branch(self, branch: Union[str, int]) -> "_Trie":
        if branch in self.indices:
            self.indices.discard(cast(int, branch))
        self.branches.add(branch)
        return self[branch]


# FIXME: Ideally we should not need something so complicated as a Trie, but it's useful here
# for backward compatibility reasons regarding some deeply nested objects such as TOOL_PARAMETERS.
# In the future, we should `json_dumps` them and not let things get too deeply nested.
def _build_trie(
    key_value_pairs: Iterable[Tuple[str, Any]],
    separator: str = ".",
) -> _Trie:
    """Build a Trie (a.k.a. prefix tree) from `key_value_pairs`, by partitioning the keys by
    separator. Each partition is a branch in the Trie. Special handling is done for partitions
    that are all digits, e.g. "0", "12", etc., which are converted to integers and collected
    as indices.
    """
    trie = _Trie()
    for key, value in key_value_pairs:
        if value is None:
            continue
        t = trie
        while True:
            prefix, _, suffix = _semantic_convention_prefix_partition(key, separator)
            if prefix:
                t = t.add_branch(prefix)
            else:
                prefix, _, suffix = key.partition(separator)
                if prefix.isdigit():
                    index = int(prefix)
                    t = t.add_index(index) if suffix else t.add_branch(index)
                else:
                    t = t.add_branch(prefix)
            if not suffix:
                break
            key = suffix
        t.set_value(value)
    return trie


def _walk(trie: _Trie, prefix: str = "") -> Iterator[Tuple[str, Any]]:
    if trie.value is not None:
        yield prefix, trie.value
    elif prefix and trie.indices:
        yield prefix, [dict(_walk(trie[index])) for index in sorted(trie.indices)]
    elif trie.indices:
        for index in trie.indices:
            yield from _walk(trie[index], prefix=f"{index}")
    elif prefix:
        yield prefix, dict(_walk(trie))
        return
    for branch in trie.branches:
        new_prefix = f"{prefix}.{branch}" if prefix else f"{branch}"
        yield from _walk(trie[branch], new_prefix)


def _unflatten(
    key_value_pairs: Iterable[Tuple[str, Any]],
    separator: str = ".",
) -> Iterator[Tuple[str, Any]]:
    trie = _build_trie(key_value_pairs, separator)
    yield from _walk(trie)


_BILLION = 1_000_000_000  # for converting seconds to nanoseconds


def encode_span_to_otlp(span: Span) -> otlp.Span:
    trace_id: bytes = _encode_identifier(span.context.trace_id)
    span_id: bytes = _encode_identifier(span.context.span_id)
    parent_span_id: bytes = _encode_identifier(span.parent_id)

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
            if key.endswith(_JSON_STRING_ATTRIBUTES):
                attributes[key] = json.dumps(value)
            else:
                attributes.update(_flatten_mapping(value, key))
        elif (
            not isinstance(value, str)
            and (isinstance(value, Sequence) or isinstance(value, np.ndarray))
            and _has_mapping(value)
        ):
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


def _encode_identifier(identifier: Optional[str]) -> bytes:
    if not identifier:
        return bytes()
    # For legacy JSONL files containing UUID strings we
    # need to remove the hyphen.
    identifier = identifier.replace("-", "")
    return unhexlify(identifier)


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
            if key.endswith(_JSON_STRING_ATTRIBUTES):
                yield prefixed_key, json.dumps(value)
            else:
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
        if isinstance(value, np.ndarray):
            value = value.tolist()
        yield KeyValue(key=key, value=_encode_value(value))


def _encode_value(value: AttributeValue) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    if isinstance(value, bool):
        return AnyValue(bool_value=value)
    if isinstance(value, int):
        return AnyValue(int_value=value)
    if isinstance(value, SupportsFloat):
        return AnyValue(double_value=float(value))
    if isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    if isinstance(value, Sequence):
        return AnyValue(array_value=ArrayValue(values=map(_encode_value, value)))
    raise ValueError(f"Unexpected attribute value {value} with type {type(value)}.")


__all__ = [
    "encode_span_to_otlp",
    "decode_otlp_span",
]
