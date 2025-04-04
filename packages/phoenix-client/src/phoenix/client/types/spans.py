from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

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

_REVERSE_BACKWARD_COMPATIBILITY_REPLACEMENTS: Dict[str, str] = {
    v: k for k, v in _BACKWARD_COMPATIBILITY_REPLACEMENTS.items()
}


def _unalias(key: str) -> str:
    """Convert old field names to their new form."""
    return _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(key, key)


def _replace_backward_compatibility(key: str) -> str:
    """Replace backward compatibility field names with their current form."""
    return _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(key, key)


def _normalize_field(key: str) -> str:
    if key.startswith("context."):
        return key[len("context.") :]
    if key in _ALIASES:
        return _ALIASES[key]
    if key in _BACKWARD_COMPATIBILITY_REPLACEMENTS:
        return _BACKWARD_COMPATIBILITY_REPLACEMENTS[key]
    return key


class Projection(BaseModel):
    """Represents a projection in a span query."""

    key: str = Field(description="The key to project from the span attributes")

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not v:
            raise ValueError("Projection key cannot be empty")
        # Do not apply _normalize_field here—assume it's already done.
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {"key": self.key}

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Projection":
        return cls(key=obj["key"])


class SpanFilter(BaseModel):
    """Represents a filter condition in a span query."""

    condition: str = Field(description="The filter condition as a Python boolean expression")
    valid_eval_names: Optional[List[str]] = Field(
        default=None,
        description="List of valid evaluation names that can be referenced in the condition",
    )

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: str) -> str:
        if not v:
            raise ValueError("Filter condition cannot be empty")
        for old, new in _BACKWARD_COMPATIBILITY_REPLACEMENTS.items():
            v = v.replace(old, new)
        return v

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


class Explosion(BaseModel):
    """Represents an explosion operation in a span query."""

    key: str = Field(description="The key to explode from the span attributes")
    kwargs: Dict[str, str] = Field(
        default_factory=dict, description="Additional fields to include in the explosion"
    )
    primary_index_key: str = Field(
        default="context.span_id",
        description="The key to use as the primary index",
    )

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not v:
            raise ValueError("Explosion key cannot be empty")
        return _replace_backward_compatibility(_unalias(v))

    @field_validator("primary_index_key")
    @classmethod
    def validate_primary_index_key(cls, v: str) -> str:
        if not v:
            raise ValueError("Primary index key cannot be empty")
        # DO NOT convert here; preserve exactly as-is.
        return v

    @field_validator("kwargs")
    @classmethod
    def validate_kwargs(cls, v: Dict[str, str]) -> Dict[str, str]:
        return {k: _replace_backward_compatibility(_unalias(v)) for k, v in v.items()}

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "key": self.key,
            "primary_index_key": self.primary_index_key,  # Ensure unchanged here
        }
        if self.kwargs:
            result["kwargs"] = self.kwargs
        return result

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Explosion":
        if not obj.get("key"):
            raise ValueError("Explosion key cannot be empty")
        return cls(
            key=obj["key"],
            kwargs=obj.get("kwargs", {}),
            primary_index_key=obj.get("primary_index_key", "context.span_id"),
        )


class Concatenation(BaseModel):
    """Represents a concatenation operation in a span query."""

    key: str = Field(description="The key to concatenate from the span attributes")
    kwargs: Dict[str, str] = Field(
        default_factory=dict, description="Additional fields to include in the concatenation"
    )
    separator: str = Field(default="\n\n", description="The separator to use when concatenating")

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not v:
            raise ValueError("Concatenation key cannot be empty")
        return _replace_backward_compatibility(_unalias(v))

    @field_validator("kwargs")
    @classmethod
    def validate_kwargs(cls, v: Dict[str, str]) -> Dict[str, str]:
        return {k: _replace_backward_compatibility(_unalias(v)) for k, v in v.items()}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        result = {
            "key": self.key,
            "separator": self.separator,
        }
        # Only include kwargs if it's not empty
        if self.kwargs:
            result["kwargs"] = self.kwargs
        return result

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]) -> "Concatenation":
        if not obj.get("key"):  # check `key` for backward-compatible truthiness
            raise ValueError("Concatenation key cannot be empty")
        return cls(
            key=obj["key"],
            kwargs=obj.get("kwargs", {}),
            separator=obj.get("separator", "\n\n"),
        )


class SpanQuery(BaseModel):
    """Represents a query for spans using the query DSL."""

    select: Optional[Dict[str, Projection]] = Field(
        default=None, description="Fields to select from the spans"
    )
    filter: Optional[SpanFilter] = Field(
        default=None, description="Filter condition to apply to the spans"
    )
    explode: Optional[Explosion] = Field(
        default=None, description="Field to explode from the spans"
    )
    concat: Optional[Concatenation] = Field(
        default=None, description="Field to concatenate from the spans"
    )
    rename: Optional[Dict[str, str]] = Field(
        default=None, description="Mapping of field names to rename in the result"
    )
    index: Optional[Projection] = Field(
        default=None, description="Field to use as the index in the result"
    )
    concat_separator: str = Field(
        default="\n\n", description="Default separator to use for concatenation operations"
    )

    def select_fields(self, *args: str, **kwargs: str) -> "SpanQuery":
        select_dict = {}
        # Handle positional arguments
        for name in args:
            norm_key = _normalize_field(name)  # Toggle exactly once here.
            select_dict[norm_key] = Projection(key=norm_key)
        # Handle keyword arguments similarly.
        for name, key in kwargs.items():
            norm_key = _normalize_field(key)
            select_dict[norm_key] = Projection(key=norm_key)
        return self.model_copy(update={"select": select_dict})

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format, excluding concat_separator."""
        result = {}
        if self.select is not None:
            # Use the select dictionary as is, since keys are already converted
            result["select"] = {k: v.to_dict() for k, v in self.select.items()}
        if self.filter is not None:
            result["filter"] = self.filter.to_dict()
        if self.explode is not None:
            result["explode"] = self.explode.to_dict()
        if self.concat is not None:
            result["concat"] = self.concat.to_dict()
        if self.rename is not None and not callable(self.rename):
            result["rename"] = self.rename
        # Always include index, defaulting to context.span_id if not specified
        result["index"] = (
            self.index.to_dict()
            if self.index is not None
            else Projection(key="context.span_id").to_dict()
        )
        return result

    @field_validator("rename")
    @classmethod
    def validate_rename(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        """Validate the rename field."""
        if v is None:
            return None
        # Convert keys using the toggle helper.
        return {_normalize_field(k): v for k, v in v.items()}

    def where(self, condition: str, valid_eval_names: Optional[List[str]] = None) -> "SpanQuery":
        """Add a filter condition to the query."""
        return self.model_copy(
            update={"filter": SpanFilter(condition=condition, valid_eval_names=valid_eval_names)}
        )

    def explode_field(self, key: str, **kwargs: str) -> "SpanQuery":
        current_index = self.index.key if self.index else "context.span_id"
        # Do not alter current_index here—use it as stored.
        return self.model_copy(
            update={
                "explode": Explosion(
                    key=key, kwargs=kwargs, primary_index_key=current_index
                )
            }
        )

    def concat_field(self, key: str, **kwargs: str) -> "SpanQuery":
        """Concatenate a field from the spans."""
        return self.model_copy(
            update={
                "concat": Concatenation(key=key, kwargs=kwargs, separator=self.concat_separator)
            }
        )

    def rename_fields_dict(self, mapping: Dict[str, str]) -> "SpanQuery":
        """Rename fields in the result using a mapping dictionary."""
        return self.model_copy(update={"rename": mapping})

    def rename_fields(self, **kwargs: str) -> "SpanQuery":
        """Rename fields in the result using keyword arguments."""
        return self.rename_fields_dict(kwargs)

    def with_index(self, key: str = "context.span_id") -> "SpanQuery":
        # Normalize the key: if user passes "span_id", this returns "context.span_id"
        normalized = _normalize_field(key)
        aliased_index = Projection(key=normalized)
        updated_fields = {"index": aliased_index}
        if self.explode:
            # Use the raw key (as provided) for explosion's primary_index_key
            updated_explode = self.explode.model_copy(
                update={"primary_index_key": key}
            )
            updated_fields["explode"] = updated_explode
        return self.model_copy(update=updated_fields)

    def with_concat_separator(self, separator: str = "\n\n") -> "SpanQuery":
        """Set the default separator for concatenation operations."""
        return self.model_copy(update={"concat_separator": separator})

    @classmethod
    def from_dict(
        cls,
        obj: Dict[str, Any],
        valid_eval_names: Optional[List[str]] = None,
    ) -> "SpanQuery":
        return cls(
            **(
                {
                    "select": {
                        name: Projection.from_dict(proj)
                        for name, proj in obj.get("select", {}).items()
                    }
                }
                if obj.get("select")
                else {}
            ),
            **(
                {
                    "filter": SpanFilter.from_dict(
                        obj["filter"],
                        valid_eval_names=valid_eval_names,
                    )
                }
                if obj.get("filter")
                else {}
            ),
            **(
                {"explode": Explosion.from_dict(obj["explode"])}
                if obj.get("explode") and obj["explode"].get("key")
                else {}
            ),
            **(
                {"concat": Concatenation.from_dict(obj["concat"])}
                if obj.get("concat") and obj["concat"].get("key")
                else {}
            ),
            **({"rename": dict(obj["rename"])} if obj.get("rename") else {}),
            **({"index": Projection.from_dict(obj["index"])} if obj.get("index") else {}),
        )


class GetSpansRequestBody(BaseModel):
    queries: List[SpanQuery] = Field(description="List of queries to execute")
    start_time: Optional[str] = Field(
        default=None, description="Start time to filter spans by (ISO format)"
    )
    end_time: Optional[str] = Field(
        default=None, description="End time to filter spans by (ISO format)"
    )
    limit: int = Field(default=1000, description="Maximum number of spans to return")
    root_spans_only: Optional[bool] = Field(
        default=None, description="Whether to only return root spans"
    )
    project_name: Optional[str] = Field(
        default=None, description="The name of the project to query"
    )


class SpanData(BaseModel):
    span_id: str = Field(description="The ID of the span")
    trace_id: str = Field(description="The ID of the trace")
    name: str = Field(description="The name of the span")
    span_kind: str = Field(description="The kind of span")
    start_time: str = Field(description="The start time of the span")
    end_time: Optional[str] = Field(description="The end time of the span")
    parent_id: Optional[str] = Field(description="The ID of the parent span")
    attributes: Dict[str, Any] = Field(description="The attributes of the span")


class GetSpansResponseBody(BaseModel):
    data: List[SpanData] = Field(description="The spans data")
