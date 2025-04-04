from typing import Any, Dict

import pytest

from phoenix.client.types.spans import (
    Concatenation,
    Explosion,
    Projection,
    SpanFilter,
    SpanQuery,
)
from phoenix.trace.dsl import SpanQuery as PhoenixSpanQuery


def assert_dict_equivalence(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> None:
    """Helper function to compare dictionaries recursively."""
    assert dict1.keys() == dict2.keys()
    for key in dict1:
        if isinstance(dict1[key], dict):
            assert_dict_equivalence(dict1[key], dict2[key])
        else:
            assert dict1[key] == dict2[key]


def test_basic_query_equivalence() -> None:
    """Test that basic queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().select("span_id", "trace_id")

    # Client wrapper
    client_query = SpanQuery().select_fields("span_id", "trace_id")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_filter_query_equivalence() -> None:
    """Test that filter queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().where("span_id == '123'")

    # Client wrapper
    client_query = SpanQuery().where("span_id == '123'")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_explode_query_equivalence() -> None:
    """Test that explode queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().explode("attributes")

    # Client wrapper
    client_query = SpanQuery().explode_field("attributes")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_concat_query_equivalence() -> None:
    """Test that concatenation queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().concat("messages")

    # Client wrapper
    client_query = SpanQuery().concat_field("messages")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_rename_query_equivalence() -> None:
    """Test that rename queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().rename(old_name="new_name")

    # Client wrapper
    client_query = SpanQuery().rename_fields(old_name="new_name")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_index_query_equivalence() -> None:
    """Test that index queries produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = PhoenixSpanQuery().with_index("span_id")

    # Client wrapper
    client_query = SpanQuery().with_index("span_id")

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_complex_query_equivalence() -> None:
    """Test that complex queries with multiple operations produce equivalent dictionaries."""
    # Phoenix DSL
    phoenix_query = (
        PhoenixSpanQuery()
        .select("span_id", "trace_id")
        .where("span_id == '123'")
        .explode("attributes")
        .concat("messages")
        .rename(old_name="new_name")
        .with_index("span_id")
    )

    # Client wrapper
    client_query = (
        SpanQuery()
        .select_fields("span_id", "trace_id")
        .where("span_id == '123'")
        .explode_field("attributes")
        .concat_field("messages")
        .rename_fields(old_name="new_name")
        .with_index("span_id")
    )

    # Convert to dictionaries and compare
    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_backward_compatibility() -> None:
    """Test that backward compatibility field names are handled correctly."""
    # Test with old field names
    query = SpanQuery().select_fields(
        "context.span_id",
        "context.trace_id",
        "cumulative_token_count.completion",
    )

    # The query should internally convert to new field names
    assert query.select is not None
    assert "span_id" in query.select
    assert "trace_id" in query.select
    assert "cumulative_llm_token_count_completion" in query.select


def test_empty_key_validation() -> None:
    """Test that empty keys are properly validated."""
    with pytest.raises(ValueError):
        Projection(key="")

    with pytest.raises(ValueError):
        SpanFilter(condition="")

    with pytest.raises(ValueError):
        Explosion(key="")

    with pytest.raises(ValueError):
        Concatenation(key="")
