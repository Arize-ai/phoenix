from dataclasses import dataclass
from dataclasses import field as dataclass_field
from datetime import datetime, timezone
from typing import Any, Optional, Union

from typing_extensions import NotRequired, TypedDict


class SpanStatus(TypedDict):
    code: NotRequired[str]  # "UNSET", "OK", "ERROR"
    message: NotRequired[str]


class SpanEvent(TypedDict):
    name: NotRequired[str]
    timestamp: NotRequired[datetime]
    attributes: NotRequired[dict[str, Any]]


class Span(TypedDict):
    """
    Ergonomic span representation that's easier to work with than OTLP types.

    This excludes unused OTLP fields and stores attributes as a simple dictionary
    instead of the complex OTLP KeyValue/AnyValue structure.
    """

    trace_id: NotRequired[str]
    span_id: NotRequired[str]
    parent_span_id: NotRequired[str]
    name: NotRequired[str]
    start_time: NotRequired[datetime]
    end_time: NotRequired[datetime]
    attributes: NotRequired[dict[str, Any]]  # Flattened attributes as key-value pairs
    events: NotRequired[list[SpanEvent]]
    status: NotRequired[SpanStatus]


_BACKWARD_COMPATIBILITY_REPLACEMENTS: dict[str, str] = {
    "context.span_id": "span_id",
    "context.trace_id": "trace_id",
    "cumulative_token_count.completion": "cumulative_llm_token_count_completion",
    "cumulative_token_count.prompt": "cumulative_llm_token_count_prompt",
    "cumulative_token_count.total": "cumulative_llm_token_count_total",
}

_ALIASES: dict[str, str] = {
    "span_id": "context.span_id",
    "trace_id": "context.trace_id",
}


def _unalias(key: str) -> str:
    """Convert old field names to their new form."""
    return _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(key, key)


def _replace_backward_compatibility(key: str) -> str:
    """Replace backward compatibility field names with their current form."""
    return _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(key, key)


def _normalize_field(key: str) -> str:
    # If the user has provided the fully qualified version, strip off "context."
    if key.startswith("context."):
        return key[len("context.") :]
    # If the shorthand is given, return the fully qualified field.
    if key in _ALIASES:
        return _ALIASES[key]
    # Check if the key is a legacy name that should be replaced.
    if key in _BACKWARD_COMPATIBILITY_REPLACEMENTS:
        return _BACKWARD_COMPATIBILITY_REPLACEMENTS[key]
    # Otherwise, return the key as is.
    return key


@dataclass
class Projection:
    """Represents a projection in a span query."""

    key: str = dataclass_field(default="")

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("Projection key cannot be empty")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {"key": self.key}


@dataclass
class SpanFilter:
    """Represents a filter condition in a span query."""

    condition: str = dataclass_field(default="")
    valid_eval_names: Optional[list[str]] = dataclass_field(default=None)

    def __post_init__(self) -> None:
        if not self.condition:
            raise ValueError("Filter condition cannot be empty")
        for old, new in _BACKWARD_COMPATIBILITY_REPLACEMENTS.items():
            self.condition = self.condition.replace(old, new)

    def to_dict(self) -> dict[str, Any]:
        return {"condition": self.condition}


@dataclass
class Explosion:
    """Represents an explosion operation in a span query."""

    key: str = dataclass_field(default="")
    kwargs: dict[str, str] = dataclass_field(default_factory=dict)
    primary_index_key: str = dataclass_field(default="context.span_id")

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("Explosion key cannot be empty")
        self.key = _replace_backward_compatibility(_unalias(self.key))
        if not self.primary_index_key:
            raise ValueError("Primary index key cannot be empty")
        self.kwargs = {
            k: _replace_backward_compatibility(_unalias(v)) for k, v in self.kwargs.items()
        }

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "key": self.key,
            "primary_index_key": self.primary_index_key,
        }
        if self.kwargs:
            result["kwargs"] = dict(self.kwargs)
        return result


@dataclass
class Concatenation:
    """Represents a concatenation operation in a span query."""

    key: str = dataclass_field(default="")
    kwargs: dict[str, str] = dataclass_field(default_factory=dict)
    separator: str = dataclass_field(default="\n\n")

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("Concatenation key cannot be empty")
        self.key = _replace_backward_compatibility(_unalias(self.key))
        self.kwargs = {
            k: _replace_backward_compatibility(_unalias(v)) for k, v in self.kwargs.items()
        }

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "key": self.key,
            "separator": self.separator,
        }
        if self.kwargs:
            result["kwargs"] = dict(self.kwargs)
        return result


@dataclass
class SpanQuery:
    """Represents a query for spans using the query DSL."""

    _select: Optional[dict[str, Projection]] = dataclass_field(default=None)
    _filter: Optional[SpanFilter] = dataclass_field(default=None)
    _explode: Optional[Explosion] = dataclass_field(default=None)
    _concat: Optional[Concatenation] = dataclass_field(default=None)
    _rename: Optional[dict[str, str]] = dataclass_field(default=None)
    _index: Optional[Projection] = dataclass_field(default=None)
    _index_has_been_set: bool = dataclass_field(default=False)

    def select(self, *fields: str) -> "SpanQuery":
        select_dict: dict[str, Projection] = {}
        for field in fields:
            normalized = _normalize_field(field)
            select_dict[normalized] = Projection(key=normalized)
        return SpanQuery(
            _select=select_dict,
            _filter=self._filter,
            _explode=self._explode,
            _concat=self._concat,
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def where(self, condition: str) -> "SpanQuery":
        """Filter spans based on a condition."""
        return SpanQuery(
            _select=self._select,
            _filter=SpanFilter(condition=condition),
            _explode=self._explode,
            _concat=self._concat,
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def explode(self, key: str, **kwargs: str) -> "SpanQuery":
        current_index = self._index.key if self._index else "context.span_id"
        primary_index_key = current_index
        # Create a new dictionary with normalized keys and values
        normalized_kwargs: dict[str, str] = {}
        for k, v in kwargs.items():
            normalized_k = _normalize_field(k)
            normalized_v = _normalize_field(v)
            normalized_kwargs[normalized_k] = normalized_v
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=Explosion(
                key=key, kwargs=normalized_kwargs, primary_index_key=primary_index_key
            ),
            _concat=self._concat,
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        """Concatenate a field from the spans."""
        # Create a new dictionary with normalized keys and values
        normalized_kwargs: dict[str, str] = {}
        for k, v in kwargs.items():
            normalized_k = _normalize_field(k)
            normalized_v = _normalize_field(v)
            normalized_kwargs[normalized_k] = normalized_v
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=self._explode,
            _concat=Concatenation(key=key, kwargs=normalized_kwargs),
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def rename(self, **kwargs: str) -> "SpanQuery":
        """Rename fields in the result."""
        rename_dict: dict[str, str] = {}
        for old_name, new_name in kwargs.items():
            normalized_old = _normalize_field(old_name)
            rename_dict[normalized_old] = new_name
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=self._explode,
            _concat=self._concat,
            _rename=rename_dict,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def with_index(self, key: str) -> "SpanQuery":
        # If there's already an explosion, update its primary index key
        new_explode = self._explode
        if new_explode is not None:
            # Use _unalias on the provided key so that if key is "span_id"
            # (which normally would be normalized to "context.span_id"),
            # we get the raw value "span_id" for the explosion.
            new_explode = Explosion(
                key=new_explode.key,
                kwargs=new_explode.kwargs,
                primary_index_key=_unalias(key),
            )
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=new_explode,
            _concat=self._concat,
            _rename=self._rename,
            # For the index projection, we follow the normalization as before.
            _index=Projection(key=_normalize_field(key)),
            _index_has_been_set=True,
        )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        if self._select:
            result["select"] = {k: v.to_dict() for k, v in self._select.items()}
        if self._filter:
            result["filter"] = self._filter.to_dict()
        if self._explode:
            result["explode"] = self._explode.to_dict()
        if self._concat:
            result["concat"] = self._concat.to_dict()
        if self._rename:
            result["rename"] = dict(self._rename)
        if self._index is not None and self._index_has_been_set:
            result["index"] = self._index.to_dict()
        elif any(
            [
                self._select,
                self._filter,
                self._explode,
                self._concat,
                self._rename,
            ]
        ):
            result["index"] = Projection(key="context.span_id").to_dict()
        return result


def convert_otlp_span_to_span(otlp_span: dict[str, Any]) -> Span:
    """
    Convert an OTLP span (from the autogenerated types) to the ergonomic Span format.

    Args:
        otlp_span: An OTLP span dictionary

    Returns:
        A simplified Span dictionary
    """
    span: Span = {}

    # Copy basic fields
    if trace_id := otlp_span.get("trace_id"):
        span["trace_id"] = trace_id
    if span_id := otlp_span.get("span_id"):
        span["span_id"] = span_id
    if parent_span_id := otlp_span.get("parent_span_id"):
        span["parent_span_id"] = parent_span_id
    if name := otlp_span.get("name"):
        span["name"] = name
    if start_time := otlp_span.get("start_time_unix_nano"):
        span["start_time"] = _nanoseconds_to_datetime(start_time)
    if end_time := otlp_span.get("end_time_unix_nano"):
        span["end_time"] = _nanoseconds_to_datetime(end_time)

    # Convert attributes from OTLP KeyValue format to simple dict
    if attributes := otlp_span.get("attributes"):
        span["attributes"] = _flatten_otlp_attributes(attributes)

    # Convert events
    if events := otlp_span.get("events"):
        span["events"] = _convert_otlp_events(events)

    # Convert status
    if status := otlp_span.get("status"):
        span_status: SpanStatus = {}
        if code := status.get("code"):
            # Convert integer code back to string
            code_map = {0: "UNSET", 1: "OK", 2: "ERROR"}
            span_status["code"] = code_map.get(code, "UNSET")
        if message := status.get("message"):
            span_status["message"] = message
        if span_status:
            span["status"] = span_status

    return span


def _nanoseconds_to_datetime(nano_timestamp: Union[int, str]) -> datetime:
    """Convert nanosecond timestamp to datetime object."""
    if isinstance(nano_timestamp, str):
        nano_timestamp = int(nano_timestamp)
    # Convert nanoseconds to seconds (datetime.fromtimestamp expects seconds)
    seconds = nano_timestamp / 1_000_000_000
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _flatten_otlp_attributes(otlp_attributes: list[dict[str, Any]]) -> dict[str, Any]:
    """Convert OTLP KeyValue attributes to a simple dictionary."""
    result: dict[str, Any] = {}
    for kv in otlp_attributes:
        key = kv.get("key")
        if not key:
            continue
        value = kv.get("value", {})
        result[key] = _extract_otlp_any_value(value)
    return result


def _extract_otlp_any_value(any_value: dict[str, Any]) -> Any:
    """Extract the actual value from an OTLP AnyValue."""
    if "string_value" in any_value:
        return any_value["string_value"]
    elif "bool_value" in any_value:
        return any_value["bool_value"]
    elif "int_value" in any_value:
        int_val = any_value["int_value"]
        return int(int_val) if isinstance(int_val, str) else int_val
    elif "double_value" in any_value:
        double_val = any_value["double_value"]
        if isinstance(double_val, str):
            if double_val == "Infinity":
                return float("inf")
            elif double_val == "-Infinity":
                return float("-inf")
            elif double_val == "NaN":
                return float("nan")
            else:
                return float(double_val)
        return double_val
    elif "bytes_value" in any_value:
        return any_value["bytes_value"]  # Keep as hex string
    elif "array_value" in any_value:
        array_val = any_value["array_value"]
        if "values" in array_val:
            return [_extract_otlp_any_value(val) for val in array_val["values"]]
        return []
    else:
        return None


def _convert_otlp_events(otlp_events: list[dict[str, Any]]) -> list[SpanEvent]:
    """Convert OTLP events to simplified events."""
    events: list[SpanEvent] = []
    for event in otlp_events:
        span_event: SpanEvent = {}
        if name := event.get("name"):
            span_event["name"] = name
        if timestamp := event.get("time_unix_nano"):
            span_event["timestamp"] = _nanoseconds_to_datetime(timestamp)
        if attributes := event.get("attributes"):
            span_event["attributes"] = _flatten_otlp_attributes(attributes)
        events.append(span_event)
    return events
