"""
The history of this code is that `get_spans_dataframe` historically relied on the POST
`/v1/spans` route, which returned a bespoke columnar data format in JSON and pyarrow. Once
`get_spans_dataframe` was migrated to pull span data from GET `/v1/projects/<project_id>/spans`,
the logic which lived in POST `/v1/spans` was moved and adapted for the client for the sake of
backward compatibility. The code in this file is purely for maintaining backward compatibility of
this one method and should not be used in new code paths going forward.
"""

from __future__ import annotations

import ast
import inspect
import json
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping, Sequence
from typing import TYPE_CHECKING, Any, Optional, Union, cast

from openinference.semconv import trace
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from typing_extensions import TypeGuard

from phoenix.client.__generated__ import v1
from phoenix.client.types.spans import SpanQuery

if TYPE_CHECKING:
    import pandas as pd

_SPAN_ID = "context.span_id"
_TRACE_ID = "context.trace_id"

SPAN_EXPORT_COLUMNS = (
    "name",
    "span_kind",
    "parent_id",
    "start_time",
    "end_time",
    "status_code",
    "status_message",
    "events",
    _SPAN_ID,
    _TRACE_ID,
)
"""The non-attribute columns of the export, in the order the legacy export used."""

_TIMESTAMP_COLUMNS = ("start_time", "end_time")

_ATTRIBUTES_PREFIX = "attributes."

_SUBSCRIPT_ROOTS = {"attributes": (), "metadata": ("metadata",)}
"""Names a subscript projection may start from, with the attribute path each stands for."""

_UNAVAILABLE_FIELDS = (
    "cumulative_llm_token_count_completion",
    "cumulative_llm_token_count_prompt",
    "cumulative_llm_token_count_total",
)
"""Span fields the legacy export could project but the span list endpoint does not return."""

_POSITION_PREFIXES = {"retrieval.documents": "document_"}
"""Position column prefixes for exploded keys, e.g. ``document_position``."""

_CANONICAL_KEYS = {
    "span_id": _SPAN_ID,
    "trace_id": _TRACE_ID,
    "cumulative_token_count.completion": "cumulative_llm_token_count_completion",
    "cumulative_token_count.prompt": "cumulative_llm_token_count_prompt",
    "cumulative_token_count.total": "cumulative_llm_token_count_total",
}
"""Short and legacy spellings the server DSL accepts, mapped to the column they name."""


def _canonical(key: str) -> str:
    return _CANONICAL_KEYS.get(key, key)


def _is_mapping(value: Any) -> TypeGuard[Mapping[str, Any]]:
    return isinstance(value, Mapping)


def _is_list(value: Any) -> TypeGuard[list[Any]]:
    return isinstance(value, list)


def convert_spans_to_dataframe(
    spans: Sequence[v1.Span], query: Optional[SpanQuery] = None
) -> "pd.DataFrame":
    """Convert spans from the span list endpoint into a dataframe.

    The frame has the columns and index of the legacy ``POST /v1/spans`` export, and the
    query's ``select``, ``explode``, ``concat``, ``rename`` and ``with_index`` steps are
    applied to it. The query's ``where`` is not evaluated here; pass it to the server.

    Without ``select``, ``explode`` or ``concat`` every span field and attribute is a
    column, indexed by span id while keeping the id as a column. With any of them, only
    the projected columns remain and the index column is dropped, as the legacy export did.

    A span without the exploded array is dropped. A span without the concatenated array
    is dropped too, unless the query also explodes, in which case its concat columns are
    left empty; both follow the legacy export.
    """
    plan = query.to_dict() if query else {}
    if not any(step in plan for step in ("select", "explode", "concat")):
        return _rename(_full_export(spans), plan)
    return _rename(_projected_export(spans, plan), plan)


_ALIASED_COLUMNS = {"span_id": _SPAN_ID, "trace_id": _TRACE_ID}
"""Short column labels the legacy export renamed to their ``context.`` form."""


def _rename(df: "pd.DataFrame", plan: Mapping[str, Any]) -> "pd.DataFrame":
    df = df.rename(columns=_ALIASED_COLUMNS)
    if rename := plan.get("rename"):
        return df.rename(columns=dict(rename))
    return df


def _full_export(spans: Sequence[v1.Span]) -> "pd.DataFrame":
    import pandas as pd

    df = pd.DataFrame.from_records(
        [_span_fields(span) for span in spans],
        columns=list(SPAN_EXPORT_COLUMNS),
    ).set_index(_SPAN_ID, drop=False)
    if df.empty:
        return df
    for column in _TIMESTAMP_COLUMNS:
        df[column] = pd.to_datetime(df[column], utc=True, format="ISO8601")
    attributes = pd.DataFrame.from_records(
        [flatten_semantic_conventions(_stored_attributes(span)) for span in spans]
    ).set_axis(df.index, axis=0)
    return pd.concat([df, attributes.add_prefix(_ATTRIBUTES_PREFIX)], axis=1)


def _projected_export(spans: Sequence[v1.Span], plan: Mapping[str, Any]) -> "pd.DataFrame":
    import pandas as pd

    select: Mapping[str, Mapping[str, str]] = plan.get("select") or {}
    explode: Optional[Mapping[str, Any]] = plan.get("explode")
    concat: Optional[Mapping[str, Any]] = plan.get("concat")
    index_key = _canonical(plan.get("index", {}).get("key") or _SPAN_ID)
    index_keys = [index_key]
    if explode:
        index_keys = [
            _canonical(explode.get("primary_index_key") or _SPAN_ID),
            _position_column(explode["key"]),
        ]

    rows: list[dict[str, Any]] = []
    for span in spans:
        record = _SpanRecord(span)
        base = {label: record.project(proj["key"]) for label, proj in select.items()}
        for key in index_keys[:1]:
            base.setdefault(key, record.project(key))
        if concat:
            concatenated = record.concat(concat)
            if concatenated is None and not explode:
                continue
            base.update(concatenated or {})
        if explode:
            for exploded in record.explode(explode):
                rows.append({**exploded, **base})
        else:
            rows.append(base)

    known = [*index_keys, *select, *_known_labels(explode), *_known_labels(concat)]
    df = pd.DataFrame.from_records(rows)
    for column in known:
        if column not in df.columns:
            df[column] = pd.Series(dtype=object, index=df.index)
    df = df[list(dict.fromkeys([*known, *df.columns]))]
    if not df.empty:
        for column in _TIMESTAMP_COLUMNS:
            if column in df.columns:
                df[column] = pd.to_datetime(df[column], utc=True, format="ISO8601")
    return df.set_index(index_keys)


def _known_labels(step: Optional[Mapping[str, Any]]) -> list[str]:
    if not step:
        return []
    if kwargs := step.get("kwargs"):
        return list(kwargs)
    return [] if "primary_index_key" in step else [step["key"]]


def _position_column(explode_key: str) -> str:
    return _POSITION_PREFIXES.get(_strip_attributes_prefix(explode_key), "") + "position"


def _strip_attributes_prefix(key: str) -> str:
    return key[len(_ATTRIBUTES_PREFIX) :] if key.startswith(_ATTRIBUTES_PREFIX) else key


class _SpanRecord:
    """One span's fields and stored attributes, projected the way the server's DSL did."""

    def __init__(self, span: v1.Span) -> None:
        self.fields = _span_fields(span)
        self.attributes = _stored_attributes(span)

    def project(self, key: str) -> Any:
        key = _canonical(key)
        if key in _UNAVAILABLE_FIELDS:
            raise ValueError(
                f"{key!r} cannot be selected: the span list endpoint does not return it. "
                "Compute it from the span's descendants instead."
            )
        if key in self.fields:
            return self.fields[key]
        if key == "latency_ms":
            return _latency_ms(self.fields)
        if key == "attributes":
            return self.attributes
        return _lookup(self.attributes, key)

    def explode(self, explode: Mapping[str, Any]) -> Iterator[dict[str, Any]]:
        array = _lookup(self.attributes, explode["key"])
        if not _is_list(array):
            return
        position_column = _position_column(explode["key"])
        kwargs: Mapping[str, str] = explode.get("kwargs") or {}
        for position, element in enumerate(array):
            if not _is_mapping(element):
                continue
            if kwargs:
                values = {
                    label: value
                    for label, key in kwargs.items()
                    if (value := get_attribute_value(element, key)) is not None
                }
            else:
                values = dict(flatten(element))
            yield {position_column: position, **values}

    def concat(self, concat: Mapping[str, Any]) -> Optional[dict[str, str]]:
        array = _lookup(self.attributes, concat["key"])
        if not _is_list(array):
            return None
        separator: str = concat.get("separator", "\n\n")
        kwargs: Mapping[str, str] = concat.get("kwargs") or {}
        if not kwargs:
            return {concat["key"]: separator.join(str(element) for element in array)}
        values: defaultdict[str, list[str]] = defaultdict(list)
        for element in array:
            if not _is_mapping(element):
                continue
            for label, key in kwargs.items():
                if (value := get_attribute_value(element, key)) is not None:
                    values[label].append(str(value))
        return {label: separator.join(parts) for label, parts in values.items()}


def _span_fields(span: v1.Span) -> dict[str, Any]:
    return {
        "name": span["name"],
        "span_kind": span["span_kind"],
        "parent_id": span.get("parent_id"),
        "start_time": span["start_time"],
        "end_time": span.get("end_time"),
        "status_code": span["status_code"],
        "status_message": span.get("status_message", ""),
        "events": list(span.get("events") or []),
        _SPAN_ID: span["context"]["span_id"],
        _TRACE_ID: span["context"]["trace_id"],
    }


def _stored_attributes(span: v1.Span) -> dict[str, Any]:
    """The span's attributes as stored, which ``get_spans_dataframe`` asks the server for."""
    return dict(span.get("attributes") or {})


def _latency_ms(fields: Mapping[str, Any]) -> Optional[float]:
    import pandas as pd

    if not fields["end_time"]:
        return None
    start = pd.Timestamp(fields["start_time"])
    end = pd.Timestamp(fields["end_time"])
    return (end - start).total_seconds() * 1000


def _lookup(attributes: Mapping[str, Any], key: str) -> Any:
    """Resolve a projection key against nested attributes.

    Accepts the dotted form (``output.value``), the same with an ``attributes.`` prefix,
    and the subscript forms the server DSL also allows (``attributes['output']['value']``,
    ``metadata['key']``).
    """
    if "[" in key:
        return _lookup_subscript(attributes, key)
    return get_attribute_value(attributes, _strip_attributes_prefix(key))


def _lookup_subscript(attributes: Mapping[str, Any], expression: str) -> Any:
    keys: list[str] = []
    node: ast.expr = ast.parse(expression, mode="eval").body
    while isinstance(node, ast.Subscript):
        index = node.slice
        if isinstance(index, ast.Constant) and isinstance(index.value, str):
            keys.insert(0, index.value)
        elif isinstance(index, ast.List) and all(
            isinstance(element, ast.Constant) and isinstance(element.value, str)
            for element in index.elts
        ):
            keys[:0] = [element.value for element in index.elts]  # type: ignore[attr-defined]
        else:
            raise ValueError(f"invalid projection: {expression}")
        node = node.value
    if not isinstance(node, ast.Name) or node.id not in _SUBSCRIPT_ROOTS:
        raise ValueError(f"invalid projection: {expression}")
    value: Any = attributes
    for key in [*_SUBSCRIPT_ROOTS[node.id], *keys]:
        if not _is_mapping(value):
            return None
        value = value.get(key)
    return value


_JSON_STRING_ATTRIBUTES = (
    DocumentAttributes.DOCUMENT_METADATA,
    SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES,
    SpanAttributes.METADATA,
    SpanAttributes.TOOL_PARAMETERS,
)

_SEMANTIC_CONVENTIONS: list[str] = sorted(
    (
        cast(str, getattr(klass, attr))
        for name in dir(trace)
        if name.endswith("Attributes") and inspect.isclass(klass := getattr(trace, name))
        for attr in dir(klass)
        if attr.isupper()
    ),
    key=len,
    reverse=True,
)
"""Longest first, so ``llm.input_messages`` wins over ``llm`` when matching prefixes."""

_SEPARATOR = "."


def flatten_semantic_conventions(attributes: Mapping[str, Any]) -> dict[str, Any]:
    """Nest stored attributes with each semantic-convention key kept as one dotted key.

    Mirrors ``_flatten_semantic_conventions`` behind the deprecated ``POST /v1/spans``
    export: custom attributes stay nested, ``metadata``-like values stay whole.
    """
    return _unflatten(
        _load_json_strings(
            flatten(attributes, recurse_on_sequence=True, json_string_attributes=True)
        )
    )


def get_attribute_value(attributes: Any, key: str) -> Any:
    """Walk nested ``attributes`` along the dotted ``key``, as the server DSL did."""
    if not _is_mapping(attributes):
        return None
    *parents, last = key.split(_SEPARATOR)
    for parent in parents:
        attributes = attributes.get(parent)
        if not (attributes and _is_mapping(attributes)):
            return None
    return attributes.get(last)


def flatten(
    obj: Union[Mapping[str, Any], Iterable[Any]],
    *,
    prefix: str = "",
    recurse_on_sequence: bool = False,
    json_string_attributes: bool = False,
) -> Iterator[tuple[str, Any]]:
    """Flatten nested attributes into dotted key-value pairs, as ``phoenix.trace.attributes`` does.

    Sequences of mappings are flattened by index only when ``recurse_on_sequence`` is set;
    other sequences stay whole. With ``json_string_attributes``, mapping values under
    ``metadata``-like keys are dumped to JSON strings instead of being flattened.
    """
    if _is_mapping(obj):
        yield from _flatten_mapping(
            obj,
            prefix=prefix,
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
        )
    else:
        yield from _flatten_sequence(
            obj,
            prefix=prefix,
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
        )


def _flatten_mapping(
    mapping: Mapping[str, Any],
    *,
    prefix: str,
    recurse_on_sequence: bool,
    json_string_attributes: bool,
) -> Iterator[tuple[str, Any]]:
    for key, value in mapping.items():
        prefixed_key = f"{prefix}{_SEPARATOR}{key}" if prefix else key
        if _is_mapping(value):
            if json_string_attributes and prefixed_key.endswith(_JSON_STRING_ATTRIBUTES):
                yield prefixed_key, json.dumps(value)
            else:
                yield from _flatten_mapping(
                    value,
                    prefix=prefixed_key,
                    recurse_on_sequence=recurse_on_sequence,
                    json_string_attributes=json_string_attributes,
                )
        elif isinstance(value, Sequence) and not isinstance(value, str) and recurse_on_sequence:
            sequence: Sequence[Any] = value
            yield from _flatten_sequence(
                sequence,
                prefix=prefixed_key,
                recurse_on_sequence=recurse_on_sequence,
                json_string_attributes=json_string_attributes,
            )
        elif value is not None:
            yield prefixed_key, value


def _flatten_sequence(
    sequence: Iterable[Any],
    *,
    prefix: str,
    recurse_on_sequence: bool,
    json_string_attributes: bool,
) -> Iterator[tuple[str, Any]]:
    if isinstance(sequence, str) or not any(_is_mapping(item) for item in sequence):
        yield prefix, sequence
    for index, item in enumerate(sequence):
        if not _is_mapping(item):
            continue
        yield from _flatten_mapping(
            item,
            prefix=f"{prefix}{_SEPARATOR}{index}" if prefix else f"{index}",
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
        )


def _load_json_strings(key_values: Iterable[tuple[str, Any]]) -> Iterator[tuple[str, Any]]:
    for key, value in key_values:
        if key.endswith(_JSON_STRING_ATTRIBUTES):
            try:
                dict_value = json.loads(value)
            except Exception:
                yield key, value
            else:
                if dict_value is not None:
                    yield key, dict_value
        else:
            yield key, value


def _unflatten(key_value_pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    return dict(_walk(_build_trie(key_value_pairs)))


def _partition_with_prefix_exclusion(key: str) -> tuple[str, str, str]:
    for prefix in _SEMANTIC_CONVENTIONS:
        if key.startswith(prefix) and (
            len(key) == len(prefix) or key[len(prefix) :].startswith(_SEPARATOR)
        ):
            return prefix, _SEPARATOR, key[len(prefix) + len(_SEPARATOR) :]
    return key.partition(_SEPARATOR)


class _Trie(defaultdict[Union[str, int], "_Trie"]):
    """Prefix tree where all-digit keys with children are list indices."""

    def __init__(self) -> None:
        super().__init__(_Trie)
        self.value: Any = None
        self.indices: set[int] = set()
        self.branches: set[Union[str, int]] = set()

    def set_value(self, value: Any) -> None:
        self.value = value
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
            self.indices.discard(branch)
        self.branches.add(branch)
        return self[branch]


def _build_trie(key_value_pairs: Iterable[tuple[str, Any]]) -> _Trie:
    trie = _Trie()
    for key, value in key_value_pairs:
        if value is None:
            continue
        node = trie
        while True:
            prefix, _, suffix = _partition_with_prefix_exclusion(key)
            prefix = prefix.strip()
            if prefix.isdigit():
                node = node.add_index(int(prefix)) if suffix else node.add_branch(int(prefix))
            else:
                node = node.add_branch(prefix)
            if not suffix:
                break
            key = suffix
        node.set_value(value)
    return trie


def _walk(trie: _Trie, *, prefix: str = "") -> Iterator[tuple[str, Any]]:
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
        new_prefix = f"{prefix}{_SEPARATOR}{branch}" if prefix else f"{branch}"
        yield from _walk(trie[branch], prefix=new_prefix)


__all__ = ["SPAN_EXPORT_COLUMNS", "convert_spans_to_dataframe"]
