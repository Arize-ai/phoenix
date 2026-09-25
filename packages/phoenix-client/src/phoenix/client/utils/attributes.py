"""Shape stored span attributes the way the server's dataframe export did."""

from __future__ import annotations

import inspect
import json
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping, Sequence
from typing import Any, Union, cast

from openinference.semconv import trace
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from typing_extensions import TypeGuard

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


def _is_mapping(value: Any) -> TypeGuard[Mapping[str, Any]]:
    return isinstance(value, Mapping)


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


__all__ = ["flatten", "flatten_semantic_conventions", "get_attribute_value"]
