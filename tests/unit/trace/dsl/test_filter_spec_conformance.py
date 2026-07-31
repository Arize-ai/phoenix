"""Pins the grammar documented in `internal_docs/specs/span-filter-dsl.md`.

These are not behavioral tests -- `test_filter.py` covers behavior. They exist so
the spec cannot drift from the code silently. Filter conditions are becoming
persisted data, which makes the accepted grammar a compatibility surface: every
stored row is an expression a future parser has to keep accepting with unchanged
meaning.

A failure here means one of two things, and the difference matters:

- **Something was added.** Additions are backward compatible. Update the spec.
- **Something was restricted.** Previously-valid stored conditions will stop
  parsing. That needs a migration story and a grammar-version bump, not just a
  spec edit. See the Persistence Contract section of the spec.
"""

import pytest

from phoenix.trace.dsl.filter import SpanFilter, root_span_scope

# Every form the spec documents as accepted.
ACCEPTED = [
    # expression forms
    "latency_ms > 100",
    "0.5 < latency_ms < 1000",
    "name == 'a' and status_code == 'b'",
    "not (name == 'a')",
    "annotations['quality']",
    "name == 'x' and True",
    "name == 'x' or False",
    # field names, by declared type
    "span_id == 'x'",
    "trace_id == 'x'",
    "parent_id == 'x'",
    "span_kind == 'LLM'",
    "name == 'x'",
    "status_code == 'OK'",
    "status_message == 'x'",
    "latency_ms > 1",
    "cumulative_llm_token_count_prompt > 1",
    "cumulative_llm_token_count_completion > 1",
    "cumulative_llm_token_count_total > 1",
    "start_time > '2024-01-01T00:00:00Z'",
    "end_time > '2024-01-01T00:00:00Z'",
    "llm.token_count.prompt > 1",
    "llm.token_count.completion > 1",
    "llm.token_count.total > 1",
    # backward-compatibility aliases: removing any of these breaks stored rows
    "context.span_id == 'x'",
    "context.trace_id == 'x'",
    "cumulative_token_count.prompt > 1",
    "cumulative_token_count.completion > 1",
    "cumulative_token_count.total > 1",
    # attribute access, all equivalent spellings
    "llm.model_name == 'gpt-4'",
    "attributes['llm']['model_name'] == 'gpt-4'",
    "attributes[['llm', 'model_name']] == 'gpt-4'",
    "attributes['llm'][['model_name']] == 'gpt-4'",
    "metadata['k'] == 'v'",
    "attributes['arr'][0] == 1",
    "attributes['parent_span'] == 'x'",
    # annotations
    "annotations['n'].score > 1",
    "annotations['n'].label == 'x'",
    "'a' in annotations['n'].explanation",
    "evals['n'].score > 1",
    "name == 'x' and annotations['n']",
    # reserved keyword, in its only supported forms
    "parent_span is None",
    "parent_span is not None",
    "parent_span == None",
    "parent_span != None",
    # literals
    "latency_ms == None",
    "start_time > '2024-01-01T00:00:00+02:00'",
    "float('100') < latency_ms",
    "float('-12.5') < latency_ms",
    "float('1e3') < latency_ms",
    # operators
    "'x' in output.value",
    "span_kind in ['LLM']",
    "span_kind in ('LLM',)",
    "span_kind not in ['LLM']",
    "parent_id is not None",
    "latency_ms + 1 > 2",
    "latency_ms - 1 > 2",
    "latency_ms * 2 > 2",
    "latency_ms / 2 > 2",
    "latency_ms % 2 == 0",
    "name + status_code == 'ab'",
    "-latency_ms < 0",
    "+latency_ms > 0",
    # casts
    "str(latency_ms) == '1'",
    "float(attributes['x']) > 1",
    "int(attributes['x']) > 1",
]

# Every form the spec documents as rejected, with the reason it documents.
REJECTED = [
    # no implicit numeric coercion
    ("latency_ms > '100'", "cannot compare"),
    ("'100' < latency_ms", "cannot compare"),
    ("annotations['q'].score >= '0.5'", "cannot compare"),
    ("llm.token_count.total > '5'", "cannot compare"),
    ("latency_ms in ['1.5']", "cannot compare"),
    ("annotations['q'].label == 100", "cannot compare"),
    # numeric strings the two backends disagree about
    ("float('1_000') > 1", "cannot cast string to number"),
    ("float('nan') > 1", "cannot cast string to number"),
    ("float('inf') > 1", "cannot cast string to number"),
    # datetime literals must carry an offset
    ("start_time > '2024-01-01T00:00:00'", "no timezone"),
    ("start_time in ['2024-01-01T00:00:00']", "no timezone"),
    ("start_time > 'yesterday'", "invalid datetime literal"),
    # boolean position
    ("name == 'x' and r", "is not a condition"),
    ("name == 'x' and metadata['flag']", "is not a condition"),
    ("name == 'x' and attributes['flag']", "is not a condition"),
    ("not attributes['flag']", "is not a condition"),
    ("name == 'x' or 5", "is not a condition"),
    ("name == 'x' and annotations['q'].score", "is not a condition"),
    ("span_kind", "invalid expression"),
    # membership needs a span field on the left
    ("1 in [1, 2]", "compares two literals"),
    # unsupported operators
    ("latency_ms ** 2 > 10", "invalid arithmetic operator"),
    ("name == 'a' & status_code == 'b'", "invalid arithmetic operator"),
    # reserved keyword misuse
    ("parent_span.name == 'x'", "not supported"),
    ("parent_span == 'LLM'", "can only be compared to None"),
    # calls other than the three casts
    ("len(name) > 1", "invalid expression"),
    ("name.upper() == 'X'", "invalid expression"),
    ("[x for x in name]", "invalid expression"),
    # annotation members
    ("annotations['q'].confidence > 1", "invalid eval attribute"),
]

# The verdicts `root_span_scope` is documented to produce. A stored condition's
# verdict is part of its observable meaning: it decides whether the UI shows
# cumulative or per-span metric columns.
SCOPES = [
    ("parent_id is None", "strict"),
    ("parent_id is None and span_kind == 'LLM'", "strict"),
    ("parent_span is None", "orphan_aware"),
    ("not (parent_span is not None)", "orphan_aware"),
    ("parent_id is not None", None),
    ("parent_id is None or span_kind == 'LLM'", None),
    ("span_kind == 'LLM'", None),
]


# Python constructs with no SQL meaning. This DSL was originally evaluated in
# Python and inherited the whole of Python's literal and operator surface; these
# are the parts that could not survive the move to a SQL backend. They were
# accepted until the final pre-persistence tightening.
#
# Under the additive-only policy these can never be re-admitted *or* further
# restricted once conditions are stored, so a failure here is significant: it
# means the language's shape changed after it was supposed to be fixed.
PYTHON_SURFACE_REJECTED = [
    pytest.param("~latency_ms == 1", "unsupported operator", id="unary-invert"),
    pytest.param("name is 'abc'", "uses `is` with a value", id="is-with-value"),
    pytest.param("latency_ms is 1", "uses `is` with a value", id="is-with-number"),
    pytest.param("name == b'abc'", "unsupported literal", id="bytes-literal"),
    pytest.param("latency_ms == 1j", "unsupported literal", id="complex-literal"),
    pytest.param("name == ...", "unsupported literal", id="ellipsis-literal"),
    pytest.param("latency_ms < 1e400", "invalid numeric literal", id="ieee-infinity"),
    pytest.param("name == ('a', 'b')", "compares against a collection", id="tuple-as-scalar"),
    pytest.param("name in [['a']]", "collections cannot be nested", id="nested-container"),
    # the escape *sequence* in the source text, not a literal NUL byte -- the
    # latter is rejected by Python's own parser
    pytest.param(r"name == 'a\x00b'", "NUL character", id="nul-escape"),
    pytest.param("ｎａｍｅ == 'a'", "is interpreted as", id="nfkc-identifier"),
]

# `is` against the singletons is retained: those are the only values Python's
# `is` is meaningful against, and the only ones SQL can express.
SINGLETON_IDENTITY = [
    pytest.param("parent_id is None", id="is-none"),
    pytest.param("parent_id is not None", id="is-not-none"),
    pytest.param("metadata['flag'] is True", id="is-true"),
    pytest.param("metadata['flag'] is False", id="is-false"),
    pytest.param("metadata['flag'] is not False", id="is-not-false"),
]


@pytest.mark.parametrize("condition", ACCEPTED)
def test_spec_accepted_grammar(condition: str) -> None:
    SpanFilter(condition)  # does not raise


@pytest.mark.parametrize("condition,message", PYTHON_SURFACE_REJECTED)
def test_spec_rejects_inherited_python_surface(condition: str, message: str) -> None:
    with pytest.raises(SyntaxError, match=message):
        SpanFilter(condition)


@pytest.mark.parametrize("condition", SINGLETON_IDENTITY)
def test_spec_retains_singleton_identity(condition: str) -> None:
    SpanFilter(condition)  # does not raise


def test_int_is_an_alias_for_float_and_does_not_truncate() -> None:
    """Documented deliberately rather than fixed: truncation is not portable
    (`CAST(x AS INTEGER)` rounds on PostgreSQL, truncates on SQLite), and the
    name is load-bearing in the SpanQuery surface."""
    import ast as _ast

    from phoenix.trace.dsl.filter import _FilterTranslator

    rendered = _ast.unparse(
        _FilterTranslator().visit(_ast.parse("latency_ms > int(1.9)", mode="eval"))
    )
    assert "1.9" in rendered


def test_surrounding_whitespace_is_tolerated_and_normalized_away() -> None:
    """Widening, not restricting -- Python reads a leading space as indentation
    and fails with `IndentationError`.

    The condition is normalized in place rather than only for parsing, so the
    persisted form is canonical: identity and de-duplication over stored
    conditions are only well defined if two spellings that mean the same thing
    serialize the same way.
    """
    padded = SpanFilter("  name == 'a'  ")
    assert padded.condition == "name == 'a'"
    assert padded.to_dict() == SpanFilter("name == 'a'").to_dict()
    assert SpanFilter.from_dict(padded.to_dict()).to_dict() == padded.to_dict()
    assert not SpanFilter("   ")


def test_field_vocabulary_is_exhaustive() -> None:
    """`_NAMES` is the eval namespace, not the user-facing vocabulary.

    It binds `attributes` and `events` because the compiled expression needs
    them, so reading the documented field list out of it would wrongly suggest
    `events` is a queryable column. A bare `events` is an attribute path like
    any other unknown identifier.
    """
    import ast as _ast

    from phoenix.trace.dsl.filter import _FilterTranslator

    rendered = _ast.unparse(_FilterTranslator().visit(_ast.parse("events == 'x'", mode="eval")))
    assert "attributes[['events']]" in rendered


@pytest.mark.parametrize("condition,message", REJECTED)
def test_spec_rejected_grammar(condition: str, message: str) -> None:
    with pytest.raises(SyntaxError, match=message):
        SpanFilter(condition)


@pytest.mark.parametrize("condition,expected", SCOPES)
def test_spec_root_span_scope(condition: str, expected: str | None) -> None:
    assert root_span_scope(condition) == expected


def test_condition_round_trips_through_serialization() -> None:
    """The condition *string* is the persisted artifact -- never a parsed or
    compiled form, both of which change between releases."""
    condition = "annotations['q'].score > 0.5 and span_kind == 'LLM'"
    assert SpanFilter.from_dict(SpanFilter(condition).to_dict()).condition == condition
