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
    for item in sequence:
        if isinstance(item, Mapping):
            return True
    return False


def get_attribute_value(
    attributes: Optional[Mapping[str, Any]],
    key: str,
    separator: str = ".",
) -> Optional[Any]:
    if not attributes:
        return None
    sub_keys = key.split(separator)
    for sub_key in sub_keys[:-1]:
        attributes = attributes.get(sub_key)
        if not attributes:
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
    # prefix_exclusions should be sorted by length from the longest to the shortest
    for prefix in prefix_exclusions:
        if key.startswith(prefix) and (
            len(key) == len(prefix) or key[len(prefix) :].startswith(separator)
        ):
            return prefix, separator, key[len(prefix) + len(separator) :]
    return key.partition(separator)


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


def _build_trie(
    key_value_pairs: Iterable[Tuple[str, Any]],
    *,
    prefix_exclusions: Sequence[str] = (),
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
