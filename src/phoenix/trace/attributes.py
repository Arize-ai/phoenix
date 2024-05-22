"""
Span attribute keys have a special relationship with the `.` separator. When
a span attribute is ingested from protobuf, it's in the form of a key value
pair such as `("llm.token_count.completion", 123)`. What we need to do is to split
the key by the `.` separator and turn it into part of a nested dictionary such
as {"llm": {"token_count": {"completion": 123}}}. We also need to reverse this
process, which is to flatten the nested dictionary into a list of key value
pairs. This module provides functions to do both of these operations.

Note that digit keys are treated as indices of a nested array. For example,
the digits inside `("retrieval.documents.0.document.content", 'A')` and
`("retrieval.documents.1.document.content": 'B')` turn the sub-keys following
them into a nested list of dictionaries i.e.
{`retrieval: {"documents": [{"document": {"content": "A"}}, {"document":
{"content": "B"}}]}`.
"""

import inspect
import json
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
    Tuple,
    Union,
    cast,
)

from openinference.semconv import trace
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from typing_extensions import assert_never

DOCUMENT_METADATA = DocumentAttributes.DOCUMENT_METADATA
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
METADATA = SpanAttributes.METADATA
TOOL_PARAMETERS = SpanAttributes.TOOL_PARAMETERS

# attributes interpreted as JSON strings during ingestion
JSON_STRING_ATTRIBUTES = (
    DOCUMENT_METADATA,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    METADATA,
    TOOL_PARAMETERS,
)

SEMANTIC_CONVENTIONS: List[str] = sorted(
    # e.g. "input.value", "llm.token_count.total", etc.
    (
        cast(str, getattr(klass, attr))
        for name in dir(trace)
        if name.endswith("Attributes") and inspect.isclass(klass := getattr(trace, name))
        for attr in dir(klass)
        if attr.isupper()
    ),
    key=len,
    reverse=True,
)  # sorted so the longer strings go first


def unflatten(
    key_value_pairs: Iterable[Tuple[str, Any]],
    *,
    prefix_exclusions: Sequence[str] = (),
    separator: str = ".",
) -> Dict[str, Any]:
    # `prefix_exclusions` is intended to contain the semantic conventions
    trie = _build_trie(key_value_pairs, separator=separator, prefix_exclusions=prefix_exclusions)
    return dict(_walk(trie, separator=separator))


def flatten(
    obj: Union[Mapping[str, Any], Iterable[Any]],
    *,
    prefix: str = "",
    separator: str = ".",
    recurse_on_sequence: bool = False,
    json_string_attributes: Optional[Sequence[str]] = None,
) -> Iterator[Tuple[str, Any]]:
    """
    Flatten a nested dictionary or a sequence of dictionaries into a list of
    key value pairs. If `recurse_on_sequence` is True, then the function will
    also recursively flatten nested sequences of dictionaries. If
    `json_string_attributes` is provided, then the function will interpret the
    attributes in the list as JSON strings and convert them into dictionaries.
    The `prefix` argument is used to prefix the keys in the output list, but
    it's mostly used internally to facilitate recursion.
    """
    if isinstance(obj, Mapping):
        yield from _flatten_mapping(
            obj,
            prefix=prefix,
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
            separator=separator,
        )
    elif isinstance(obj, Iterable):
        yield from _flatten_sequence(
            obj,
            prefix=prefix,
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
            separator=separator,
        )
    else:
        assert_never(obj)


def has_mapping(sequence: Iterable[Any]) -> bool:
    """
    Check if a sequence contains a dictionary. We don't flatten sequences that
    only contain primitive types, such as strings, integers, etc. Conversely,
    we'll only un-flatten digit sub-keys if it can be interpreted the index of
    an array of dictionaries.
    """
    for item in sequence:
        if isinstance(item, Mapping):
            return True
    return False


def get_attribute_value(
    attributes: Optional[Mapping[str, Any]],
    key: str,
    separator: str = ".",
) -> Optional[Any]:
    """
    Get the value of a nested attribute from a dictionary. The `key` is a
    string that represents the path to the attribute, where each level is
    separated by the `separator`. For example, if the dictionary is
    `{"a": {"b": {"c": 1}}}` and the key is `"a.b.c"`, then the function
    will return `1`. If the key is `"a.b"`, then the function will return
    `{"c": 1}`.
    """
    if not (attributes and isinstance(attributes, dict)):
        return None
    sub_keys = key.split(separator)
    for sub_key in sub_keys[:-1]:
        attributes = attributes.get(sub_key)
        if not (attributes and isinstance(attributes, dict)):
            return None
    return attributes.get(sub_keys[-1])


def load_json_strings(key_values: Iterable[Tuple[str, Any]]) -> Iterator[Tuple[str, Any]]:
    for key, value in key_values:
        if key.endswith(JSON_STRING_ATTRIBUTES):
            try:
                dict_value = json.loads(value)
            except Exception:
                yield key, value
            else:
                if dict_value:
                    yield key, dict_value
        else:
            yield key, value


def _partition_with_prefix_exclusion(
    key: str,
    separator: str = ".",
    prefix_exclusions: Sequence[str] = (),
) -> Tuple[str, str, str]:
    """
    Partition `key` by `separator`, but exclude prefixes in `prefix_exclusions`,
    which is usually the list of semantic conventions. `prefix_exclusions` should
    be sorted by length from the longest to the shortest
    """
    for prefix in prefix_exclusions:
        if key.startswith(prefix) and (
            len(key) == len(prefix) or key[len(prefix) :].startswith(separator)
        ):
            return prefix, separator, key[len(prefix) + len(separator) :]
    return key.partition(separator)


class _Trie(DefaultDict[Union[str, int], "_Trie"]):
    """
    Prefix Tree with special handling for indices (i.e. all-digit keys). Indices
    represent the position of an element in a nested list, while branches represent
    the keys of a nested dictionary.
    """

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


def _build_trie(
    key_value_pairs: Iterable[Tuple[str, Any]],
    *,
    prefix_exclusions: Sequence[str] = (),
    separator: str = ".",
) -> _Trie:
    """
    Build a Trie (a.k.a. prefix tree) from `key_value_pairs`, by partitioning the keys by
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
            prefix, _, suffix = _partition_with_prefix_exclusion(
                key,
                separator,
                prefix_exclusions,
            )
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


def _walk(
    trie: _Trie,
    *,
    prefix: str = "",
    separator: str = ".",
) -> Iterator[Tuple[str, Any]]:
    """
    Walk the Trie and yield key value pairs. If the Trie node has a value, then
    yield the prefix and the value. If the Trie node has indices, then yield the
    prefix and a list of dictionaries. If the Trie node has branches, then yield
    the prefix and a dictionary.
    """
    if trie.value is not None:
        yield prefix, trie.value
    elif prefix and trie.indices:
        yield (
            prefix,
            [dict(_walk(trie[index], separator=separator)) for index in sorted(trie.indices)],
        )
    elif trie.indices:
        for index in trie.indices:
            yield from _walk(trie[index], prefix=f"{index}", separator=separator)
    elif prefix:
        yield prefix, dict(_walk(trie, separator=separator))
        return
    for branch in trie.branches:
        new_prefix = f"{prefix}{separator}{branch}" if prefix else f"{branch}"
        yield from _walk(trie[branch], prefix=new_prefix, separator=separator)


def _flatten_mapping(
    mapping: Mapping[str, Any],
    *,
    prefix: str = "",
    recurse_on_sequence: bool = False,
    json_string_attributes: Optional[Sequence[str]] = None,
    separator: str = ".",
) -> Iterator[Tuple[str, Any]]:
    """
    Flatten a nested dictionary into a list of key value pairs. If `recurse_on_sequence`
    is True, then the function will also recursively flatten nested sequences of dictionaries.
    If `json_string_attributes` is provided, then the function will interpret the attributes
    in the list as JSON strings and convert them into dictionaries. The `prefix` argument is
    used to prefix the keys in the output list, but it's mostly used internally to facilitate
    recursion.
    """
    for key, value in mapping.items():
        prefixed_key = f"{prefix}{separator}{key}" if prefix else key
        if isinstance(value, Mapping):
            if json_string_attributes and prefixed_key.endswith(JSON_STRING_ATTRIBUTES):
                yield prefixed_key, json.dumps(value)
            else:
                yield from _flatten_mapping(
                    value,
                    prefix=prefixed_key,
                    recurse_on_sequence=recurse_on_sequence,
                    json_string_attributes=json_string_attributes,
                    separator=separator,
                )
        elif isinstance(value, Sequence) and recurse_on_sequence:
            yield from _flatten_sequence(
                value,
                prefix=prefixed_key,
                recurse_on_sequence=recurse_on_sequence,
                json_string_attributes=json_string_attributes,
                separator=separator,
            )
        elif value is not None:
            yield prefixed_key, value


def _flatten_sequence(
    sequence: Iterable[Any],
    *,
    prefix: str = "",
    recurse_on_sequence: bool = False,
    json_string_attributes: Optional[Sequence[str]] = None,
    separator: str = ".",
) -> Iterator[Tuple[str, Any]]:
    """
    Flatten a sequence of dictionaries into a list of key value pairs. If `recurse_on_sequence`
    is True, then the function will also recursively flatten nested sequences of dictionaries.
    If `json_string_attributes` is provided, then the function will interpret the attributes
    in the list as JSON strings and convert them into dictionaries. The `prefix` argument is
    used to prefix the keys in the output list, but it's mostly used internally to facilitate
    recursion.
    """
    if isinstance(sequence, str) or not has_mapping(sequence):
        yield prefix, sequence
    for idx, obj in enumerate(sequence):
        if not isinstance(obj, Mapping):
            continue
        yield from _flatten_mapping(
            obj,
            prefix=f"{prefix}{separator}{idx}" if prefix else f"{idx}",
            recurse_on_sequence=recurse_on_sequence,
            json_string_attributes=json_string_attributes,
            separator=separator,
        )
