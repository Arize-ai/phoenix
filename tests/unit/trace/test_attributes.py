import random
from collections.abc import Mapping
from typing import Any

import pytest

from phoenix.trace.attributes import get_attribute_value, unflatten


@pytest.mark.parametrize(
    "mapping,key,expected",
    [
        ({}, "a.b.c", None),
        ({"a": "b"}, "a", "b"),
        ({"a": "b"}, "a.b", None),
        ({"a": "b"}, "a.b.c", None),
        ({"a": {"b": "c", "d": "e"}}, "a", {"b": "c", "d": "e"}),
        ({"a": {"b": "c", "d": "e"}}, "a.b", "c"),
        ({"a": {"b": "c", "d": "e"}}, "a.b.c", None),
        ({"a": {"b": {"c": "d"}}}, "a", {"b": {"c": "d"}}),
        ({"a": {"b": {"c": "d"}}}, "a.b", {"c": "d"}),
        ({"a": {"b": {"c": "d"}}}, "a.b.c", "d"),
        ({"a": {"bb": {"c": "d"}}}, "a.b.c", None),
        ("{}", "a.b.c", None),
        ({"a": {"b": "c"}}, "", None),
        ({"a": {"b": "c"}}, ".", None),
        ({"a": {"b": "c"}}, "a.", None),
        ({"a": {"b": "c"}}, "..", None),
        ({"a": {"b": "c"}}, "a..", None),
    ],
)
def test_get_attribute_value(
    mapping: Mapping[str, Any],
    key: str,
    expected: Any,
) -> None:
    assert get_attribute_value(mapping, key) == expected


@pytest.mark.parametrize(
    "key_value_pairs,desired",
    [
        (
            (
                ("retrieval.documents.1.document.content", "bcd"),
                ("llm.token_count.prompt", 10),
                ("retrieval.documents.3.document.score", 345),
                ("input.value", "xyz"),
                ("retrieval.documents.0.document.content", "abc"),
                ("llm.token_count.completion", 20),
                ("retrieval.documents.1.document.score", 432),
                ("output.value", "zyx"),
                ("retrieval.documents.2.document.content", "cde"),
                ("metadata", {"a.b.c": 123, "1.2.3": "abc"}),
                ("retrieval.documents.0.document.score", 321),
            ),
            {
                "input": {"value": "xyz"},
                "output": {"value": "zyx"},
                "metadata": {"a.b.c": 123, "1.2.3": "abc"},
                "llm": {"token_count": {"prompt": 10, "completion": 20}},
                "retrieval": {
                    "documents": [
                        {"document": {"content": "abc", "score": 321}},
                        {"document": {"content": "bcd", "score": 432}},
                        {"document": {"content": "cde"}},
                        {"document": {"score": 345}},
                    ]
                },
            },
        ),
        ((), {}),
        ((("1", 0),), {"1": 0}),
        ((("1.2", 0),), {"1": {"2": 0}}),
        ((("1.0.2", 0),), {"1": [{"2": 0}]}),
        ((("1.0.2.3", 0),), {"1": [{"2": {"3": 0}}]}),
        ((("1.0.2.0.3", 0),), {"1": [{"2": [{"3": 0}]}]}),
        ((("1.0.2.0.3.4", 0),), {"1": [{"2": [{"3": {"4": 0}}]}]}),
        ((("1.0.2.0.3.0.4", 0),), {"1": [{"2": [{"3": [{"4": 0}]}]}]}),
        ((("1.2", 1), ("1", 0)), {"1": 0, "1.2": 1}),
        ((("1.2.3", 1), ("1", 0)), {"1": 0, "1.2": {"3": 1}}),
        ((("1.2.3", 1), ("1.2", 0)), {"1": {"2": 0, "2.3": 1}}),
        ((("1.2.0.3", 1), ("1", 0)), {"1": 0, "1.2": [{"3": 1}]}),
        ((("1.2.3.4", 1), ("1.2", 0)), {"1": {"2": 0, "2.3": {"4": 1}}}),
        ((("1.0.2.3", 1), ("1.0.2", 0)), {"1": [{"2": 0, "2.3": 1}]}),
        ((("1.2.0.3.4", 1), ("1", 0)), {"1": 0, "1.2": [{"3": {"4": 1}}]}),
        ((("1.2.3.0.4", 1), ("1.2", 0)), {"1": {"2": 0, "2.3": [{"4": 1}]}}),
        ((("1.0.2.3.4", 1), ("1.0.2", 0)), {"1": [{"2": 0, "2.3": {"4": 1}}]}),
        ((("1.0.2.3.4", 1), ("1.0.2.3", 0)), {"1": [{"2": {"3": 0, "3.4": 1}}]}),
        ((("1.2.0.3.0.4", 1), ("1", 0)), {"1": 0, "1.2": [{"3": [{"4": 1}]}]}),
        ((("1.2.3.0.4.5", 1), ("1.2", 0)), {"1": {"2": 0, "2.3": [{"4": {"5": 1}}]}}),
        ((("1.0.2.3.0.4", 1), ("1.0.2", 0)), {"1": [{"2": 0, "2.3": [{"4": 1}]}]}),
        (
            (("1.0.2.3.4.5", 1), ("1.0.2.3", 0)),
            {"1": [{"2": {"3": 0, "3.4": {"5": 1}}}]},
        ),
        ((("1.0.2.0.3.4", 1), ("1.0.2.0.3", 0)), {"1": [{"2": [{"3": 0, "3.4": 1}]}]}),
        ((("1.2.0.3.0.4.5", 1), ("1", 0)), {"1": 0, "1.2": [{"3": [{"4": {"5": 1}}]}]}),
        (
            (("1.2.3.0.4.0.5", 1), ("1.2", 0)),
            {"1": {"2": 0, "2.3": [{"4": [{"5": 1}]}]}},
        ),
        (
            (("1.0.2.3.0.4.5", 1), ("1.0.2", 0)),
            {"1": [{"2": 0, "2.3": [{"4": {"5": 1}}]}]},
        ),
        (
            (("1.0.2.3.4.0.5", 1), ("1.0.2.3", 0)),
            {"1": [{"2": {"3": 0, "3.4": [{"5": 1}]}}]},
        ),
        (
            (("1.0.2.0.3.4.5", 1), ("1.0.2.0.3", 0)),
            {"1": [{"2": [{"3": 0, "3.4": {"5": 1}}]}]},
        ),
        (
            (("1.0.2.0.3.4.5", 1), ("1.0.2.0.3.4", 0)),
            {"1": [{"2": [{"3": {"4": 0, "4.5": 1}}]}]},
        ),
        (
            (("1.0.2.3.4.5.6", 2), ("1.0.2.3.4", 1), ("1.0.2", 0)),
            {"1": [{"2": 0, "2.3": {"4": 1, "4.5": {"6": 2}}}]},
        ),
        (
            (("0.0.0.0.0", 4), ("0.0.0.0", 3), ("0.0.0", 2), ("0.0", 1), ("0", 0)),
            {"0": 0, "0.0": 1, "0.0.0": 2, "0.0.0.0": 3, "0.0.0.0.0": 4},
        ),
        (
            (("a.9999999.c", 2), ("a.9999999.b", 1), ("a.99999.b", 0)),
            {"a": [{"b": 0}, {"b": 1, "c": 2}]},
        ),
        ((("a", 0), ("c", 2), ("b", 1), ("d", 3)), {"a": 0, "b": 1, "c": 2, "d": 3}),
        (
            (("a.b.c", 0), ("a.e", 2), ("a.b.d", 1), ("f", 3)),
            {"a": {"b": {"c": 0, "d": 1}, "e": 2}, "f": 3},
        ),
        (
            (("a.1.d", 3), ("a.0.d", 2), ("a.0.c", 1), ("a.b", 0)),
            {"a.b": 0, "a": [{"c": 1, "d": 2}, {"d": 3}]},
        ),
        (
            (("a.0.d", 3), ("a.0.c", 2), ("a.b", 1), ("a", 0)),
            {"a": 0, "a.b": 1, "a.0": {"c": 2, "d": 3}},
        ),
        (
            (("a.0.1.d", 3), ("a.0.0.c", 2), ("a", 1), ("a.b", 0)),
            {"a.b": 0, "a": 1, "a.0": [{"c": 2}, {"d": 3}]},
        ),
        (
            (("a.1.0.e", 3), ("a.0.0.d", 2), ("a.0.0.c", 1), ("a.b", 0)),
            {"a.b": 0, "a": [{"0": {"c": 1, "d": 2}}, {"0": {"e": 3}}]},
        ),
        (
            (("a.b.1.e.0.f", 2), ("a.b.0.c", 0), ("a.b.0.d.e.0.f", 1)),
            {"a": {"b": [{"c": 0, "d": {"e": [{"f": 1}]}}, {"e": [{"f": 2}]}]}},
        ),
    ],
)
def test_unflatten(key_value_pairs: tuple[tuple[str, Any], ...], desired: dict[str, Any]) -> None:
    actual = dict(unflatten(key_value_pairs))
    assert actual == desired
    actual = dict(unflatten(reversed(key_value_pairs)))
    assert actual == desired


@pytest.mark.parametrize(
    "separator,key_value_pairs,desired",
    [
        ("#", (("1#2#3", 1), ("1", 0)), {"1": 0, "1#2": {"3": 1}}),
        (
            "$$",
            (("1$$0$$2$$3$$0$$4$$5", 1), ("1$$0$$2", 0)),
            {"1": [{"2": 0, "2$$3": [{"4": {"5": 1}}]}]},
        ),
        (
            "!!!",
            (("1!!!0!!!2!!!0!!!3!!!4!!!5", 1), ("1!!!0!!!2!!!0!!!3!!!4", 0)),
            {"1": [{"2": [{"3": {"4": 0, "4!!!5": 1}}]}]},
        ),
    ],
)
def test_unflatten_separator(
    separator: str,
    key_value_pairs: tuple[tuple[str, Any], ...],
    desired: dict[str, Any],
) -> None:
    actual = dict(unflatten(key_value_pairs, separator=separator))
    assert actual == desired
    actual = dict(unflatten(reversed(key_value_pairs), separator=separator))
    assert actual == desired


@pytest.mark.parametrize(
    "key_value_pairs,expected,order_dependent",
    [
        # Basic mixed flattened/unflattened
        pytest.param(
            [
                ("a.b.c", 1),
                ("x", {"y": {"z": 2}}),
                ("p.q", 3),
                ("m", {"n": 4}),
                ("items.0.name", "first"),
                ("items.1.name", "second"),
                ("tags", ["foo", "bar"]),
                ("nested.0.id", 100),
                ("nested.0.status", "active"),
            ],
            {
                "a": {"b": {"c": 1}},
                "x": {"y": {"z": 2}},
                "p": {"q": 3},
                "m": {"n": 4},
                "items": [{"name": "first"}, {"name": "second"}],
                "tags": ["foo", "bar"],
                "nested": [{"id": 100, "status": "active"}],
            },
            False,  # order-independent
            id="basic_mixed_flattened_and_unflattened",
        ),
        # Conflict resolution - flattened vs unflattened
        pytest.param(
            [
                ("a", {"b": 1}),
                ("a.c", 2),  # compatible extension (different key)
            ],
            {
                "a": {"b": 1},  # nested value preserved
                "a.c": 2,  # extension becomes dotted key (normalizes on round-trip)
            },
            False,  # order-dependent: False
            id="nested_dict_extended_with_compatible_flattened_key",
        ),
        pytest.param(
            [
                ("a", {"b": {"c": 1, "d": 2}, "e": 3}),
                ("a.f.g", 4),
                ("a.h.i.j", 5),
                ("a.k", 6),
            ],
            {
                "a": {"b": {"c": 1, "d": 2}, "e": 3},  # complex nested value preserved
                "a.f": {"g": 4},  # various depth extensions become dotted keys
                "a.h": {"i": {"j": 5}},
                "a.k": 6,
            },
            False,  # order-dependent: False
            id="complex_nested_dict_with_mixed_depth_extensions",
        ),
        pytest.param(
            [
                ("x.y", {"a": 1}),
                ("x.y.b", 2),
                ("x.z", 3),
            ],
            {
                "x": {
                    "y": {"a": 1},
                    "y.b": 2,
                    "z": 3,
                },  # when nested value is from flattened key, extensions merge properly
            },
            False,  # order-dependent: False
            id="nested_at_depth_with_compatible_extensions",
        ),
        pytest.param(
            [
                ("root", {"a": {"b": 1}, "c": {"d": 2}}),
                ("root.a.e", 3),
                ("root.c.f", 4),
                ("root.g", 5),
            ],
            {
                "root": {"a": {"b": 1}, "c": {"d": 2}},  # complex structure preserved
                "root.a": {"e": 3},  # extensions at various levels become dotted keys
                "root.c": {"f": 4},
                "root.g": 5,
            },
            False,  # order-dependent: False
            id="multi_branch_nested_dict_with_extensions_at_various_levels",
        ),
        pytest.param(
            [
                ("a", {"b": 1}),
                ("a.b", 2),  # conflicts with nested value
            ],
            {
                "a": {"b": 1},  # nested value preserved
                "a.b": 2,  # flattened key becomes separate dotted key!
            },
            False,  # order-dependent: False
            id="conflict_nested_value_and_flattened_key",
        ),
        pytest.param(
            [
                ("a.b.c", 1),
                ("a", {"b": {"d": 2}}),  # partial overlap at same level
            ],
            {
                "a": {"b": {"d": 2}},  # nested value preserved
                "a.b": {"c": 1},  # flattened key becomes partial dotted key!
            },
            False,  # order-dependent: False
            id="partial_overlap_flattened_and_nested",
        ),
        pytest.param(
            [
                ("a", {"b": {"c": 1}}),
                ("a.b.d", 2),  # tries to extend nested structure
            ],
            {
                "a": {"b": {"c": 1}},  # nested value preserved
                "a.b": {"d": 2},  # flattened key becomes partial dotted key!
            },
            False,  # order-dependent: False
            id="attempt_extend_nested_value_creates_separate_key",
        ),
        pytest.param(
            [
                ("a.b", 1),
                ("a", {"b": {"c": 2}}),  # nested value has deeper structure
            ],
            {
                "a": {"b": {"c": 2}},  # nested dict preserved
                "a.b": 1,  # flattened key becomes separate dotted key!
            },
            False,  # order-dependent: False
            id="deeper_nested_value_and_scalar_coexist",
        ),
        pytest.param(
            [
                ("a.0.b", 1),  # creates array
                ("a", [{"b": 2}]),  # unflattened array value
            ],
            {
                "a": [{"b": 2}],  # unflattened array preserved
                "a.0": {"b": 1},  # flattened becomes partial dotted key!
            },
            False,  # order-dependent: False
            id="unflattened_array_and_flattened_array_coexist",
        ),
        pytest.param(
            [
                ("x.y", {"z": 1}),  # flattened key with nested value
                ("x", {"y": {"z": 2}}),  # fully unflattened
            ],
            {
                "x": {"y": {"z": 2}},  # unflattened value preserved
                "x.y": {"z": 1},  # nested value in flattened key becomes dotted key!
            },
            False,  # order-dependent: False
            id="nested_value_in_flattened_key_coexists",
        ),
        # None value handling
        pytest.param(
            [
                ("a", None),
                ("a.b", 1),
            ],
            {
                "a": {"b": 1},  # None is ignored
            },
            False,  # order-dependent: False
            id="none_value_is_skipped",
        ),
        pytest.param(
            [
                ("a.b", 1),
                ("a", None),  # None doesn't clobber
            ],
            {
                "a": {"b": 1},  # None is ignored, previous value preserved
            },
            False,  # order-dependent: False
            id="none_value_does_not_clobber",
        ),
        # Array vs dict behavior - numeric keys to scalars create dicts
        pytest.param(
            [
                ("arr.0", "first"),
                ("arr.2", "third"),
                ("arr.5", "sixth"),
            ],
            {
                "arr": {"0": "first", "2": "third", "5": "sixth"},
            },
            False,  # order-dependent: False
            id="numeric_keys_to_scalars_create_dict",
        ),
        # Array vs dict behavior - double indexing and nested numeric keys
        pytest.param(
            [
                ("items.0.0.name", "nested"),
                ("items.0.1.name", "array"),
                ("items.1.0.name", "second"),
            ],
            {
                "items": [
                    {"0": {"name": "nested"}, "1": {"name": "array"}},
                    {"0": {"name": "second"}},
                ]
            },
            False,  # order-dependent: False
            id="double_numeric_keys_inner_becomes_dict_keys",
        ),
        # Mixed numeric and non-numeric keys
        pytest.param(
            [
                ("a.0", "array_element"),
                ("a.b", "dict_value"),
            ],
            {
                "a": {"0": "array_element", "b": "dict_value"},
            },
            False,  # order-dependent: False
            id="mixed_numeric_and_non_numeric_keys_both_scalars",
        ),
        pytest.param(
            [
                ("items.0.tags.0", "tag1"),
                ("items.0.tags.1", "tag2"),
                ("items.0.name", "item1"),
                ("items.1.tags.0", "tag3"),
            ],
            {
                "items": [
                    {"name": "item1", "tags": {"0": "tag1", "1": "tag2"}},
                    {"tags": {"0": "tag3"}},
                ]
            },
            False,  # order-dependent: False
            id="nested_numeric_to_scalar_becomes_string_key",
        ),
        # Unflattened array conflicts
        pytest.param(
            [
                ("list.0", [1, 2, 3]),
                ("list.1.a", "value"),
            ],
            {
                "list": [{"a": "value"}],
                "list.0": [1, 2, 3],
            },
            False,  # order-dependent: False
            id="unflattened_array_value_conflicts_with_flattened_array",
        ),
        # Sequential numeric indices to mappings create real arrays
        pytest.param(
            [
                ("data.0.items.0.value", "a"),
                ("data.0.items.1.value", "b"),
                ("data.1.items.0.value", "c"),
            ],
            {
                "data": [
                    {"items": [{"value": "a"}, {"value": "b"}]},
                    {"items": [{"value": "c"}]},
                ]
            },
            False,  # order-dependent: False
            id="numeric_keys_to_mappings_create_arrays",
        ),
        # Special keys and normalization
        pytest.param(
            [
                ("a.00", "value1"),
                ("a.0", "value2"),
            ],
            {
                "a": {"0": "value2"},
            },
            True,  # order-dependent: True (both normalize to same key, last write wins)
            id="leading_zeros_normalized_to_same_key",
        ),
        pytest.param(
            [
                ("a.-1", "negative"),
                ("a.-0", "negative_zero"),
            ],
            {
                "a": {"-0": "negative_zero", "-1": "negative"},
            },
            False,  # order-dependent: False
            id="negative_numbers_are_not_array_indices",
        ),
        pytest.param(
            [
                ("a.0a", "mixed"),
                ("a.1x", "alpha"),
            ],
            {
                "a": {"0a": "mixed", "1x": "alpha"},
            },
            False,  # order-dependent: False
            id="alphanumeric_keys_not_treated_as_indices",
        ),
        # Other edge cases - empty values, duplicates, deep nesting, special characters
        pytest.param(
            [
                ("a.b", {}),
                ("x.y", []),
            ],
            {
                "a": {"b": {}},
                "x": {"y": []},
            },
            False,  # order-dependent: False
            id="empty_dict_and_list_values_preserved",
        ),
        pytest.param(
            [
                ("a.0.b", 1),
                ("a.0.b", 2),
            ],
            {
                "a": [{"b": 2}],
            },
            True,  # order-dependent: True
            id="duplicate_keys_last_write_wins",
        ),
        pytest.param(
            [
                ("a.0.b.c.d.e.f.g.h.i.j.k", "deep"),
            ],
            {"a": [{"b": {"c": {"d": {"e": {"f": {"g": {"h": {"i": {"j": {"k": "deep"}}}}}}}}}}]},
            False,  # order-dependent: False
            id="very_deep_nesting",
        ),
        pytest.param(
            [
                ("", "empty_key"),
            ],
            {
                "": "empty_key",
            },
            False,  # order-dependent: False
            id="empty_string_key",
        ),
        pytest.param(
            [
                ("a..b", "double_dot"),
            ],
            {
                "a": {"b": "double_dot"},
            },
            False,  # order-dependent: False
            id="consecutive_dots_empty_string_ignored",
        ),
        pytest.param(
            [
                ("a.0", "first"),
                ("a.0.x", "extended"),
            ],
            {
                "a": {"0": "first", "0.x": "extended"},
            },
            False,  # order-dependent: False
            id="numeric_key_reused_for_scalar_and_mapping",
        ),
        # Extending specific array elements
        pytest.param(
            [
                ("a", [{"b": 1}, {"c": 2}]),
                ("a.0.d", 3),
            ],
            {
                "a": [{"b": 1}, {"c": 2}],
                "a.0": {"d": 3},
            },
            False,  # order-dependent: False
            id="cannot_extend_unflattened_array_elements",
        ),
        # Array indices are always sorted
        pytest.param(
            [
                ("items.2.name", "third"),
                ("items.0.name", "first"),
                ("items.1.name", "second"),
            ],
            {
                "items": [{"name": "first"}, {"name": "second"}, {"name": "third"}],
            },
            False,  # order-dependent: False
            id="array_indices_sorted_regardless_of_input_order",
        ),
        # Deep conflicts
        pytest.param(
            [
                ("a.b.c.d", {"e": 1}),
                ("a.b.c.d.e", 2),
            ],
            {
                "a": {
                    "b": {"c": {"d": {"e": 1}, "d.e": 2}}
                },  # dotted key created at conflict level!
            },
            False,  # order-dependent: False
            id="conflict_at_depth_4_creates_dotted_key_at_parent",
        ),
        # Unicode and special characters in keys
        pytest.param(
            [
                ("emoji.😀", "happy"),
                ("中文.key", "chinese"),
                ("spaced key.value", "works"),
            ],
            {
                "emoji": {"😀": "happy"},
                "中文": {"key": "chinese"},
                "spaced key": {"value": "works"},
            },
            False,  # order-dependent: False
            id="unicode_and_special_chars_in_keys",
        ),
        # Each dot-separated segment evaluated independently
        pytest.param(
            [
                ("a.1.5", "looks_like_float"),
                ("b.0.0", "multiple_dots"),
            ],
            {
                "a": [
                    {"5": "looks_like_float"}
                ],  # "1" has suffix → array, "5" is terminal → dict key
                "b": [{"0": "multiple_dots"}],  # "0" has suffix → array, "0" is terminal → dict key
            },
            False,  # order-dependent: False
            id="each_segment_evaluated_independently",
        ),
        # Mixing list and dict at same key
        pytest.param(
            [
                ("a", [1, 2, 3]),
                ("a", {"b": 1}),
            ],
            {
                "a": {"b": 1},
            },
            True,  # order-dependent: True (last write wins)
            id="list_then_dict_at_same_key_last_write_wins",
        ),
        pytest.param(
            [
                ("a", {"b": 1}),
                ("a", [1, 2, 3]),
            ],
            {
                "a": [1, 2, 3],
            },
            True,  # order-dependent: True (last write wins)
            id="dict_then_list_at_same_key_last_write_wins",
        ),
        # Numeric keys mixed throughout path
        pytest.param(
            [
                ("a.0.b.1.c.2.d", "nested_mixed"),
            ],
            {
                "a": [
                    {"b": [{"c": [{"d": "nested_mixed"}]}]}
                ],  # each numeric with suffix creates nested array!
            },
            False,  # order-dependent: False
            id="alternating_numeric_and_string_keys_create_nested_arrays",
        ),
        # Boolean and other types as values
        pytest.param(
            [
                ("bool.true", True),
                ("bool.false", False),
                ("float.value", 3.14),
                ("int.value", 42),
            ],
            {
                "bool": {"true": True, "false": False},
                "float": {"value": 3.14},
                "int": {"value": 42},
            },
            False,  # order-dependent: False
            id="primitive_types_as_values",
        ),
        # Whitespace in keys
        pytest.param(
            [
                (" leading.space", 1),
                ("trailing.space ", 2),
                ("  both  .  spaces  ", 3),
            ],
            {
                "leading": {"space": 1},
                "trailing": {"space": 2},
                "both": {"spaces": 3},
            },
            False,  # order-dependent: False
            id="whitespace_stripped_from_keys",
        ),
        # Sparse array with terminal value behavior
        pytest.param(
            [
                ("arr", [{"x": 1}]),
                ("arr.5.y", 2),
            ],
            {
                "arr": [{"x": 1}],
                "arr.5": {"y": 2},
            },
            False,  # order-dependent: False
            id="sparse_array_extension_creates_dotted_key",
        ),
        # Multiple sequential numeric keys
        pytest.param(
            [
                ("a.0.0.x", 1),
                ("a.0.1.x", 2),
                ("a.1.0.x", 3),
            ],
            {
                "a": [{"0": {"x": 1}, "1": {"x": 2}}, {"0": {"x": 3}}],
            },
            False,  # order-dependent: False
            id="double_numeric_indexing_with_mappings",
        ),
    ],
)
def test_unflatten_edge_cases(
    key_value_pairs: list[tuple[str, Any]],
    expected: dict[str, Any],
    order_dependent: bool,
) -> None:
    """
    Test comprehensive edge cases for OpenTelemetry span attribute unflattening.

    This test suite documents the specific behaviors of the unflatten algorithm
    designed for OpenTelemetry semantic conventions. Each test case demonstrates
    how the algorithm handles real-world scenarios encountered during span ingestion.

    The `order_dependent` parameter indicates whether the test output depends on
    input order. When False, the test will also verify that a randomly shuffled
    version of the input produces the same output, eliminating the need for
    explicit order-reversal test cases.

    Test Categories:
    ----------------

    1. Basic Mixed Flattened/Unflattened
       - How pre-nested values (from OTEL data model) combine with dot-separated keys
       - Tests realistic mixed input from OpenTelemetry protobuf ingestion

    2. Terminal Value Node Behavior
       - Once a node has a value set (via unflattened dict), it becomes terminal
       - Subsequent extensions to that path via flattened keys cannot add children
       - Instead, they become dotted keys at the conflict's parent level
       - Includes: compatible extensions (width & depth), actual conflicts, partial overlaps
       - Covers both conflicting values and non-conflicting extensions at same paths

    3. None Value Handling
       - None values are skipped entirely to avoid polluting the attribute tree
       - Order-independent: None before or after doesn't matter

    4. Array Creation Rules
       - Numeric keys create arrays ONLY when: (a) they have suffix, (b) lead to mappings
       - Scalar values: numeric keys become string dict keys
       - Out-of-order: arrays are always sorted by index
       - Nested arrays: Multiple numeric segments create nested arrays (e.g., a.0.b.1 → arrays at both levels)
       - Float-like keys: Each segment evaluated independently (1.5 → two segments)

    5. Mixed Numeric/Non-Numeric Keys
       - Mixing numeric and string keys at same level creates dict (not array)
       - Nested numeric-to-scalar becomes string dict keys

    6. Unflattened Array Handling
       - Cannot extend specific elements of unflattened arrays (terminal value behavior)
       - Array conflicts result in dotted keys
       - Sparse array extensions also create dotted keys

    7. Special Keys & Normalization
       - Leading zeros: Normalized (00 → 0)
       - Negative numbers: Treated as string keys, not array indices
       - Alphanumeric: "0a", "1x" are string keys
       - Unicode: Full support (emoji, Chinese characters, etc.)
       - Whitespace: Stripped from key segments
       - Empty string: Valid key, preserved

    8. Deep Nesting & Complex Structures
       - Very deep nesting works correctly
       - Multi-branch extensions at various levels
       - Deep conflicts create local dotted keys (at parent, not root!)
       - Alternating numeric/string keys create nested arrays
       - Double sequential numeric keys (inner becomes dict)

    9. Type Handling
       - Empty dicts and lists preserved
       - Various primitive types (bool, float, int) work correctly
       - Mixing list and dict at same key: last write wins
       - Duplicate keys: last write wins

    10. Malformed Keys
        - Consecutive dots: Empty segments ignored
        - Scalar then mapping at same numeric key: both become dict keys
        - Order independence: results consistent regardless of input order

    Key Behaviors Documented:
    -------------------------
    - Nested arrays: Multiple numeric segments in path (a.0.b.1) create nested arrays
    - Local dotted keys: Conflicts create dotted keys at their parent level, not globally
    - Per-segment evaluation: Each path segment independently evaluated for array rule
    - Terminal node mechanism: Value assignment blocks subsequent child branches
    - Unicode support: Full UTF-8 support with no special handling needed
    - Deterministic sorting: Arrays always sorted by index, regardless of input order

    Relevance to OpenTelemetry Span Ingestion:
    -------------------------------------------
    - Terminal value behavior preserves all data via dotted keys
    - Array creation limited to structured data (matches OTEL semantic conventions)
    - Handles malformed keys, unicode, and whitespace without errors
    - Order-independent results provide deterministic output
    - Compatible with mixed flattened/nested inputs from various sources
    - Most cases normalize to proper nested structure on flatten→unflatten cycles
    """
    result = dict(unflatten(key_value_pairs))
    assert result == expected
    if order_dependent:
        return
    # If order-independent, verify that a randomly shuffled input produces the same output
    reversed_result = dict(unflatten(reversed(key_value_pairs)))
    assert reversed_result == expected
    shuffled = list(key_value_pairs)
    random.shuffle(shuffled)
    shuffled_result = dict(unflatten(shuffled))
    assert shuffled_result == expected
