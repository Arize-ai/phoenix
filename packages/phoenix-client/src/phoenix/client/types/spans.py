from dataclasses import dataclass, replace
from dataclasses import field as dataclass_field
from typing import Any, Optional

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
    _concat_separator: str = dataclass_field(default="\n\n")
    _rename: Optional[dict[str, str]] = dataclass_field(default=None)
    _index: Optional[Projection] = dataclass_field(default=None)
    _index_has_been_set: bool = dataclass_field(default=False)

    def select(self, *fields: str, **labeled_fields: str) -> "SpanQuery":
        """Project ``fields`` as columns; a keyword argument names the column for its field."""
        select_dict: dict[str, Projection] = {}
        for label, field in (*zip(fields, fields), *labeled_fields.items()):
            select_dict[_ALIASES.get(label, label)] = Projection(key=_normalize_field(field))
        return replace(self, _select=select_dict)

    def where(self, condition: str) -> "SpanQuery":
        """Filter spans based on a condition."""
        return replace(self, _filter=SpanFilter(condition=condition))

    def explode(self, key: str, **kwargs: str) -> "SpanQuery":
        primary_index_key = self._index.key if self._index else "context.span_id"
        normalized_kwargs = {_normalize_field(k): _normalize_field(v) for k, v in kwargs.items()}
        return replace(
            self,
            _explode=Explosion(
                key=key, kwargs=normalized_kwargs, primary_index_key=primary_index_key
            ),
        )

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        """Concatenate a field from the spans."""
        normalized_kwargs = {_normalize_field(k): _normalize_field(v) for k, v in kwargs.items()}
        return replace(
            self,
            _concat=Concatenation(
                key=key, kwargs=normalized_kwargs, separator=self._concat_separator
            ),
        )

    def with_concat_separator(self, separator: str = "\n\n") -> "SpanQuery":
        """Join concatenated values with ``separator`` instead of a blank line."""
        concat = self._concat
        if concat is not None:
            concat = Concatenation(key=concat.key, kwargs=concat.kwargs, separator=separator)
        return replace(self, _concat=concat, _concat_separator=separator)

    def rename(self, **kwargs: str) -> "SpanQuery":
        """Rename fields in the result."""
        rename_dict = {_normalize_field(old): new for old, new in kwargs.items()}
        return replace(self, _rename=rename_dict)

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
        return replace(
            self,
            _explode=new_explode,
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
