"""Pins the grammar documented in `internal_docs/specs/span-filter-dsl.md`.

These are not behavioral tests -- `test_filter.py` covers behavior. They exist so
the spec cannot drift from the code silently. Filter conditions are becoming
persisted data, which makes the accepted grammar a compatibility surface: every
stored row is an expression a future parser has to keep accepting with unchanged
meaning.

A failure here means one of two things, and the difference matters:

- **Something was added.** Additions are backward compatible. Update the spec.
- **Something was restricted.** Previously-valid stored conditions will stop
  parsing. Before persistence ships, that is a deliberate tightening the spec
  must record; after, it is forbidden outright -- there is no grammar version
  to bump, by policy -- and the only sanctioned path is the compatibility
  policy's defined-divergence clause, for shapes already enumerated as
  semantically undefined.

This corpus is curated examples, not grammar conformance: it pins the
documented subset and cannot detect newly admitted Python AST shapes.
Exhaustiveness against novel constructs comes from the validator's structural
rules and the catch-all boundary, not from this file.
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
    # `str()` survives only over text and over values whose type is not known
    # until the row is read. Every typed non-string operand renders differently
    # on the two backends; see REJECTED below.
    "str(annotations['q'].label) == 'a'",
    "'b' in str(metadata['k'])",
    "float(attributes['x']) > 1",
    "int(attributes['x']) > 1",
    # ordered comparison between two unknowns is defined (numerically), not rejected
    "attributes['a'] > attributes['b']",
    "metadata['a'] <= metadata['b']",
    # `parent` (unlike `parent_span`) is NOT reserved: it resolves to
    # `attributes['parent']` like any bare identifier. Reserving it later
    # would silently change this condition's meaning -- every new *name* is a
    # breaking change -- so its current meaning is pinned here on purpose.
    "parent == 'x'",
    # `span.<field>` is a reserved root over a closed set of members reading this
    # span's own cost row. Reserving it broke exactly one spelling -- the bare dotted
    # `span.x`, which used to read `attributes['span']['x']` -- taken deliberately.
    # Both subscript spellings survive and are pinned below; they are different keys,
    # and neither is what the break touched.
    "span.total_cost > 0.1",
    "span.prompt_cost + span.completion_cost == span.total_cost",
    "span.total_tokens > 100",
    "span.total_cost_per_token > 0.0001",
    # The root shadows only the dotted spelling. Subscripting `attributes` names the
    # attribute called `span` explicitly and is untouched, and a bare `total_cost` is
    # still an attribute path -- the cost members are reachable only through the root,
    # so no previously-bare name changed meaning.
    "attributes['span'] == 'x'",
    "total_cost > 1",
    # `span.cost_details` iterates the per-token-type rows behind that cost, with the same
    # comprehension vocabulary the session grain uses -- one family, one flavor.
    "any(d.cost > 1 for d in span.cost_details)",
    "all(d.is_prompt for d in span.cost_details)",
    "sum(d.tokens for d in span.cost_details if d.token_type == 'input') > 1000",
    "len([d for d in span.cost_details]) > 2",
    "max(d.cost_per_token for d in span.cost_details) > 0.001",
    "any(d.cost > 1 for d in span.cost_details) and span.total_cost > 5",
    # A boolean element field is a condition on its own, and stays one under `not` and
    # inside `and`. These three used to disagree: the bare form was accepted while the
    # other two were refused as "not a condition", because the span-vocabulary operand
    # rules cannot see element fields and were still walking this scope.
    "all(d.is_prompt for d in span.cost_details)",
    "any(not d.is_prompt for d in span.cost_details)",
    "any(d.cost > 0 and d.is_prompt for d in span.cost_details)",
    # A membership list is exempt from numeric coercion because the element language has
    # already typed its elements against the needle -- pinned here so the exemption and the
    # pass it relies on cannot drift apart.
    "any(d.cost in [1, 2] for d in span.cost_details)",
    # A loop variable may be named after the root; inside the body it *is* that name, as
    # in Python. The iterable stays unshadowed, because Python evaluates the outermost
    # `for` clause's iterable in the enclosing scope -- so this one line reads the root on
    # the right of `in` and the element everywhere else.
    "any(span.cost > 1 for span in span.cost_details)",
    "any(span.cost > 1 for span in span.cost_details) and span.total_cost > 5",
    # Registered under a dotted key, so no bare name became an iterable: `cost_details` is
    # the attribute path it always was. Pinned for the same reason `parent == 'x'` is.
    "cost_details > 1",
    # Annotation aliasing rewrites the source text and re-parses before translation, while
    # the reserved root is validated against the original tree. These pin that the rewrite
    # leaves root-rooted nodes intact, in both the scalar and the comprehension form.
    "annotations['q'].score > 0.5 and span.total_cost > 1",
    "annotations['q'].score > 0.5 and any(d.cost > 1 for d in span.cost_details)",
]

# Every form the spec documents as rejected, with the reason it documents.
REJECTED = [
    # Reserved root, closed member set. Nothing lies beneath `span.`, so a misspelling
    # has no attribute path to fall into and is answered by name -- the property that
    # reserving the root buys, and the reason the break was worth taking.
    ("span.totl_cost > 1", "did you mean `span.total_cost`"),
    ("span.nonsense > 1", "invalid field `span.nonsense`"),
    ("span.total_cost.foo > 1", "cannot be traversed further"),
    ("span['total_cost'] > 1", "cannot be traversed further"),
    ("span == 1", "can only be used as `span.<field>`"),
    # Comprehensions over the root's collection member
    ("span.cost_details > 1", "can only be iterated"),
    ("any(d.cost > 1 for d in cost_details)", "invalid iterable `cost_details`"),
    ("any(d.nope > 1 for d in span.cost_details)", "invalid field `d.nope`"),
    # Unshadowed, `span.cost` is a root reference and `cost` is not a member of the root.
    # The shadowed spelling is accepted -- see ACCEPTED.
    ("any(span.cost > 1 for d in span.cost_details)", "invalid field `span.cost`"),
    # Inside a comprehension the element language types itself, and it is the family's
    # strict dialect rather than the permissive one around it. Each of these compiled to
    # SQL before that pass was wired up: the first two reached `__call__` as a `NameError`,
    # and the rest reached the database as a comparison no backend agrees about.
    #
    # Note what the first two do *not* say. Advising `attributes[...]` would be the natural
    # span-grain wording and is wrong here -- an attribute path inside a comprehension
    # compiles and then fails at query-build time, so a rejection must never steer a user
    # into it.
    ("any(d.cost > 0 for detail in span.cost_details)", "invalid field `d.cost`"),
    (
        "any(d.cost > span.total_cost for d in span.cost_details)",
        "reads the filtered row, which is not reachable inside a comprehension",
    ),
    ("any(d.cost > latency_ms for d in span.cost_details)", "is a span-level term"),
    ("any(d.cost > 'abc' for d in span.cost_details)", "cannot compare"),
    ("sum(d.token_type for d in span.cost_details) > 0", "reduces numbers"),
    ("any(d.is_prompt == 'yes' for d in span.cost_details)", "cannot compare"),
    ("any(d.cost in ['a', 'b'] for d in span.cost_details)", "a list is all text or all numbers"),
    # Casting inside the element scope follows the family dialect too, which is stricter
    # than the span grain's own: `int(...)` is refused outright rather than aliased to
    # `float(...)`, and casting a term to the type it already has is a no-op the strict
    # dialect names. Outside a comprehension all three still compile, unchanged.
    ("any(int(d.cost) > 1 for d in span.cost_details)", "would not truncate"),
    ("any(float(d.cost) > 1 for d in span.cost_details)", "cannot cast a number"),
    ("any(str(d.token_type) == 'a' for d in span.cost_details)", "cannot cast text"),
    # An `if` clause is a condition, so a bare text field is not one.
    ("sum(d.cost for d in span.cost_details if d.token_type) > 1", "expected a condition"),
    # A resolved member is typed identically on both sides of the compiler, so it
    # rejects exactly as a bare column does -- the two encodings of one rule, pinned
    # against each other (`latency_ms > '100'` is the same row, below).
    ("span.total_cost > '100'", "cannot compare"),
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
    # A literal cast to text reaches the driver as a bind parameter typed
    # VARCHAR holding a Python value. PostgreSQL refuses it outright; SQLite
    # coerces, and the two do not agree on the spelling (`True` -> `true` vs
    # `1`). Casting a column is portable and stays allowed.
    # A boolean has no portable spelling as text: `true`/`false` on PostgreSQL,
    # `1`/`0` on SQLite, so the same condition matches opposite rows. It arrives
    # as a literal or as any boolean-valued expression -- notably the annotation
    # existence check, which compiles to `CASE WHEN ... THEN <bind> ELSE <bind>`.
    ("str(True) == 'true'", "cannot cast boolean to text"),
    ("str(False) == 'false'", "cannot cast boolean to text"),
    ("str(annotations['q']) == 'true'", "cannot cast boolean to text"),
    ("str(1) == '1'", "cannot cast number to text"),
    ("str(1.5) == '1.5'", "cannot cast number to text"),
    # The literal rule now only catches what has no type of its own.
    ("str(None) == 'None'", "cannot cast the literal"),
    # A float prints its integral values differently -- PostgreSQL renders 1.0
    # as `1`, SQLite as `1.0` -- so the divergence is per *value*: 0.1 agrees
    # and 1.0 does not. `latency_ms` happens to agree today because it compiles
    # to a numeric expression rather than a float column, which is exactly the
    # kind of distinction no user can be asked to track.
    ("str(latency_ms) == '1'", "cannot cast number to text"),
    ("str(annotations['q'].score) == '1'", "cannot cast number to text"),
    ("str(llm.token_count.total) == '1'", "cannot cast number to text"),
    # Timestamps share no spelling at all: PostgreSQL renders in the session
    # time zone, SQLite in UTC with microseconds.
    ("str(start_time) == '2026-01-01'", "cannot cast datetime to text"),
    # ordered comparison with a boolean operand: SQLAlchemy refuses to order
    # against a raw True/False, so these validated and then crashed at
    # evaluation -- outside the error boundary, as a server error
    ("attributes['x'] > True", "orders a boolean"),
    ("True < attributes['x']", "orders a boolean"),
    ("annotations['q'] >= False", "orders a boolean"),
    # a datetime field compared to an unknown-typed operand: PostgreSQL has no
    # timestamp/varchar comparison operator, so this validated and failed at
    # plan time while SQLite quietly compared text
    ("start_time > attributes['x']", "cannot compare a datetime field"),
    ("attributes['x'] < end_time", "cannot compare a datetime field"),
    ("start_time == metadata['ts']", "cannot compare a datetime field"),
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
    ("span_kind", "is not a condition"),
    # membership needs a span field on the left
    ("1 in [1, 2]", "compares two literals"),
    # unsupported operators
    ("latency_ms ** 2 > 10", "invalid arithmetic operator"),
    ("latency_ms // 2 > 0", "invalid arithmetic operator: //"),
    ("name == 'a' & status_code == 'b'", "invalid arithmetic operator"),
    # reserved keyword misuse. Traversal is rejected *breadth-first* -- every
    # dotted or subscripted shape under `parent_span`, not just column access --
    # so lifting the rejection (the planned `parent_span.<column>` extension)
    # shows up in this corpus as an explicit REJECTED -> ACCEPTED move per
    # shape, never as an accident.
    ("parent_span.name == 'x'", "not supported"),
    ("parent_span.span_kind == 'LLM'", "not supported"),
    ("parent_span.attributes['x'] == 'y'", "not supported"),
    ("parent_span.parent_span is None", "not supported"),
    ("parent_span.trace_id == 'x'", "not supported"),
    ("parent_span == 'LLM'", "can only be compared to None"),
    # an empty eval name can never match an annotation
    ("evals[''] == 'x'", "missing eval name"),
    # calls other than the three casts
    # Still rejected, but by the comprehension rules rather than the call whitelist: `len`
    # is a reduction at this grain now, so the message names what it takes instead of
    # calling the whole expression invalid.
    #
    # The example is pinned, not just the prefix, because a per-kind example is the whole
    # point of it: one shared template used to suggest a generator here, which `len`
    # rejects, and a predicate element for `sum`/`max`/`min`, which reduce a value. Each
    # suggestion is now a form this validator accepts.
    (
        "len(name) > 1",
        r"takes a comprehension over span\.cost_details, e\.g\. `len\(\[x for x in span\.cost_details\]\)`",
    ),  # noqa: E501
    ("sum(name) > 1", r"e\.g\. `sum\(x\.<field> for x in span\.cost_details\)`"),
    ("any(name)", r"e\.g\. `any\(x\.<field> == \"\.\.\.\" for x in span\.cost_details\)`"),
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
    # Scope verdicts are observable semantics (principle 8) and the UI picks metric columns
    # from them, so the new forms are pinned too: a root predicate still binds every row it
    # is conjoined with, and neither a reserved-root member nor a comprehension claims
    # root-ness on its own.
    ("parent_id is None and span.total_cost > 1", "strict"),
    ("parent_span is None and any(d.cost > 1 for d in span.cost_details)", "orphan_aware"),
    ("span.total_cost > 1", None),
    ("any(d.cost > 1 for d in span.cost_details)", None),
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
    # the numeric-string grammar bounds the spelling, not the magnitude, so an
    # in-grammar cast argument can still overflow to the value rejected above
    pytest.param(
        "latency_ms == float('1e400')", "invalid numeric literal", id="cast-overflow-infinity"
    ),
    pytest.param(
        "latency_ms == int('" + "9" * 320 + "')", "invalid numeric literal", id="cast-overflow-int"
    ),
    # Python ints are unbounded; neither backend has a faithful float for one
    # past the IEEE range
    pytest.param("latency_ms == " + "9" * 320, "invalid numeric literal", id="int-overflow"),
    # SQL `IN` compares with `=`, and `= NULL` is never true; `NOT IN` with a
    # NULL element is never true for any row
    pytest.param("name in [None]", "includes None", id="in-null-element"),
    pytest.param("name not in ['a', None]", "includes None", id="not-in-null-element"),
    pytest.param("metadata['x'] not in [1, None]", "includes None", id="not-in-null-mixed"),
    pytest.param("name == ('a', 'b')", "compares against a collection", id="tuple-as-scalar"),
    pytest.param("name in [['a']]", "collections cannot be nested", id="nested-container"),
    # the escape *sequence* in the source text, not a literal NUL byte -- the
    # latter is rejected by Python's own parser
    pytest.param(r"name == 'a\x00b'", "NUL character", id="nul-escape"),
    pytest.param("ｎａｍｅ == 'a'", "is interpreted as", id="nfkc-identifier"),
    pytest.param("context.ｓｐａｎ_id == 'x'", "is interpreted as", id="nfkc-attribute-segment"),
    pytest.param(
        "annotations['q'].ｓｃｏｒｅ > 0", "is interpreted as", id="nfkc-annotation-member"
    ),
    pytest.param("llm.token_count.ｔｏｔａｌ > 0", "is interpreted as", id="nfkc-dotted-path"),
    pytest.param("ｎａｍｅ == 'name'", "is interpreted as", id="nfkc-ascii-in-literal"),
    # a bare boolean literal is a value, not a condition -- unlike as an operand
    pytest.param("True", "only be used as an operand", id="bare-true"),
    pytest.param("False", "only be used as an operand", id="bare-false"),
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


def test_root_span_scope_normalizes_like_span_filter() -> None:
    """`SpanFilter` strips surrounding whitespace at construction; the
    module-level analyzer must see the same text. The two diverged once: a
    leading space parses as an `IndentationError`, so `" parent_id is None "`
    validated and restricted the query while the analyzer reported None -- and
    the UI chose metric columns from the wrong verdict."""
    for condition, expected in SCOPES:
        padded = f"  {condition}  "
        assert root_span_scope(padded) == expected
        assert root_span_scope(padded) == SpanFilter(padded).root_scope


@pytest.mark.parametrize("condition,expected", SCOPES)
def test_spec_root_span_scope(condition: str, expected: str | None) -> None:
    assert root_span_scope(condition) == expected


def test_condition_round_trips_through_serialization() -> None:
    """The condition *string* is the persisted artifact -- never a parsed or
    compiled form, both of which change between releases."""
    condition = "annotations['q'].score > 0.5 and span_kind == 'LLM'"
    assert SpanFilter.from_dict(SpanFilter(condition).to_dict()).condition == condition
