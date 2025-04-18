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
    assert dict1.keys() == dict2.keys()
    for key in dict1:
        if isinstance(dict1[key], dict):
            assert_dict_equivalence(dict1[key], dict2[key])
        else:
            assert dict1[key] == dict2[key]


def test_basic_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().select("span_id", "trace_id")
    client_query = SpanQuery().select("span_id", "trace_id")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_filter_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().where("span_id == '123'")
    client_query = SpanQuery().where("span_id == '123'")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_explode_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().explode("attributes")
    client_query = SpanQuery().explode("attributes")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_concat_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().concat("messages")
    client_query = SpanQuery().concat("messages")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_rename_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().rename(old_name="new_name")
    client_query = SpanQuery().rename(old_name="new_name")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_index_query_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().with_index("span_id")
    client_query = SpanQuery().with_index("span_id")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_complex_query_equivalence() -> None:
    phoenix_query = (
        PhoenixSpanQuery()
        .select("span_id", "trace_id")
        .where("span_id == '123'")
        .explode("attributes")
        .concat("messages")
        .rename(old_name="new_name")
        .with_index("span_id")
    )
    client_query = (
        SpanQuery()
        .select("span_id", "trace_id")
        .where("span_id == '123'")
        .explode("attributes")
        .concat("messages")
        .rename(old_name="new_name")
        .with_index("span_id")
    )

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_backward_compatibility() -> None:
    query = SpanQuery().select(
        "context.span_id",
        "context.trace_id",
        "cumulative_token_count.completion",
    )

    # The query should internally convert to new field names
    query_dict = query.to_dict()
    assert "select" in query_dict
    select_dict = query_dict["select"]
    assert "span_id" in select_dict
    assert "trace_id" in select_dict
    assert "cumulative_llm_token_count_completion" in select_dict


def test_empty_key_validation() -> None:
    with pytest.raises(ValueError):
        Projection(key="")

    with pytest.raises(ValueError):
        SpanFilter(condition="")

    with pytest.raises(ValueError):
        Explosion(key="")

    with pytest.raises(ValueError):
        Concatenation(key="")


def test_chaining_order_equivalence() -> None:
    q1 = SpanQuery().select("span_id", "trace_id").where("span_id == '123'")
    q2 = SpanQuery().where("span_id == '123'").select("span_id", "trace_id")
    assert_dict_equivalence(q1.to_dict(), q2.to_dict())


def test_default_index_behavior() -> None:
    query = SpanQuery().select("span_id")
    phoenix_query = PhoenixSpanQuery().select("span_id")
    assert_dict_equivalence(query.to_dict(), phoenix_query.to_dict())


def test_explosion_kwargs_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().explode("attributes", arg1="span_id", arg2="some_field")
    client_query = SpanQuery().explode("attributes", arg1="span_id", arg2="some_field")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())


def test_concatenation_kwargs_equivalence() -> None:
    phoenix_query = PhoenixSpanQuery().concat("messages", arg1="span_id", arg2="some_field")
    client_query = SpanQuery().concat("messages", arg1="span_id", arg2="some_field")

    assert_dict_equivalence(phoenix_query.to_dict(), client_query.to_dict())
