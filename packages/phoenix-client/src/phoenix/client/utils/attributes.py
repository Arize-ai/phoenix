"""Re-nest span attributes the way the server's dataframe export does.

The ``GET /v1/projects/{id}/spans`` route returns attributes fully flattened
(``"llm.input_messages.0.message.role"``), while the legacy ``POST /v1/spans``
dataframe export keeps each semantic-convention key as one column holding a
structured value. This mirrors ``phoenix.trace.attributes`` on the server so
both paths produce the same columns; keep the two in sync.
"""

from __future__ import annotations

import inspect
import json
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping
from typing import Any, Union, cast

from openinference.semconv import trace
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

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


def nest_span_attributes(attributes: Mapping[str, Any]) -> dict[str, Any]:
    """Turn flattened span attributes into the nested shape of the legacy dataframe export."""
    return _unflatten(_load_json_strings(attributes.items()))


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


__all__ = ["nest_span_attributes"]
