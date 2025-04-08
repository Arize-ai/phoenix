from dataclasses import dataclass, field as dataclass_field
from typing import Any, Dict, List, Optional

_BACKWARD_COMPATIBILITY_REPLACEMENTS: Dict[str, str] = {
    "context.span_id": "span_id",
    "context.trace_id": "trace_id",
    "cumulative_token_count.completion": "cumulative_llm_token_count_completion",
    "cumulative_token_count.prompt": "cumulative_llm_token_count_prompt",
    "cumulative_token_count.total": "cumulative_llm_token_count_total",
}

_ALIASES: Dict[str, str] = {
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

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {"key": self.key}

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Projection":
        return cls(key=obj["key"])


@dataclass
class SpanFilter:
    """Represents a filter condition in a span query."""

    condition: str = dataclass_field(default="")
    valid_eval_names: Optional[List[str]] = dataclass_field(default=None)

    def __post_init__(self) -> None:
        if not self.condition:
            raise ValueError("Filter condition cannot be empty")
        for old, new in _BACKWARD_COMPATIBILITY_REPLACEMENTS.items():
            self.condition = self.condition.replace(old, new)

    def to_dict(self) -> Dict[str, Any]:
        return {"condition": self.condition}

    @classmethod
    def from_dict(
        cls,
        obj: Dict[str, Any],
        valid_eval_names: Optional[List[str]] = None,
    ) -> "SpanFilter":
        return cls(
            condition=obj.get("condition") or "",
            valid_eval_names=valid_eval_names,
        )


@dataclass
class Explosion:
    """Represents an explosion operation in a span query."""

    key: str = dataclass_field(default="")
    _kwargs: Dict[str, str] = dataclass_field(default_factory=dict)
    _primary_index_key: str = dataclass_field(default="context.span_id")

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("Explosion key cannot be empty")
        self.key = _replace_backward_compatibility(_unalias(self.key))
        if not self._primary_index_key:
            raise ValueError("Primary index key cannot be empty")
        self._kwargs = {k: _replace_backward_compatibility(_unalias(v)) for k, v in self._kwargs.items()}

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "key": self.key,
            "primary_index_key": self._primary_index_key,
        }
        if self._kwargs:
            result["kwargs"] = self._kwargs
        return result

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Explosion":
        if not obj.get("key"):
            raise ValueError("Explosion key cannot be empty")
        return cls(
            _key=obj["key"],
            _kwargs=obj.get("kwargs", {}),
            _primary_index_key=obj.get("primary_index_key", "context.span_id"),
        )


@dataclass
class Concatenation:
    """Represents a concatenation operation in a span query."""

    key: str = dataclass_field(default="")
    _kwargs: Dict[str, str] = dataclass_field(default_factory=dict)
    _separator: str = dataclass_field(default="\n\n")

    def __post_init__(self) -> None:
        if not self.key:
            raise ValueError("Concatenation key cannot be empty")
        self.key = _replace_backward_compatibility(_unalias(self.key))
        self._kwargs = {k: _replace_backward_compatibility(_unalias(v)) for k, v in self._kwargs.items()}

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "key": self.key,
            "separator": self._separator,
        }
        if self._kwargs:
            result["kwargs"] = self._kwargs
        return result

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Concatenation":
        if not obj.get("key"):
            raise ValueError("Concatenation key cannot be empty")
        return cls(
            _key=obj["key"],
            _kwargs=obj.get("kwargs", {}),
            _separator=obj.get("separator", "\n\n"),
        )


@dataclass
class SpanQuery:
    """Represents a query for spans using the query DSL."""

    _select: Optional[Dict[str, Projection]] = dataclass_field(default=None)
    _filter: Optional[SpanFilter] = dataclass_field(default=None)
    _explode: Optional[Explosion] = dataclass_field(default=None)
    _concat: Optional[Concatenation] = dataclass_field(default=None)
    _rename: Optional[Dict[str, str]] = dataclass_field(default=None)
    _index: Optional[Projection] = dataclass_field(default=None)
    _index_has_been_set: bool = dataclass_field(default=False)

    def select(self, *fields: str) -> "SpanQuery":
        select_dict = {}
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
        current_index = self._index._key if self._index else "context.span_id"
        primary_index_key = current_index
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=Explosion(key=key, _kwargs=kwargs, _primary_index_key=primary_index_key),
            _concat=self._concat,
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        """Concatenate a field from the spans."""
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=self._explode,
            _concat=Concatenation(key=key, _kwargs=kwargs),
            _rename=self._rename,
            _index=self._index,
            _index_has_been_set=self._index_has_been_set,
        )

    def rename(self, **kwargs: str) -> "SpanQuery":
        """Rename fields in the result."""
        return SpanQuery(
            _select=self._select,
            _filter=self._filter,
            _explode=self._explode,
            _concat=self._concat,
            _rename=kwargs,
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
                _kwargs=new_explode._kwargs,
                _primary_index_key=_unalias(key),
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

    def to_dict(self) -> Dict[str, Any]:
        result = {}
        if self._select:
            result["select"] = {k: v.to_dict() for k, v in self._select.items()}
        if self._filter:
            result["filter"] = self._filter.to_dict()
        if self._explode:
            result["explode"] = self._explode.to_dict()
        if self._concat:
            result["concat"] = self._concat.to_dict()
        if self._rename:
            result["rename"] = self._rename
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

    @classmethod
    def from_dict(
        cls,
        obj: Dict[str, Any],
        valid_eval_names: Optional[List[str]] = None,
    ) -> "SpanQuery":
        return cls(
            _select={
                name: Projection.from_dict(proj)
                for name, proj in obj.get("select", {}).items()
            }
            if obj.get("select")
            else None,
            _filter=SpanFilter.from_dict(
                obj["filter"],
                valid_eval_names=valid_eval_names,
            )
            if obj.get("filter")
            else None,
            _explode=Explosion.from_dict(obj["explode"])
            if obj.get("explode") and obj["explode"].get("key")
            else None,
            _concat=Concatenation.from_dict(obj["concat"])
            if obj.get("concat") and obj["concat"].get("key")
            else None,
            _rename=dict(obj["rename"]) if obj.get("rename") else None,
            _index=Projection.from_dict(obj["index"]) if obj.get("index") else None,
        )


class GetSpansRequestBody:
    queries: List[SpanQuery] = dataclass_field(default=[])
    start_time: Optional[str] = dataclass_field(default=None)
    end_time: Optional[str] = dataclass_field(default=None)
    limit: int = dataclass_field(default=1000)
    root_spans_only: Optional[bool] = dataclass_field(default=None)
    project_name: Optional[str] = dataclass_field(default=None)


class SpanData:
    span_id: str = dataclass_field(default="")
    trace_id: str = dataclass_field(default="")
    name: str = dataclass_field(default="")
    span_kind: str = dataclass_field(default="")
    start_time: str = dataclass_field(default="")
    end_time: Optional[str] = dataclass_field(default=None)
    parent_id: Optional[str] = dataclass_field(default=None)
    attributes: Dict[str, Any] = dataclass_field(default=dict)


class GetSpansResponseBody:
    data: List[SpanData] = dataclass_field(default=[])
