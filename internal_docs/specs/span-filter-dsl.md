# Span Filter DSL

> This spec (with its conformance tests) is the authority on what the language accepts. The
> **user-facing** grammar reference is the public
> [Filter Expressions](https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions)
> doc — a curated derivative of this spec, not a second authority. Keep them in sync when the
> accepted grammar changes.

Reference for the filter-condition language implemented in
`src/phoenix/trace/dsl/filter.py`.

Statements here were verified against the code, and dialect-dependent behavior
was executed rather than reasoned about. The version matrix that claim rests on:

| Backend | Verified on | Floor |
|---|---|---|
| SQLite | bundled `sqlean` build | `text_contains` and the JSON functions `sqlean` provides |
| PostgreSQL | 12.22, **14.19 (full DSL suites)**, 17.6 (full DSL suites), 17.10 | **14**, the product floor — the language itself needs only `jsonb_path_query_first` (PG 12) and `jsonb`→`numeric` casts (PG 11) |
| CPython (grammar host) | 3.10 in pre-merge CI; 3.10 / 3.13 / 3.14 in the scheduled all-platforms run | 3.10 — the grammar is whatever `ast.parse` accepts on the running interpreter |

Two floors are in play and only one is a support commitment. The *language's*
feature floor is PostgreSQL 12, because `SafeJsonFloat` compiles to
`jsonb_path_query_first`, which does not exist before it. The *product* floor
is 14 — the oldest version still receiving upstream fixes — decided in
[#14940](https://github.com/Arize-ai/phoenix/issues/14940), and it is the
version the guarantees here must hold on. Behavioral checks below were run on
17; the cast and JSON-path shapes the guarantees depend on were additionally
confirmed on 12.22, which bounds 14 from below. Anything claimed here for a
version outside that matrix is unverified.

The host interpreter belongs in this matrix because it *defines the grammar*:
acceptance, AST shape, and error wording are properties of the running
CPython's `ast.parse`, and they change across releases. Phoenix supports 3.10
through 3.14. Pre-merge CI runs the unit suites — the conformance corpus
included — on 3.10 only and against the runner's installed PostgreSQL
(currently 16). The scheduled all-platforms run adds the newer interpreters
but **not** the floor database: its unit job installs the runner's PostgreSQL
the same way, and the `postgres:14` service containers back only the
integration jobs, which do not run these suites. The unit jobs are therefore
**pinned to the floor**: they install `postgresql-14` from the PGDG repository
and pass `--postgresql-exec /usr/lib/postgresql/14/bin/pg_ctl`, so
`pytest-postgresql` spawns the version the guarantees must hold on rather than
whatever the runner's Ubuntu ships. (The full suites were first executed on
14.19 and 17.6 locally, 2026-07-31, all green; the same `--postgresql-exec`
flag selects a version for local runs, e.g.
`/opt/homebrew/opt/postgresql@14/bin/pg_ctl`.) Newer-version coverage rides on
the all-platforms macOS leg and the integration containers; interpreter drift
on 3.13/3.14 is still caught only by the scheduled run.

## What This Is

A user-facing expression language, written in a subset of Python syntax, that
compiles to a SQLAlchemy `WHERE` clause over the `spans` table. It reaches the
server from three directions:

- the filter field in the spans/traces UI (`SpanFilterConditionField`)
- the `spans(filterCondition:)` GraphQL argument and its sibling resolvers
- `SpanQuery` in the REST/client surface, via `SpanFilter.from_dict`

The public entry points are `SpanFilter(condition)`, the module-level
`root_span_scope(condition)`, and `SpanFilterError` — the exception type
callers catch, and part of the API contract: the GraphQL error masker
(`exceptions.py`) surfaces its message verbatim because it is known to be
user-safe. All three are exported from `phoenix.trace.dsl`.

### Why the grammar is about to become a contract

Filter conditions are currently transient: typed into a field, sent with a
query, forgotten. They already leak into URLs, which makes them semi-durable.
**Once conditions are persisted in the database, the grammar becomes a
compatibility surface** — every stored row is an expression that some future
version of this parser has to keep accepting, with unchanged meaning.

This document exists to make that surface explicit. [Persistence
Contract](#persistence-contract) is the section that matters for that work; the
rest defines what is being persisted.

---

## Evaluation Model

Constructing a `SpanFilter` runs three phases, all of them before any query
exists:

| Phase | Where | Catches |
|---|---|---|
| 1. Parse | `ast.parse(mode="eval")` | Python syntax errors |
| 2. Validate | `_validate_expression` → `_validate_operand_types` | Structure, types, boolean position |
| 3. Translate & compile | `_FilterTranslator` → `compile` | Shapes the validator admits but cannot express |

A fourth step, **evaluation**, happens later: `SpanFilter.__call__` evaluates the
compiled expression against the SQLAlchemy namespace to produce the `WHERE`
clause. Failures here — an operator SQLAlchemy cannot apply to the operand it
was given — surface as arbitrary Python exceptions rather than
`SpanFilterError`, which is why the validator has to exclude those shapes rather
than rely on translation to reject them.

None of this touches a database. Every phase above is static; the query is only
then handed to the backend, which is where
[the remaining failure modes](#validation-is-not-execution) live.

`validateSpanFilterCondition` (GraphQL) runs all three phases, evaluates, and
additionally compiles the statement to SQL text against **both dialects**,
whichever backend is live. Compiling both is the enforcement of the
dialect-independence guarantee in [Dialect Semantics](#dialect-semantics): a
condition only one backend can compile is rejected everywhere, rather than
validating on the deployment that happens not to hit the defect. It does
**not** execute.

All three phases raise `SpanFilterError`, a subclass of `SyntaxError`. Stack
exhaustion at any phase is normalized to
`SpanFilterError("filter condition is nested too deeply")` rather than escaping
as `RecursionError`.

---

## Grammar

### Expression forms

The whole condition must be a **condition**, not a value. So must every operand
of `and`, `or`, and `not`. A condition is one of:

| Form | Example | Whole condition | Operand of `and`/`or`/`not` |
|---|---|---|---|
| Comparison | `latency_ms > 100` | yes | yes |
| Chained comparison | `0.5 < latency_ms < 1000` | yes | yes |
| Logical combination | `a == 1 and b == 2` | yes | yes |
| Bare annotation (existence check) | `annotations['quality']` | yes | yes |
| Quantifier over a collection | `any(d.cost > 1 for d in span.cost_details)` | yes | yes |
| Boolean literal | `True`, `False` | **no** | yes |

Anything else in either position is rejected. See
[Boolean Position](#boolean-position).

**Comprehensions.** `any` and `all` yield a condition; `len`, `sum`, `max`, and
`min` yield a number and so must be compared. Each must be the sole argument of
one of those six, range over a declared collection through a single `for` with a
simple loop variable, and reference that variable only through the collection's
declared element fields. `len` takes a list comprehension, the rest take a
generator — inherited from CPython, where `len` needs a sized argument. The
grain declares one collection, `span.cost_details`.

Empty-collection results follow CPython: `all(())` is true, `len(())` and
`sum(())` are `0`. `max(())`/`min(())` raise in Python and are NULL here, which
fails every comparison — the language cannot raise per row.

A bare boolean literal is the one form that differs between the two columns:
`name == 'x' and True` is accepted, `True` alone is not. A condition that
selects every row is what an empty condition already expresses, so the literal
form buys nothing and is rejected as the value it is.

### Field names

Names resolve to typed span columns:

**String** — `span_id`, `trace_id`, `parent_id`, `span_kind`, `name`,
`status_code`, `status_message`, `context.span_id`, `context.trace_id`

**Number** — `latency_ms`, `cumulative_llm_token_count_prompt`,
`cumulative_llm_token_count_completion`, `cumulative_llm_token_count_total`

**Datetime** — `start_time`, `end_time`

**Number, via attributes** — `llm.token_count.prompt`,
`llm.token_count.completion`, `llm.token_count.total`. These live in the JSON
`attributes` column but are known to be numeric, so they are cast rather than
compared as text.

**Case-folded enums** — `span_kind` and `status_code` hold uppercase enum
values (`'LLM'`, `'OK'`, …), and any string literal compared against either is
uppercased during translation — including each element of a membership list and
the needle of a substring containment. `span_kind == 'llm'`,
`span_kind == 'LLM'`, and `span_kind in ['llm']` select the same rows. The fold
applies to these two names only (`name == 'llm'` stays case-sensitive) and to
literals only; a dynamic operand is compared as-is. This is observable meaning —
a stored condition's row set depends on it — so the fold is part of the
compatibility surface, not an implementation detail.

**Reserved** — `parent_span`. Usable *only* as `parent_span is None` /
`parent_span is not None` (and the `==`/`!=` spellings). Traversal
(`parent_span.name`) is rejected with a dedicated message; it is not yet
supported. A span attribute literally named `parent_span` is still reachable as
`attributes['parent_span']`.

**Reserved root** — `span`, over a closed set of members reading this span's own
cost row (`span_costs`, joined on demand — see [Reserved
roots](#reserved-roots)):

- **Number** — `span.total_cost`, `span.prompt_cost`, `span.completion_cost`,
  `span.total_tokens`, `span.prompt_tokens`, `span.completion_tokens`,
  `span.total_cost_per_token`, `span.prompt_cost_per_token`,
  `span.completion_cost_per_token`
- **Collection** — `span.cost_details`, iterable only, with element fields
  `token_type` (string), `is_prompt` (boolean), `cost`, `tokens`,
  `cost_per_token` (number)

`span.attributes[...]` is deliberately **not** a member: `attributes` remains
the spelling for the dynamic namespace, and admitting a second one would make
the root's closure meaningless.

**This list is exhaustive.** Every identifier not named above — including ones
that look like span columns, such as `events` — resolves to an attribute path,
not a column. `events == 'x'` compiles to a comparison against
`attributes['events']` and has nothing to do with the `events` column on the
table. This holds for the cost members too: they are reachable *only* through
the root, so a bare `total_cost` or `cost_details` is still an attribute path.

Reading the vocabulary out of the code is easy to get wrong here. `_NAMES` is
the **evaluation namespace** handed to `eval`, and it binds `attributes` and
`events` because the compiled expression needs them; it is not the set of names
a user may write. The user-facing vocabulary is
`_STRING_NAMES ∪ _FLOAT_NAMES ∪ _DATETIME_NAMES ∪ _FLOAT_ATTRIBUTES` plus the
reserved keyword and the reserved root's members — exactly the list above. The
root's members are likewise absent from `_NAMES`: they are bound per-instance
against an aliased join, which is also why `Projector` does not resolve them.

### Reserved roots

A reserved root is the third kind of dotted spelling this language has, and the
three differ in what lies beneath them:

| Kind | Example | Resolves to |
|---|---|---|
| Backward-compatibility alias | `context.span_id` | a name that also has a bare spelling |
| Attribute path | `llm.token_count.total` | *into* the dynamic namespace |
| Reserved root | `span.total_cost` | a closed set; shadows the dynamic namespace beneath it |

Closure is the point. A bare identifier falls back to the dynamic namespace, so
a misspelling silently matches nothing; nothing lies beneath a reserved root, so
`span.totl_cost` is rejected by name with a suggestion. The cost of that
property is that reserving a root is a **breaking change** for conditions that
keyed an attribute under it (§6 of the design principles) — `attributes['span.x']`
now errors rather than resolving. It fails loudly, which is the better half of
the trade, and the root was chosen because neither OTel nor OpenInference
defines attributes under `span.`. Any future root must be checked the same way:
`session.` in particular is a real semantic-convention key
(`SpanAttributes.SESSION_ID`) and is *not* free to reserve.

Once a root is reserved, adding members to it later is additive: an unknown
member already errors, so admitting one cannot change what an accepted
condition meant.

Two shapes are rejected that Python would allow, both deliberate:

- **Traversal past a member** (`span.total_cost.x`, `span['total_cost']`). The
  root exposes its fields directly and nothing further.
- **Shadowing the root with a loop variable**
  (`any(span.cost > 1 for span in span.cost_details)`). Not because shadowing
  would break anything — it would make the filtered row unreachable inside that
  one comprehension, which is ordinary lexical scoping. The restriction is kept
  because it is nearly free (no one needs this spelling) and reversible: under
  the additive-only policy a rejection can be lifted later, a restriction cannot
  be added. It also removes a footgun — Python evaluates the outermost `for`
  clause's iterable in the *enclosing* scope, so `for span in span.cost_details`
  reads the same token two ways in one line.

**Missing values.** Cost and token members coalesce to `0`, matching the session
grain's rollups so that one name means one thing across grains — a span with no
cost row answers `span.total_cost == 0`. The three `*_cost_per_token` ratios do
not: a span with no cost row has no rate to report, and coalescing would assert
one. They are NULL and so fail every comparison, per [Unknown
types](#unknown-types). Element fields of `span.cost_details` are likewise
nullable — a detail row's missing `cost` is a fact about that row.

### Backward-compatibility aliases

Rewritten before translation:

| Written | Resolves to |
|---|---|
| `context.span_id` | `span_id` |
| `context.trace_id` | `trace_id` |
| `cumulative_token_count.prompt` | `cumulative_llm_token_count_prompt` |
| `cumulative_token_count.completion` | `cumulative_llm_token_count_completion` |
| `cumulative_token_count.total` | `cumulative_llm_token_count_total` |

These are load-bearing for stored conditions. Removing one silently breaks every
persisted expression that uses it.

### Attribute access

Any identifier that is not a known name or reserved keyword becomes a JSON
attribute path. All of these are equivalent ways to reach the same value:

```
llm.model_name
attributes['llm']['model_name']
attributes[['llm', 'model_name']]
attributes['llm'][['model_name']]
```

`metadata['k']` is sugar for `attributes['metadata']['k']`. Integer subscripts
index into JSON arrays (`attributes['arr'][0]`). Attribute values are
**schemaless**: their type is unknown at validation time, which is what
[Unknown Types](#unknown-types) is about.

### Annotations

`annotations['name']` and `evals['name']` are the same accessor; `evals` is a
legacy alias retained for compatibility. Valid members are `.score` (number),
`.label` (string), and `.explanation` (string). Any other member is rejected,
with a "did you mean" suggestion when it is close to a valid one.

A bare `annotations['name']` is an **existence check** and is boolean-valued:
true when an annotation row with that name exists on the span at all
(`CASE WHEN <alias>.id IS NOT NULL`), regardless of whether its score, label,
or explanation are null.
Each distinct name in a condition produces its own aliased `LEFT JOIN` against
`span_annotations`, so a condition may join the table several times.

Annotation names are spliced by **byte offset** into the source before
translation (`_AnnotationExpressionAliaser`), which is why multi-byte names and
multi-line sources are explicitly tested.

### Literals

| Kind | Accepted |
|---|---|
| String | `'...'`, `"..."` |
| Number | Python int/float literals |
| Boolean | `True`, `False` |
| Null | `None` |
| Collection | list or tuple of literals, homogeneously typed, no `None` elements |
| Datetime | ISO 8601 string **with an offset** |

**Datetime literals must carry a timezone.** `'2024-01-01T00:00:00Z'` and
`'2024-01-01T00:00:00+02:00'` are accepted; `'2024-01-01T00:00:00'` is rejected.
A naive literal has no single defensible meaning — `UtcTimeStamp` reads naive
values as server-local, so binding one would give the same stored condition a
different boundary in deployments with different timezones. Reading it as UTC
instead would be deterministic but would silently disagree with that existing
convention, so the offset is required rather than guessed.

**Numeric strings** are accepted only inside an explicit `float()`/`int()` cast,
and only when they match:

```
[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?
```

Python's `float()` is deliberately *not* the test. It also accepts `1_000`,
`nan`, `inf` and surrounding whitespace, which the two backends do not treat
alike — SQLite casts `'1_000'` to `1.0` while PostgreSQL rejects it outright.

**Every numeric literal must be finite as a float**, in whatever spelling it
arrives. The grammar above bounds the spelling, not the magnitude, so
`float('1e400')` matches it and overflows to `inf` — the exact value the bare
`1e400` rule rejects. The converted *value* is checked as well as the text, and
the same rule covers unbounded int literals: Python parses `'9' * 320` digits
happily, but neither backend has a faithful float for it — asyncpg refuses the
bind while SQLite quietly stores infinity.

The finiteness rule is a boundary, not a precision guarantee: an int inside the
float range but past the 53-bit mantissa (`2**53 + 1`) is accepted and compares
in float precision, silently rounding. That falls under the numeric-precision
non-guarantee in [Dialect Semantics](#dialect-semantics) rather than under
validation.

### Operators

| Category | Supported | Rejected |
|---|---|---|
| Comparison | `==` `!=` `<` `<=` `>` `>=` | — |
| Identity | `is` `is not` (with `None`, `True`, `False`) | `is` with any other value |
| Membership | `in` `not in` | — |
| Logical | `and` `or` `not` | — |
| Arithmetic | `+` `-` `*` `/` `%` | `**`, `&`, `\|`, `^`, `<<`, `>>` |
| Unary | `-` `+` | — (see below) |

Rejected binary operators raise `invalid arithmetic operator`; unary `~` raises
`unsupported operator`. See [Inherited Python
Surface](#inherited-python-surface) for why the unary case needed its own rule.

Unary `+` is the identity on a number and is dropped during translation;
SQLAlchemy expressions define no `__pos__`.

`in` is **overloaded** and its meaning depends on the right operand:

- right side is a text field → **substring containment** (`'x' in output.value`)
- right side is a list/tuple → **set membership** (`span_kind in ['LLM']`)

Membership requires a span field on the left. `1 in [1, 2]` is rejected: it
would translate to `1.in_([1, 2])` and raise a bare `AttributeError` from inside
`SpanFilter.__call__`.

`None` is rejected inside a membership list. SQL `IN` compares elements with
`=`, and `= NULL` is never true, so `name in [None]` can never match — and under
three-valued logic `name not in ['a', None]` is never true for *any* row, which
silently empties the result set. Missing values are tested with `is None` /
`is not None`.

Substring containment is **case-insensitive** on both backends (both operands
are lower-cased before a `LIKE`-style containment test). This matches the
session filter grain, so the same-looking query answers the same way in the
spans and sessions views; the cross-grain reasoning is recorded in
`session-filter-dsl.md` under *Case*. Equality (`==` / `!=`) and membership in
a literal list stay exact. Case-folded enum fields need no needle handling
under this rule — `'llm' in span_kind` and `'LLM' in span_kind` already match
the same rows — while enum *equality* still uppercases its literal, so
`span_kind == 'llm'` keeps matching (see [Field names](#field-names)).

> Compatibility note: containment was case-sensitive (`strpos` /
> `text_contains`) until the session filter DSL shipped. A saved filter using `in` returns the
> same rows or more, never fewer; one using `not in` returns the same rows or fewer, never more.

### Casts

`str(x)`, `float(x)`, `int(x)` are the only calls permitted. Every other call —
`len()`, lambdas, comprehensions, method calls like `name.upper()` — is
rejected. `float()` and `int()` are equivalent; both produce a float.

A cast is only admitted where its result is the same on both backends, which
rules out two operands:

| Rejected | Why |
|---|---|
| `float(True)`, `int(<boolean>)` | PostgreSQL rejects `CAST(true AS FLOAT)` |
| `str(<boolean>)` | `true`/`false` on PostgreSQL, `1`/`0` on SQLite |
| `str(<number>)` | a float's integral values print as `1` on PostgreSQL and `1.0` on SQLite |
| `str(<datetime>)` | PostgreSQL renders in the session time zone, SQLite in UTC with microseconds |
| `str(<non-string literal>)` | binds a Python value into a VARCHAR parameter; PostgreSQL refuses it |

Every rule is by inferred **type**, not by syntax, because the same type reaches
a cast in more than one shape. `annotations['q']` is an existence check that
compiles to `CASE WHEN ... THEN <bind> ELSE <bind> END` over Python booleans, so
`str(annotations['q'])` is the same defect as `str(True)` wearing a column's
clothes; a rule written against literals catches one and not the other.

The number rule is the instructive one. It is **per value**: `str(score) ==
'0.5'` agrees across backends and `str(score) == '1'` does not, because only
integral floats print differently. It is also per *expression shape* —
`latency_ms` happens to agree today because it compiles to a numeric expression
rather than a float column. Neither distinction is one a user could be asked to
track, and neither is visible in a fixture of conveniently fractional numbers.
A cast whose portability depends on the data is not portable.

What survives is `str()` over text, where it is a no-op, and over values whose
type is unknown until the row is read. The latter is the shape it is actually
used for — `'x' in str(metadata['k'])` — and substring search agrees on both
backends. Equality against such a value does not; see
[Dialect Semantics](#dialect-semantics).

---

## Type System

Five types plus *unknown*: `boolean`, `datetime`, `number`, `string`, `null`.

### Inference

`_get_filter_value_type` assigns a type to every node. Comparisons, logical
expressions, boolean literals, and bare annotations are `boolean`. Known field
names take their declared type. Annotation `.score` is `number`; `.label` and
`.explanation` are `string`. `str()` is `string`; `float()`/`int()` are
`number`. Arithmetic is `number`, except `+` over two strings, which is `string`
(concatenation). Everything else — notably any JSON attribute — is **unknown**.

### Comparison rule

Two operands of *known but different* types cannot be compared. `null` is
exempt, so `latency_ms == None` is legal.

There is exactly one exception, for datetimes: a string **literal** compared
against a datetime field is bound as a datetime rather than rejected. That is
how datetime literals are written at all. The exemption applies per element
inside a membership list as well — `start_time in ['2024-01-01T00:00:00Z']` is
legal, and each element must satisfy the datetime-literal rules (ISO 8601, with
an offset).

Booleans cannot be ordered: `<` `<=` `>` `>=` with a boolean-typed operand —
a literal, or a boolean-valued expression like the bare annotation existence
check — is rejected on both surfaces. On the span side the shape validated and
then crashed at *evaluation* (SQLAlchemy refuses to order against a raw
`True`/`False`), outside the error boundary, as a server error; on the
experiment side it compiled to `numeric > boolean`, an operator PostgreSQL
does not have. Every such comparison has a clearer spelling with `==`, `!=`,
or `is`.

Datetime fields are also the one place an *unknown*-typed operand is rejected
rather than left to the cast heuristics: `start_time > attributes['x']` has no
honest compilation — PostgreSQL has no comparison operator between `timestamp`
and `varchar` at all (the statement validated and then failed at plan time),
SQLite quietly compared text, and no total datetime conversion exists to
define the shape with. The literal is the only portable spelling.

### No implicit numeric coercion

A quoted number against a numeric field is an **error**, not a coercion:

```
latency_ms > '100'                     ->  rejected
latency_ms > 100                       ->  ok
float('100') < latency_ms              ->  ok
annotations['q'].score >= '0.5'        ->  rejected
```

Both sides are statically typed at that comparison, so there is nothing to
infer. The coercion this replaces was never correct: it bound the string as a
float-typed parameter, which asyncpg refuses, so the condition validated and
then failed when the query ran. It appeared to work only because SQLite is
loosely typed and the tests asserting it merely constructed a `SpanFilter`
without running one. Measured on `main`:

| Condition | SQLite | PostgreSQL |
|---|---|---|
| `latency_ms > 100` | ok | ok |
| `latency_ms > '100'` | ok | **fails at execution** |
| `'100' < latency_ms` | ok | **fails at execution** |
| `annotations['q'].score >= '0.5'` | ok | **fails at execution** |

The error suggests the fix, but only when dropping the quotes would actually be
valid: ``cannot compare number and string, write 100 instead of '100'``.

### Unknown types

An attribute's type cannot be known before the rows are read, so comparisons
involving one are admitted and resolved at translation:

- compared against a boolean → `SafeJsonBoolean`
- compared against a number, or wrapped in `float()`/`int()` → `SafeJsonFloat`
- otherwise → cast to text

Both `SafeJson*` functions are **total**: a value that cannot be converted
yields `NULL` and the row drops out rather than aborting the statement. This is
the mechanism that makes schemaless attributes safe to filter on, and it is
verified against deliberately hostile rows (`"abc"`, `"1_000"`, `"nan"`,
`"inf"`, `" 12 "`, containers, nulls).

Every rule above resolves an unknown type against a *known* one. When both
operands are unknown — one attribute compared to another — there is nothing to
resolve against, and what happens depends on the operator:

- **Ordered** (`<` `<=` `>` `>=`) → both sides take `SafeJsonFloat`. Text
  ordering would not merely disagree on near-equivalent encodings — it inverts
  numeric order (`'9' > '10'` as PostgreSQL text, `9 < 10` as SQLite numbers) —
  so order is defined numerically, and a row with no number on either side
  drops out. This matches the experiment-run filter's treatment of the same
  shape.
- **Equality and membership** → the comparison falls to text with whatever the
  extraction produced. This is the one place the type system has no answer, and
  the backends do not agree on what it means; see
  [Dialect Semantics](#dialect-semantics).

Unknown types are *not* admitted in boolean position — see below.

---

## Boolean Position

Every operand of `and`, `or`, `not` must be a condition.

```
name == 'x' and r                  ->  `r` is not a condition, expected a
                                       comparison such as `r == ...`
name == 'x' and metadata['flag']   ->  rejected
not attributes['flag']             ->  rejected
name == 'x' or 5                   ->  rejected
name == 'x' and annotations['q']   ->  ok  (existence check is boolean)
name == 'x' and True               ->  ok
```

Unknown-typed operands are rejected rather than coerced to truthiness. Two
reasons:

1. **The overwhelmingly common source of this shape is a half-typed
   expression** — `name == 'x' and ` plus one more character. Reporting that as
   an error is more useful than silently filtering on whatever was typed.
2. **The backends disagree about the consequence.** PostgreSQL aborts the
   statement (`argument of AND must be type boolean, not type jsonb`); SQLite
   coerces and silently returns the wrong rows. The second is worse, and it is
   the one a developer on the default local database sees.

Truthiness is not offered as an explicit cast either. There is no `bool()`.

---

## Dialect Semantics

Phoenix supports SQLite and PostgreSQL. The DSL's goal is that **a condition
means the same thing on both, or is rejected on both.** The "Not guaranteed"
list below is the measured distance from that goal: those shapes are accepted
today and governed by the defined-divergence clause of the
[compatibility policy](#the-compatibility-policy-additive-only) — semantically
undefined, enumerated, and eligible to be given one meaning later.

Guaranteed:

- Validation is dialect-independent. Accept/reject never varies by backend.
- Dynamic JSON conversion is total on both (`SafeJsonFloat`,
  `SafeJsonBoolean`), including the three JSON boolean encodings (`true`,
  `"true"`, `1`) and their false counterparts, with JSON `null` matching neither.
- A container never converts to a number. This needs `strict $.double()` on
  PostgreSQL: a jsonpath in the default **lax** mode auto-unwraps arrays, so
  `[1, 2]` converts to `1` and matches a comparison against a number the row
  does not hold.
- A JSON value is compared as the value it holds, never as its JSON *rendering*.
  Both backends offer two accessors, and the difference is invisible in the
  compiled SQL until a row exists: the structure-preserving one (`->` /
  `json_quote`) renders the string `yes` as `"yes"` and an absent key as the
  text `'null'`, so `x == 'yes'` and `x is None` are false for every row that
  should match. Only the extracting accessor (`#>>` / `->>` on PostgreSQL, a
  bare `json_extract` on SQLite) is correct for comparison. This is the
  cheapest defect in the language to introduce and the most expensive to
  notice, because nothing errors — the filter simply returns nothing.
- `x is None` means **no usable value at that path**: a stored JSON `null` and
  an absent key both satisfy it, and neither dialect can separate them once the
  value is extracted. This is a deliberate conflation, not an accident of
  implementation — it is the only reading both backends can express, and it is
  what someone typing `is None` into a filter field means. A predicate that
  appears to distinguish the two is evidence of a structure-preserving accessor,
  which is wrong for comparison for the reasons above.

Not guaranteed:

- **JSON booleans compared as numbers.** SQLite's `json_extract` collapses JSON
  `true` to the integer `1`, so `metadata['x'] >= 0` matches a boolean there and
  not on PostgreSQL. The distinction is destroyed before the conversion sees
  the value — `json_type` can recover it only when given the original column
  *and* path — so closing this means passing the path down rather than the
  extracted value.
- **JSON booleans rendered as text.** The same collapse with the opposite sign:
  extracted as text, `true` reads as `true` on PostgreSQL and as `1` on SQLite,
  so a substring test against a boolean reaches it on one backend only.
- **A JSON value compared for equality against a string literal.** PostgreSQL
  extracts to text, so a stored `1` matches `'1'`; SQLite extracts a native
  number, and its type rules make `1 = '1'` false. A stored JSON *string*
  matches on both, so this is confined to values whose JSON type differs from
  the literal's — which is to say, to exactly the rows a schemaless column is
  likely to hold. Substring search (`in`) agrees on both and is the portable way
  to ask.
- **Two JSON values compared for equality.** A literal fixes the type of
  the comparison; a second JSON value fixes nothing, so `==`/`!=` happen
  in whatever type extraction produced. PostgreSQL compares jsonb text, where
  object key order is canonical but `1` and `1.0` are different strings; SQLite
  compares native values, where `1 == 1.0` holds and `true` has already become
  `1`. All three cases disagree, in both directions. Note that comparing a key
  against *itself* is unaffected — both sides render identically whatever the
  rule — and is only ever an expensive spelling of `is not None`. (*Ordered*
  comparison between two JSON values does not share this fate: it is defined
  numerically via `SafeJsonFloat` on both sides — see
  [Unknown types](#unknown-types) — precisely because text ordering would
  invert numeric order rather than merely skew edge cases.)
- **Row-level ordering and collation.** String comparison collation differs.
- **Numeric precision.** PostgreSQL `NUMERIC` vs SQLite `REAL`.
- **NULL sort position** in downstream `ORDER BY`.

The last is a general hazard worth naming: **a conversion pipeline can destroy
the information a later stage needs to decide correctly.** Once the extraction
step has mapped two distinct JSON types onto one SQL value, no amount of care
downstream can tell them apart.

Divergence here is the most expensive kind of defect this language can have: the
same condition can crash one backend and return silently wrong rows on the
other. Any new coercion must be **executed** against both before it lands —
compiling against both is not sufficient, for the reasons in
[Validation Is Not Execution](#validation-is-not-execution).

The guarantees above only hold on versions where the JSON facilities they rely
on exist, so the oldest supported PostgreSQL is part of this contract and should
be stated rather than inferred from whatever CI happens to pin.

---

## Root-Span Scope Analysis

`root_span_scope(condition)` reports, from the condition alone, whether every
matching row is guaranteed to be a root span. It answers one of:

| Verdict | Meaning |
|---|---|
| `"strict"` | only spans with no parent pointer (`parent_id is None`) |
| `"orphan_aware"` | no parent pointer, **or** a pointer to a span absent from the table |
| `None` | cannot tell |

`strict` is a subset of `orphan_aware`. The analysis is **sound, not complete**:
`None` is always a safe answer, and the verdict never over-claims. A disjunction
that admits non-root spans yields `None`.

Two consumers depend on it: the UI, to choose between cumulative and per-span
metric columns; and the query builder, to drop a redundant `root_spans_only`
flag rather than pay for two correlated subqueries.

Because it is derived from the condition text, **a stored condition's scope
verdict is part of its observable meaning.** Changing the analysis changes how
stored conditions render.

---

## Validation Is Not Execution

`validateSpanFilterCondition` parses, validates, translates, and compiles to SQL
text. Compiling is not executing, and the gap is real:

- PostgreSQL type errors surface at **plan** time, which compilation never
  reaches. This was the original crash: `AND (attributes #> '{r}')` compiles
  cleanly and is then rejected as `argument of AND must be type boolean, not
  type jsonb`.
- Parameter **binding** errors surface at execution. `cast('100', Float)`
  compiles on both dialects, then fails because asyncpg will not encode a `str`
  as a float parameter.
- Data-dependent failures cannot be caught statically at all. A cast that
  succeeds on every row in one project may fail in another.

Consequences for design and testing:

1. **A test that only constructs a `SpanFilter` proves very little.** It
   exercises parsing and validation and says nothing about the three layers
   below. Coercion changes need execution-level tests that assert returned rows.
2. **The UI cannot rely on validation alone.** The spans and traces tabs wrap
   their content in an `ErrorBoundary` whose fallback re-renders the filter
   field, so a condition that passes validation and still fails leaves the user
   able to edit it rather than staring at a dead page.

`EXPLAIN` was evaluated as a validation strategy and rejected as the primary
mechanism: it is useless on SQLite (no type checking), speaks in SQL the user
never wrote, guards only the GraphQL path, and duplicates work at apply time. It
is genuinely useful as a **differential test oracle** — asserting that our
validator and PostgreSQL agree on a generated corpus — which is not yet built.

---

## Persistence Contract

### What is stored

The **condition string**, canonicalized. `SpanFilter` strips surrounding
whitespace at construction, so `to_dict()` emits that normalized text and
`from_dict` round-trips it exactly. Stripping is the only normalization
performed — see [Stored text must be canonical](#stored-text-must-be-canonical)
for what remains textually distinct.

No parsed or compiled form is persisted, and none should be: the AST and
generated SQL are implementation details that change between releases.

### What can break a stored condition

Ordered by how quietly it fails.

**1. Silent — annotation names.** A stored condition referencing
`annotations['quality']` stays valid forever if that annotation is renamed or
deleted; it simply matches nothing. This is deliberate — see Known Gaps: a
validation-time name check would make validity depend on the live annotation
table, and the dormant hook for one was removed. A stored filter can
therefore rot into a silently-empty result; the persistence-era mitigation is
advisory (warn at save or read time), not rejection.

**2. Silent — attribute paths.** Schemaless by definition. `attributes['x']` is
never invalid, only empty. Instrumentation changes do not invalidate conditions;
they change what they match.

**3. Silent — root-scope analysis.** Changing `root_span_scope` changes which
metric columns a stored condition renders, without changing the condition.

**4. Loud — grammar tightening.** Any strictness increase invalidates stored
rows wholesale. This is the one failure mode the additive-only policy exists to
forbid, which is why the set of accepted forms has to be settled before the
first condition is written.

**5. Silent, then loud — new reserved names.** Bare identifiers fall back to the
attribute namespace, so reserving a name that was previously a valid attribute
reference changes what existing conditions mean, or begins rejecting them. New
*operators* are safe; new *vocabulary* is not.

**6. Loud — removing a backward-compatibility alias.** The five aliases above
are the only reason conditions written against the older spellings still parse.

**7. Environment-dependent — dialect migration.** A condition stored while
running on SQLite may fail on PostgreSQL afterwards, since the looser backend
accepts constructs the stricter one rejects. Validity is not a property of the
condition alone until both backends agree on it.

### The compatibility policy: additive only

**There is no grammar version, and there will not be one.**

Not because a version could not travel — stored rows can carry a column, URLs
a parameter, the text an inline envelope. The reason is an invariant worth
more than the mechanism: **condition text is context-free.** The same string
means the same thing typed into a filter box, embedded in a URL, stored on a
row, or sent by a client, and it survives copying between those contexts —
which is how conditions actually move. A version travels in an envelope, and
copying separates text from envelope constantly; the first unversioned paste
re-creates every problem the version was meant to solve, now with two grammars
in play. Freezing the grammar costs less than versioning every channel a
string can cross.

So the grammar evolves **additively**: nothing already accepted may be removed
or given a different meaning. Internal structure — the translator, the planner,
the generated SQL — is free to change. Accepted text and its meaning are not.

One qualification, load-bearing enough to state as policy: **the promise
assumes accepted text *has* a meaning, and some of it does not.** The
[Known Gaps](#known-gaps) and the "not guaranteed" list in
[Dialect Semantics](#dialect-semantics) enumerate shapes that are accepted
while returning different rows per backend. For those there is no single
meaning to preserve, and this policy takes the position that **defining one
later is not a breaking change**: divergent-accepted text is semantically
undefined, later definition is a repair, and the ordered-comparison fix (text
order on one backend, numeric on the other, later defined as numeric on both)
is the precedent. The obligation this creates is enumeration — a divergent
shape not on the list is a shape someone will treat as defined — and each
repair must be executed on both backends before it lands. Classification is
the gate, not observation: text merely *seen* to fail is not thereby
undefined — proving universal failure across data, drivers, and versions is
harder than it looks, and a shape that executes successfully anywhere has a
meaning someone may depend on. Only enumerated shapes are eligible.

What "additive" covers is narrower than it first appears:

| Change | Safe? |
|---|---|
| New operator, new literal form, new syntax | **Yes** — previously rejected text becomes accepted |
| New annotation member, new cast function | **Yes** — same reason |
| **New field name** | **No** — see below |
| Removing or restricting anything | **No** |

**A new field name is a breaking change, not an addition.** Bare identifiers
fall back to the attribute namespace, so `foo` already means
`attributes['foo']` for every `foo` that is not currently a field. Promoting any
name to a field silently changes what existing conditions mean — they do not
begin failing, they begin selecting different rows.

A new name is therefore only safe if it **cannot collide**: introduced under a
namespace no attribute path can reach (a prefix, or a required accessor such as
`span.new_field`), or verified against the fact that no stored condition uses it
— which stops being verifiable the moment conditions live in a database owned by
someone else.

If the vocabulary is expected to grow, the structural fix is to stop resolving
bare unknown identifiers at all and require `attributes['foo']` explicitly. That
is a restriction, so it is available only before persistence.

### The tightening window closes at persistence

The policy has a consequence worth stating plainly, because it is time-boxed.

A restriction is only a breaking change *once conditions are stored*. Before
that, it invalidates text a user can retype; after, it invalidates data. So the
set of things this language will accept forever is fixed on the day the first
condition is written to the database, whether or not anyone decides it that day.

One honesty about the clock: Phoenix's database is not the only place these
strings live. They already sit in URLs, browser history, `localStorage`
suggestion lists, client code calling `SpanQuery`, and whatever external
systems users have saved them into — the language has been public since it
shipped, and every tightening in this hardening pass already invalidated some
text somewhere. The window framing holds because those copies are *retypable*:
the cost of a pre-persistence restriction is a user editing a string, not a
migration. What closes the window is Phoenix taking *custody* — storing
conditions it must keep honoring. That custody moment should be a **declared
release** ("as of X, accepted defined expressions are additive-only"), not
silently the timestamp of the first stored row, so that everyone can point at
the release notes rather than at a database.

**Anything that should be rejected has to be rejected before then.** Afterwards
the only available response to a bad construct is to keep accepting it — which
makes the final pre-persistence review the last chance to ask, of every accepted
form, whether it can be evaluated honestly on both backends.

### Complexity is unbounded

Nothing in the grammar or the persistence path limits how expensive a condition
may be. The only ceiling today is CPython's parser, which rejects roughly 500
nested parentheses, and the recursion guard, which converts stack exhaustion
into a `SpanFilterError`. Both are accidents of the host, not policy.

The cost that matters is joins. Each **distinct annotation name** adds one
aliased `LEFT OUTER JOIN` against `span_annotations`, with no cap:

| Distinct names | Joins | Condition | Generated SQL |
|---|---|---|---|
| 1 | 1 | 27 B | 224 B |
| 5 | 5 | 155 B | 1.0 KB |
| 25 | 25 | 810 B | 5.0 KB |
| 100 | 100 | 3.3 KB | 20 KB |

A transient filter that someone typed is self-limiting — they are waiting for
it. A **persisted** one is not: it can be applied automatically, on page load,
across every view that inherits the saved object, by users who did not write it
and cannot see its cost.

Before conditions become durable, bound at least:

- **byte length** of the condition text
- **distinct annotation names**, which is the join count
- **AST node count**, as a proxy for total work
- **nesting depth**, explicitly rather than via the parser's limit

These bounds are a requirement of the storage format, not optional follow-up
hardening — but their *values* should come from measurement (the join table
above is the start of one), not be invented in a document. What this spec can
fix is the obligation and the deadline; the numbers belong to the persistence
change, with the evidence attached.

Persistence is the deadline, not the beginning of exposure: GraphQL and
client callers can already submit arbitrarily long source, wide and deep
ASTs, and unbounded annotation-join fan-out on every request, so the limits
are an *availability* control that persistence merely makes non-optional.
Message truncation bounds what comes back, not what parsing, translation,
compilation, and the join build cost on the way in.

Limits are a restriction, so they are subject to the same window as everything
else: a bound introduced after conditions are stored can invalidate saved rows.

### Stored text must be canonical

`to_dict()` emits `condition`, and `SpanFilter` normalizes that field at
construction by stripping surrounding whitespace — so the stored form is the
canonical one and `"  x == 1  "` and `"x == 1"` serialize identically.

That is the *only* normalization performed. Everything else that differs
textually but not semantically remains distinct:

```
name == 'a'          vs   name=='a'          (spacing)
name == 'a'          vs   'a' == name        (operand order)
a == 1 and b == 2    vs   b == 2 and a == 1  (conjunct order)
"x"                  vs   'x'                (quote style)
```

Persistence has to decide what identity means, and the answer differs by use:

- **Deduplication and caching** need a canonical form. Textual identity will
  treat the pairs above as distinct and cache them separately.
- **Audit history and display** need the raw text. A user who saved `name=='a'`
  should not find it rewritten.
- **Migration** needs whichever form the grammar is checked against.

The cheapest defensible answer is to store raw text as written and derive a
canonical key for dedup and caching — `ast.unparse` of the validated tree is
already available and normalizes spacing and quoting, though not operand or
conjunct order. Choosing "raw text is identity" is also defensible, but it
should be chosen rather than inherited.

Note that a half-choice has already been made: construction strips surrounding
whitespace, so one dimension of textual identity is normalized while the
others are not. That is defensible on its own terms (it fixes a poor
`IndentationError` and keeps `to_dict` output canonical), but it means "raw
text as written" is already not quite what is stored, and the persistence
decision should be made knowing it.

### Recommendations for the persistence work

- **Validate on read, and degrade visibly.** A stored condition that no longer
  parses should surface as a repairable error attached to the saved object — not
  as a crash, and not as a silently absent filter.
- **Decide the policy for vanished annotation names** before shipping. Options:
  leave silent (status quo), validate on read against the project's current
  names, or warn at save time only.
- **Never persist generated SQL or a parsed form.** Only the source text is
  stable across releases; the AST and SQL are implementation details.
- **Pin or test the dialect.** A condition stored while running on SQLite may
  fail after a migration to PostgreSQL, because SQLite accepts constructs the
  stricter backend rejects.
- **Choose the vocabulary-extension strategy before shipping.** Bare unknown
  identifiers resolve to attributes, so a first-class field can never again be
  added under the current resolution rule without changing stored meanings
  (see principle 6). If the field vocabulary is expected to grow — and
  observability schemas do — the strategy (a namespace such as
  `span.<field>`, or freezing the vocabulary outright) has to be picked while
  choosing is still possible.

---

## Design Principles

These follow from what this language is: a user-facing surface, borrowed from a
host grammar, compiled to two SQL dialects, over partly schemaless data, whose
accepted text becomes durable — and whose compiled form is executed by the host
language's `eval`. Each constraint below is a consequence of one of those six
facts.

### Decomposing the problem: the failure-time ladder

A condition can fail at five distinct moments, and *which* moment decides how
cheap the failure is, how precisely it can be explained, and who sees it.

| # | Moment | Knows about | Failure looks like |
|---|---|---|---|
| 1 | **Parse** | text | `SyntaxError`, points at a character |
| 2 | **Validate** | shapes, static types | our message, names the fragment |
| 3 | **Plan** | column types, per dialect | DB type error, references SQL the user never wrote |
| 4 | **Bind** | driver encoding | driver error, references a parameter index |
| 5 | **Execute** | actual row values | data-dependent; fails for some projects and not others |
| — | **Result** | — | *nothing fails.* The query succeeds and the answer is wrong |

The ladder is the decomposition. Almost every bug in this module was a
condition that *should* have failed at 1–2 and instead failed at 3–5.

- `X and r` — should fail at 2 (not a boolean), failed at 3.
- `latency_ms > '100'` — should fail at 2 (type mismatch), failed at 4.
- `label == 100` — should fail at 2 (type mismatch), failed at 5, and only when
  a non-numeric label happened to be in range.

**The last row is not a sixth layer; it is the absence of one.** A translation
can be well-formed at every layer and still mean something other than what was
written — comparing a value against its own JSON rendering, extracting through
the wrong accessor, applying a predicate to a container. Nothing raises,
because nothing is malformed. The condition is valid, the SQL is valid, the
query plans and runs, and it returns the wrong rows.

This defeats the rule that organizes the rest of this document. "Fail at the
earliest layer that can know" offers nothing when there is no failure to move
earlier, and a wrong translation is *more* dangerous than a broken one: a
statement that cannot execute announces itself the first time anyone runs it,
while one that executes cleanly can be wrong in production indefinitely. It is
also symmetric in a way that hides it — a comparison that never matches gives an
empty table, which reads as "no such spans," and its negation over-matches,
which reads as a working filter.

The primary detector is a returned row set compared against an expected one;
validation, totality, static analysis, snapshots, and compiling against both
dialects are all blind to it by construction. It is not quite the *only*
detector: algebraic laws the language must satisfy — a predicate and its
negation partition the non-NULL rows, adding a conjunct never grows the set —
catch wrong translations without an authored expectation, which matters because
an authored expectation shares its author's misunderstanding (see principle
11). One such law is already enforced
(`test_equality_and_inequality_still_partition`); the family deserves to grow.

### 1. Fail at the earliest layer that can know

Every layer must be a filter for the next: reject anything the layer below
cannot handle honestly. A failure that escapes to layer 3 or beyond is not just
uglier — it is *categorically* worse:

- it arrives after the UI has committed to a query
- it speaks in generated SQL, which the user cannot map back to what they typed
- at layer 5 it is data-dependent, so it reproduces in one project and not
  another, and no test fixture reliably catches it

This is also why `EXPLAIN`-at-validation was rejected as a strategy: it moves
detection to layer 3 instead of doing the work at layer 2, and it is a no-op on
SQLite, so it cannot be the *only* mechanism.

This principle is time-boxed by the compatibility policy. Moving a failure
earlier is a restriction, and restrictions end when conditions persist — so
"fail at the earliest layer" is a *pre-persistence* discipline. Afterwards, a
newly discovered defect in an accepted shape cannot be rejected into an earlier
layer; the remaining tools are the next principle's totality and the
defined-divergence clause of the [compatibility
policy](#the-compatibility-policy-additive-only).

### 2. What cannot be known statically must be made total

Some things genuinely cannot be decided before the rows are read. Attribute
values are schemaless; `attributes['x']` has no type until you look.

For those, there are exactly two acceptable designs — **reject statically**, or
**make the operation total** so it can never abort. `SafeJsonFloat` and
`SafeJsonBoolean` take the second: an unconvertible value yields `NULL` and its
row drops out.

The unacceptable middle is a partial operation that aborts at layer 5. That is
the worst of both: it passes every static check, works in development, and fails
on a customer's data.

Totality is harder to hold onto than to introduce, in two ways that have both
bitten:

**It must be gated by type, and the gate must survive derivation.** A safe
conversion belongs only where the unsafe case exists. Applying `SafeJsonFloat`
to something already numeric produces
`jsonb_path_query_first(numeric, …) does not exist` — the wrapper meant to
prevent failure becomes the failure. The gate is the operand's type, so every
*derived* node has to report one: a node that says "unknown" when its operand
was numeric silently re-enables the wrapper.

**It is a property of the composition, not of the leaf.** `-attributes['x']`
was converted after negation, and no backend defines unary minus on a JSON
value. The conversion has to happen at the innermost point where the value
stops being JSON, not wherever the cast happens to be applied. A total leaf
inside a partial expression is still partial.

Totality also has a requirement the first two do not imply: **it must be
observable, or it converts type errors into silent filter narrowing.** A row
dropped because its value would not convert is indistinguishable from a row
that did not match, and the NULL a failed conversion produces then flows into
three-valued logic — `not (attributes['x'] > 5)` excludes every row where `x`
holds text, compounding the two mechanisms into exactly the wrong-rows failure
the ladder's Result row describes. Nothing in the language today can tell the
user this happened. The normative requirement this creates sits on the
*contract*, not the UI: the NULL truth table — what a failed conversion
contributes under `not`, `and`, `or` — must be defined and tested rather than
inherited from whatever SQLAlchemy emits. Surfacing conversion drops to users
(counts, warnings) is a separate product decision with real costs, worth
weighing but not presumed. Either way, totality should be understood as
trading a loud per-row failure for a quiet semantic one, and chosen with that
trade in view.

### 3. Reject rather than coerce, when the types are known

Coercion hides intent; rejection reveals it. When both sides are statically
typed there is nothing to infer, so a coercion is a guess about what the user
meant — and it is usually wrong, because the dominant input to a filter field is
not a considered expression but a **half-typed one**.

`name == 'x' and r` is overwhelmingly "user is mid-keystroke", not "user wants
rows where attribute `r` is truthy". Coercing that to truthiness produces
plausible-looking wrong rows. Rejecting produces a message.

Corollary: **never implicitly coerce to boolean.** The host language has
two-valued truthiness, SQL has three-valued logic, and JSON adds a fourth state
(absent). Any implicit bridge between them is a bug generator. This DSL offers
no `bool()` for the same reason.

Stated absolutely, the rule overreaches, and grading the apparent exceptions
sharpens it. A numeric string inside `float()` is not a coercion at all — the
user *requested* the conversion. The datetime literal rule is contextual
typing, part of the documented grammar: a string beside a datetime field has
exactly one sensible reading. `int()` behaving as `float()` is a documented
misnomer, not a conversion decision. The one genuinely implicit coercion is
the case-folding of literals against `span_kind` / `status_code`, which
rewrites what the user typed with no syntactic signal — and it is the one
that went undocumented for a while, which is the failure mode: an implicit
coercion nobody wrote down is a meaning change waiting to be "fixed." The
rule, made precise: **reject when intent is ambiguous; convert on request or
on unambiguous context; and the moment a conversion is implicit, document it
as semantics**, because it changes what accepted text means and is therefore
under the compatibility policy, not an implementation detail.

### 4. The permissive backend is the dangerous one

When a condition is malformed in a way neither the parser nor the validator
catches, the two backends do not fail alike:

| `name == 'n' and r` | |
|---|---|
| PostgreSQL | aborts the statement |
| SQLite | returns **zero rows**, no error |

SQLite is the default for local development, so this class of defect is written
against the backend that hides it and observed only against the one that does
not. An empty table reads as "the filter matched nothing", which is a plausible
enough answer to stop investigating. The strict backend is where such a bug is
*visible*; the permissive backend is where it gets *written*.

Three practical consequences:

- **Any coercion or cast change must be executed on both backends before it
  lands.** Compiling on both is not enough (see 1).
- **Silently-wrong is worse than loudly-broken.** When the two dialects
  disagree, prefer the behavior that fails, and make the validator reject the
  input on *both* so they agree again.
- **The environment must enforce what the principle preaches.** Local
  development defaults to the permissive backend and local runs routinely skip
  the strict one, so the discipline lives or dies in CI: the PostgreSQL jobs
  are not an extra check but the only place this entire defect class is
  visible at all.

### 5. A host-language parser is a liability, not a grammar

Using `ast.parse` is enormously convenient and quietly hands your users
everything Python accepts: bytes literals, complex numbers, `Ellipsis`,
`~`, `**`, walrus, comprehensions, NFKC identifier normalization. None of it was
designed for; all of it was admitted.

If the surface is borrowed, the grammar must be an **allowlist**, never a
denylist. Every node type, every operator, every literal type is opt-in. A
denylist is a permanent backlog of things you have not thought of yet — and
under an additive-only policy, each one you miss becomes permanent.

The rule applies to the *surface validator itself*, and this codebase has
violated it there: rejecting Python constructs via an enumerated `isinstance`
chain is a denylist wearing validation's clothes, and it missed the walrus
operator in the experiment filter for exactly the predicted reason — nobody
had thought of it yet. The catch-all boundary made the miss survivable, not
invisible: the condition was reported as a server fault and logged in full. A
structural walk that rejects every node type not in an approved set makes the
next unconsidered construct unreachable by construction. Both validators now
end in that default-deny floor (`_ALLOWED_PYTHON_SURFACE` on the experiment
side), with the named rejections kept above it for message quality — the
enumeration now buys better errors, not correctness.

### 6. Every new *name* is a breaking change; new *operators* are not

This one is easy to miss and expensive.

Bare identifiers fall back to the dynamic namespace: `foo` means
`attributes['foo']`. So **adding a reserved name silently changes the meaning of
every stored condition that used it as an attribute.** When `parent_span` became
reserved, any condition filtering on an attribute of that name changed meaning —
it did not error, it started meaning something else.

Under additive-only, adding syntax is safe and adding *vocabulary* is not. The
structural fix, if the namespace is ever expected to grow, is to require explicit
syntax for dynamic access (`attributes['foo']`) and stop resolving bare unknowns
— which is itself a restriction, so it has to happen before persistence or not
at all.

### 7. Error messages are the product surface, not diagnostics

The users in the original reports pasted walls of PostgreSQL error text as the
*symptom*. The message is what the filter field renders; it is the entire
experience of getting it wrong.

Practical rules learned here:

- **Name the offending fragment**, not the category:
  `` `r` is not a condition `` beats `logical operands must be boolean`.
- **Suggest the repair, but only when it is actually valid.** The hint "write
  100 instead of '100'" is only emitted when the string is numeric — an earlier
  version rendered `write  instead of ''`.
- **Never surface generated SQL.** The user did not write it and cannot act on
  it.
- If the UI renders them, messages are **part of the product** — but the
  stability contract belongs on error *categories*, not prose. Freezing
  wording "as much as the grammar" would forbid exactly the improvements this
  principle demands; a stable category or code lets the words get better
  without breaking anything that matches on them. No category field exists
  yet, so today every wording change is de facto breaking for whatever
  string-matches — an argument for adding one, not for freezing the prose.
- **Echoed fragments need bounds — at two layers.** Naming the offending
  fragment means reflecting user-controlled text into the UI, logs, and
  GraphQL responses. A single whole-message truncation at the boundary is not
  enough: many messages put the fragment *before* the advice
  (`` `<expr>` is not a condition, expected … ``), and tail truncation there
  eats the guidance — a 1000-character literal in boolean position once
  yielded 300 characters of echo and no "expected a comparison" at all. So
  fragment-first sites bound the fragment itself (80 chars), and the error
  boundary bounds the whole message (300 chars) as the backstop for any site
  that forgets — a forgotten site now ships a worse message, never an
  unbounded echo. The log path is bounded too: the catch-all's condition echo
  goes through the same helper. CPython's own 4300-digit parse guard is
  reworded at the boundary: its message advises
  `sys.set_int_max_str_digits()`, which is Python's remedy, not the
  condition's.

### 8. Static analysis of the condition is part of its meaning

`root_span_scope` looks like an optimization — it decides whether the UI shows
cumulative or per-span metric columns. But it is derived from the condition
text, so **changing the analysis changes what a stored condition renders**,
without changing the condition.

Anything that reads the expression and alters observable behavior is semantics,
and belongs under the same compatibility policy as the grammar.

Keeping the analysis **sound but incomplete** — `None`/"cannot tell" always a
safe answer — is what makes it *improvable at all*, but it does not make
improvements free. A `None` → `strict` verdict changes which metric columns the
UI renders for a condition someone already saved. The row set is unaffected;
what the user sees is not.

So the honest classification is: **scope verdicts are row-stable but not
presentation-stable, and are therefore not compatibility-stable.** Three
positions are available, and one has to be chosen deliberately rather than
assumed:

1. **Freeze non-`None` verdicts.** An expression that reports `strict` or
   `orphan_aware` keeps that verdict forever; only `None` may be refined. Costs
   the least, still changes presentation for refined conditions.
2. **Version the analysis** alongside the stored condition, so a saved view can
   pin the verdict it was created under. The only option that is fully stable,
   and the only one that needs a schema column.
3. **Accept the instability explicitly** and document that metric-column
   selection may change as the analyzer improves.

What is *not* available is treating refinement as silently additive. Soundness
guarantees the rows are right; it says nothing about the columns.

Until the persistence work chooses, position 3 is the *de facto* state and
should be treated as chosen: verdicts may change as the analyzer improves, and
saved views inherit the change. The principle also reaches further than
`root_span_scope`: anything that reads condition text and alters observable
behavior is under it, including the client's mount-time seed classification
(`spanFilterSeed.ts`) — an analyzer that lives outside this module, is written
in another language, and is currently under no compatibility policy at all.

### 9. Test at the layer where the failure lives

A test that only constructs a `SpanFilter` exercises layers 1–2 and proves
nothing about 3–5. A construction test asserting that some condition "is valid"
can therefore pass indefinitely while that condition is broken on one backend —
it encodes a belief about the language, not an observation of it.

- Grammar rules → construct and assert the message.
- Coercion, casts, translation → **execute** and assert returned rows, on both
  backends.
- Anything data-dependent → execute against deliberately hostile rows.

The fixture matters as much as the assertion. A clean fixture never exercises a
cast, and an *empty* one exercises nothing at all: a per-row failure cannot occur
where there are no rows, so a data-dependent bug passes every check against an
empty project. Fixtures for this module should contain values chosen to break
things — unconvertible text where numbers are expected, all three JSON boolean
encodings, nulls, containers where scalars are expected, multi-byte names.

The highest-yield shape is **one key whose JSON type differs on every row** —
number, numeric string, non-numeric string, boolean, null, array, object,
absent. Ten spans with varied attributes found nothing; a single key with nine
shapes found a cross-dialect divergence immediately, because every conversion
path meets every input in one query.

The anecdote generalizes to a rule the suite should enforce rather than
remember: **every conversion path must meet every JSON shape — operator ×
operand-type-pair × dialect, executed.** The nine-shape key found the equality
divergence because it happened to complete that product for `==`; ordered
comparison between two JSON operands escaped until much later because nothing
demanded the product be complete. A coverage matrix is checkable; an
instructive story is not.

**Snapshot tests are the seductive case.** They look like verification and are
not: a snapshot records the SQL we *generate*, never whether that SQL *runs*.
Three separate snapshots — all in the sibling experiment-filter suite, which
leans on snapshots more heavily than this one — recorded PostgreSQL that
cannot execute: `X IS Y` between two expressions, a raw `CAST(jsonb AS
FLOAT)`, and `-'hello'`, each passing for as long as it existed. A snapshot is a
change-detector for the compiler, and it is worth having as that; it is not
evidence that anything works.

Worse than SQL that cannot execute is SQL that executes and answers wrongly —
the **Result** row of the ladder. A snapshot pinning a string comparison against
a JSON value was reviewed, approved, and correct as a record of the compiler,
while the comparison it pinned matched no row on either backend. Nothing in a
snapshot can catch this, because the snapshot's subject is the artifact and the
defect is in what the artifact *means*. A suite can be large, green, and
entirely silent about whether a single filter returns the right rows; the
absence of an executing test is invisible in a pass count.

### 10. Reason about databases by running them

Database behavior is unusually resistant to reasoning from the outside. Casts,
JSON functions, and type coercion are version-dependent, dialect-dependent, and
full of rules that are individually sensible and jointly unguessable — whether a
cast exists at all, whether it folds at plan time or evaluates per row, whether
an error is raised or a `NULL` returned.

A plausible chain of reasoning about any of these is worth roughly nothing
against thirty seconds of running the query. Where this document asserts backend
behavior, it is because someone executed it — and on the **oldest supported
version**, since that is where a guarantee actually has to hold and where the
function you are relying on may simply not exist yet.

The same applies to reviews and bug reports about this module, from any source:
a claim about what a database does is a hypothesis until it has been run on both
backends.

The claim decays without enforcement. "Verified on 12" is true the day someone
runs it and unverifiable thereafter unless the floor version is a permanent CI
job — and the SQLite side needs its own pin, since "the bundled `sqlean`
build" is a version claim too. A guarantee that lives in a document ages; one
that lives in CI does not.

### 11. Agreement is a stronger property than success

"Runs without error on both backends" and "returns the same rows on both
backends" are different claims, and only the second is what this language
promises. The gap between them is where the subtlest defects live: a query that
succeeds everywhere while quietly meaning something different per backend
raises nothing to notice.

A probe over hostile rows reported no errors on either backend and was taken as
confirmation. Asserting the *row sets* over the same data then showed
`metadata['x'] == 1` matching a JSON `true` on SQLite and a JSON `[1, 2]` on
PostgreSQL — two independent defects pointing opposite ways, both invisible to
the error check.

This also decides how to assert it. Comparing the two backends *to each other*
is weaker than it looks: it passes whenever both are wrong in the same way. A
**fixed expected result, checked on each backend**, catches divergence and
shared defects alike — so the cross-dialect guarantee is best enforced by
ordinary parametrized tests run under both dialects, not by a comparison
harness.

A fixed expectation has its own blind spot: it is authored by the same person
who wrote the translation, so a shared misunderstanding pins wrong behavior
green — which is how a reviewed, approved snapshot came to certify a
comparison that matched no rows. The complement is the algebraic-law family
from the ladder's Result discussion: laws are authored against the *language*,
not against any particular translation, so they fail when author and
translator are wrong together.

### 12. Two encodings of one rule will drift; pin them to each other

Failing at the earliest layer (principle 1) has a structural cost: the
validator must know what the translator will do, so every rule ends up encoded
twice — once as a check, once as behavior. The two drift. The validator
accepted `float('1e400')` by checking the *spelling* of a numeric string while
the literal rule rejected the *value* `1e400`; a comment in the translator
claimed a shape reached the float path that actually compiled as text. Each
was two encodings of one rule disagreeing.

The remedies, in order of strength: derive both encodings from one source (a
shared predicate, a shared table); where that is not practical, pin them
against each other with a conformance test that exercises the rule through
both; at minimum, colocate them so a change to one is a diff next to the
other. What is not acceptable is the default that produced the drift —
trusting the two to be maintained in sympathy by whoever edits either.

### 13. The evaluation namespace is an attack surface

The compiled expression is executed by the host language's `eval`, with
`__builtins__` pinned to an empty dict and a namespace containing exactly the
names the translation needs. That sandbox closed a real hole — builtins
reachable from a filter string — and nothing about its current shape
advertises how load-bearing it is: the pinning is one dict literal, the
namespace allowlist is one mapping, and either can be "simplified" away in a
refactor that passes every grammar test. Any change to how the compiled
expression is evaluated is a security change, whatever it looks like. If the
evaluation strategy is ever revisited, the sandbox properties — no builtins,
nothing user-controlled resolving to a callable, nothing reachable outside the
namespace — are the requirements; `eval` is merely the current implementation.

### Subtly overlooked

Things that are easy to leave unspecified until they bite:

- **Three-valued logic.** `NULL` is neither true nor false, so a predicate and
  its negation do not partition the table. Measured against 10 spans, 4 of which
  have a NULL or absent annotation score:

  ```
  annotations['quality'].score == 0.1         ->  1 row
  annotations['quality'].score != 0.1         ->  5 rows
  not (annotations['quality'].score == 0.1)   ->  5 rows      (4 rows in neither)
  ```

  A user reading `not (score == 0.1)` as "everything else" is wrong by the
  number of NULLs. Decide and *test* the null truth table rather than inheriting
  whatever SQLAlchemy happens to emit, and consider whether the UI should say
  so.
- **Collation and numeric precision.** String ordering and float precision
  differ between backends. Currently unspecified here, which means
  `name < 'x'` is not guaranteed portable.
- **Identity vs equality.** Host languages have `is`; SQL has no identity
  comparison. Only the singletons bridge.
- **Time zones.** A naive datetime is not a time. Requiring an offset is the
  only reading that cannot silently mean different instants in different
  deployments.
- **Text splicing must agree with the tokenizer.** Anything that edits source by
  offset needs the same line and byte model the parser used — `str.splitlines`
  breaks on characters the tokenizer does not treat as newlines.
- **Sibling languages share defects.** The experiment-run filter is a separate
  implementation of the same idea — a Python grammar borrowed from `ast`,
  compiled to the same two dialects — and independently had the non-boolean
  operand hole, comparisons between incompatible types, JSON compared against
  its own rendering, and the whole inherited literal and operator surface. None
  of these transferred when they were fixed here, because nothing connects the
  two. A fix to shared machinery needs regression coverage on every grain that
  uses it, and a fix to *duplicated* machinery needs porting by hand. The
  codebase already trends toward the stronger fix — the dialect-sensitive
  constructs (`SafeJsonFloat`, `SafeJsonBoolean`, `TextContains`) are shared
  compiled elements serving both DSLs — but nothing demands it. The rule worth
  stating: new dialect-sensitive behavior belongs in a shared element both
  languages compile to, so the next divergence is a missing call site rather
  than a missing reimplementation.

### A checklist for changing this language

1. Which layer of the ladder rejects it? Can an earlier one?
2. Do both backends return the **same rows** — executed, not compiled, and
   compared by result rather than by absence of error?
3. If it cannot be decided statically, is it total — and is the conversion
   gated by type, and applied at the innermost point where the value stops
   being JSON?
4. Is it a new *name*? Then it changes the meaning of existing conditions.
5. Is it a restriction? Then it is only possible before persistence ships.
6. What does the error say, and is the suggestion always valid?
7. Does it change what `root_span_scope` reports?
8. Does the experiment-run filter have the same defect? It is a separate
   implementation, so a fix here does not reach it.
9. If a snapshot changed, has the new SQL been *run* on both backends?
10. Does the rule now exist in two encodings — a check and a behavior? What
    pins them together?
11. What does it cost at scale, and is the cost bounded by policy rather than
    by the host's accidents?
12. Does it touch how the compiled expression is evaluated? Then it is a
    security change, whatever it looks like.
13. If it defines meaning for a previously divergent shape, is the shape in
    the divergence enumeration, and is the new meaning executed on both
    backends?

## Error Messages

Messages are user-facing: the frontend renders `errorMessage` verbatim in the
filter field's error badge and tooltip. They should name the offending fragment
and, where possible, suggest the repair.

| Situation | Message |
|---|---|
| Value in boolean position | ``​`r` is not a condition, expected a comparison such as `r == ...`​`` |
| Mismatched comparison | `cannot compare number and string` (+ unquote hint when applicable) |
| Naive datetime | ``datetime literal '...' has no timezone, add an offset (e.g. 'Z' for UTC)`` |
| Datetime against an attribute | `cannot compare a datetime field and an attribute, use an ISO 8601 string literal …` |
| Ordered boolean | ``​`...` orders a boolean, use `==`, `!=`, or `is` instead of `<` / `>`​`` |
| Malformed datetime | ``invalid datetime literal: '...'`` |
| Uncastable string | `cannot cast string to number` |
| Non-finite or overflowing numeric | `invalid numeric literal: 1e400` (bare, via cast, or an int past float range) |
| Cast to text of a typed operand | `cannot cast boolean to text` (also `number`, `datetime`, and non-string literals) |
| Two literals in membership | ``​`1 in [1, 2]` compares two literals, expected a span field on the left`` |
| `None` in a membership list | ``​`name in [None]` includes None, which never matches in SQL; test for missing values with `is None` / `is not None`​`` |
| Non-collection, non-text right of `in` | ``​`in` expects a collection or a text field on the right, got `...`​`` |
| Collection outside membership | ``​`name == ('a', 'b')` compares against a collection, which is only supported with `in` / `not in`​`` |
| Nested collection | ``​`['a']` is not a value, collections cannot be nested`` |
| `is` with a non-singleton | ``​`name is 'abc'` uses `is` with a value, which SQL cannot express; use `==`, or `is` with None/True/False`` |
| Confusable identifier | ``​`ｎａｍｅ` is interpreted as `name`, use unaccented ASCII for field names`` |
| NUL in source / in a literal | `condition cannot contain a NUL character` / `string literals cannot contain a NUL character` |
| Unsupported unary operator | `unsupported operator: ~latency_ms` |
| Unsupported literal | `unsupported literal: b'abc'` |
| `parent_span` traversal | ``​`parent_span.name` is not supported: ... only `parent_span is None` and `parent_span is not None` are supported`` |
| Unknown member of a reserved root | ``invalid field `span.totl_cost`, did you mean `span.total_cost`?`` (or `expected …` when nothing is close) |
| Traversal past a reserved root's member | ``​`span.total_cost.x` is not supported: `span` exposes its fields directly (`span.<field>`) and cannot be traversed further`` |
| Bare reserved root | ``​`span` can only be used as `span.<field>`​`` |
| Collection in value position | ``​`span.cost_details` is a collection and can only be iterated, e.g. `any(x.<field> == "..." for x in span.cost_details)`​`` |
| Reserved root as a loop variable | ``​`span` is reserved and cannot be a loop variable`` |
| Reduction without a comprehension | ``​`len(...)` takes a comprehension over span.cost_details, e.g. …`` |
| Unknown iterable | ``invalid iterable `cost_details`, did you mean "span.cost_details"?`` |
| Unknown element field | ``invalid field `d.nope`, expected one of cost, cost_per_token, is_prompt, token_type, or tokens`` |
| Unknown annotation member | ``invalid eval attribute `.x` in `...`, expected `.score` or …`` |
| Empty annotation name | ``missing eval name in `evals['']`​`` |
| Unsupported construct | `invalid expression: <source>` |
| Depth limit | `filter condition is nested too deeply` |

Raw SQL is deliberately never surfaced. The original bug reports pasted walls of
PostgreSQL error text as the *symptom*.

---

## Known Gaps

### Structural

- **`parent_span` traversal** (`parent_span.name`) is reserved but unimplemented.
- **Annotation name existence** is not checked — anywhere, by design. An
  unknown or deleted name stays valid and matches nothing, exactly as an
  unknown attribute path does; that is the schemaless contract. A dormant
  `valid_eval_names` hook that could have enforced it at validation time was
  removed: it had no production caller or test, and as a hard gate it would
  have made a stored condition's validity depend on the live annotation table
  rather than on the text. Advisory checking (a save-time warning, editor
  suggestions) is the persistence-era option and belongs outside accept/reject.
- **Annotation aliasing is a byte-offset splice**, not an AST transform. The
  offset table agrees with the tokenizer and multi-byte/multi-line cases are
  tested, but rewriting the tree instead of the text would close a whole class
  at once: escape decoding, literal corruption, and diagnostics that leak
  generated alias names. Worth doing before conditions become durable.
- **No `EXPLAIN`-based differential test** against PostgreSQL; agreement between
  the validator and the database is asserted by hand-written cases only.
- **`Projector`** validates structure and the inherited Python surface — the
  allowlist walk, the NFKC and literal rules shared with `SpanFilter`, and
  the sandboxed `eval` — but none of the type or operand rules, by design: a
  projection is a value, not a predicate, so boolean-position and
  comparability have nothing to check. Its historical defects (no validation,
  an unsandboxed namespace, silently normalized confusable names) are fixed
  and pinned by `TestProjectorValidationGap`.
- **Membership between two JSON operands** (`attributes['p'] in
  attributes['q']`) is accepted and compiles to string containment over the two
  text renderings. The same class of divergence as two-JSON equality — boolean
  spellings, key order, quoting differ per backend — and pinned the same way
  (`test_membership_between_two_json_values_is_a_known_divergence`), with
  per-backend expected sets rather than a fix.
- **Collation and numeric precision** differ between backends and are not
  specified.

## Inherited Python Surface

Because the grammar is borrowed from Python's parser, everything Python accepts
arrives here by default — including constructs that have no SQL meaning at all.
Admitting them is never a decision; rejecting them is. The rules below are those
decisions, and each names a Python behavior that cannot be expressed honestly
against a SQL backend:

| Rejected | Was | Why it cannot stand |
|---|---|---|
| `~latency_ms == 1` | `cast(~latency_ms, Float) == 1` | `~` on a column is SQL `NOT`, so the expression compiles to something unrelated to what was written. Binary bitwise ops were already rejected; unary `~` slipped past because the type pass only inspected `USub`/`UAdd`/`Not`. |
| `name is 'abc'` | `name == 'abc'` | SQL has no identity comparison. Silently degrading `is` to `==` teaches a model the language does not implement. |
| `name == b'abc'` | bound as bytes | No column type to compare against. |
| `latency_ms == 1j` | bound as complex | Same. |
| `name == ...` | bound as `Ellipsis` | Same. |
| `latency_ms < 1e400` | bound as IEEE `inf` | Non-finite floats behave differently per dialect — and `'inf'` as a *string* was already rejected, so admitting the float form was inconsistent. |
| `latency_ms == float('1e400')` | `Constant(inf)` baked into the tree | The numeric-string grammar bounds the spelling, not the magnitude, so an in-grammar spelling could still overflow to the value the literal rule rejects. |
| `latency_ms == 9…9` (320 digits) | unbounded int bound as a parameter | Python ints have no size limit; asyncpg refuses the bind, SQLite stores infinity. |
| `name not in ['a', None]` | `NOT IN ('a', NULL)` | Never true for any row under three-valued logic; the filter validated and silently returned nothing. |
| `name == ('a','b')` | tuple bound as a scalar | A collection is only meaningful on the right of `in`/`not in`. |
| `name in [['a']]` | nested container | No scalar value for a column to match. |
| `name == 'a\x00b'` | NUL in a bind | SQLite accepts, PostgreSQL rejects at execution — validity would depend on the backend. |
| `ｎａｍｅ == 'a'` | `name == 'a'` | Python NFKC-normalizes identifiers, so a full-width spelling silently resolves to a real column the user never typed. |

Two Python behaviors were **kept** after examination:

- **`is` against `None` / `True` / `False`.** Those are the only values Python's
  `is` is meaningful against, and the only ones SQL can express (`IS NULL`,
  `IS TRUE`, `IS FALSE`). `metadata['flag'] is True` is a supported, tested form.
- **`int()` as an alias for `float()`.** It does not truncate, so `int(1.9)`
  compares against `1.9`. This is a misleading name rather than unsound SQL, and
  it cannot be corrected portably: `CAST(x AS INTEGER)` **rounds** on PostgreSQL
  (`1.9` → `2`, `-1.9` → `-2`) and **truncates** on SQLite (`1`, `-1`). An honest
  `int()` would mean different things per backend, which is worse than a
  documented alias. The name is also load-bearing in the `SpanQuery` surface.

One widening landed alongside these: surrounding whitespace is now stripped.
Python reads a leading space as indentation and fails with `IndentationError`,
which is a poor answer for a condition pasted with a stray space. Widening is
always safe under the additive-only policy.

## Related filters

Two other things are called filters in this codebase. Only one of them is a
language, and confusing the two misdirects exactly the review effort this
document is meant to focus.

**The experiment-run filter** (`src/phoenix/server/api/helpers/experiment_run_filters.py`)
is the real sibling: an independent implementation of the same idea, over
experiment runs and dataset examples, with its own parser, its own validation,
and its own translation to the same two dialects. The *principles* in this
document apply to it wholesale; the grammar does not — it has no datetime type,
rejects list membership outright, and resolves a different vocabulary (`input`,
`output`, `evals[...]`, `experiments[n]`). Because the two share intent but not
code, a defect fixed here stays open there until it is ported by hand — which
is how each of them was found. The inherited-surface rejections, the NFKC fold,
the membership type rule, the non-finite literal rule, and the requirement to
key into whole-document JSON columns have each made that trip.

**The session filter** (`src/phoenix/server/session_filters.py`) is not a
language at all. It is one function that takes a plain string and matches it
case-insensitively against the input and output values of root spans. There is
no grammar, no parser, no type system, and so none of the failure modes
catalogued here: the string is data, never source. It uses `as_string()`
already, so it does not have the JSON-rendering defect either. It is listed here
so that the next person auditing "the filters" can stop at this line rather than
go looking for a grammar that does not exist.

---

## Files

| Path | Role |
|---|---|
| `src/phoenix/trace/dsl/filter.py` | Parser, validator, translator, scope analysis |
| `src/phoenix/db/models.py` | `SafeJsonFloat`, `SafeJsonBoolean`, `TextContains` — the dialect-specific SQL the guarantees compile to |
| `src/phoenix/server/api/types/Project.py` | `validateSpanFilterCondition`, `analyzeSpanFilterCondition` |
| `src/phoenix/server/api/exceptions.py` | Filter errors (`SpanFilterError`, `ExperimentRunFilterConditionSyntaxError`) → GraphQL error mapping |
| `js/app/src/components/filter/DSLFilterConditionField.tsx` | Debounced field, error badge |
| `js/app/src/pages/project/spanFilterValidation.ts` | Client validation + cache |
| `js/app/src/pages/project/spanFilterSeed.ts` | Mount-time seed classification |
| `js/app/src/pages/project/SpanFilterErrorFallback.tsx` | Error-boundary fallback |
| `tests/unit/trace/dsl/test_filter.py` | Grammar, type, dialect, and execution tests |
| `tests/unit/trace/dsl/test_filter_spec_conformance.py` | Executable form of this document's accept/reject tables |
| `tests/unit/trace/dsl/test_filter_error_messages.py` | Pins the user-facing messages above |
| `tests/unit/trace/dsl/test_filter_hostile_data.py` | Execution against hostile rows, both dialects |
| `tests/unit/trace/dsl/test_filter_json_operand_comparison.py` | Pins JSON-operand comparison semantics and known divergences |
