# Span Filter DSL

Reference for the filter-condition language implemented in
`src/phoenix/trace/dsl/filter.py`.

Statements here were verified against the code, and dialect-dependent behavior
was executed rather than reasoned about. The version matrix that claim rests on:

| Backend | Verified on | Language floor |
|---|---|---|
| SQLite | bundled `sqlean` build | `text_contains` and the JSON functions `sqlean` provides |
| PostgreSQL | 12.22 and 17.10 | **12** — `jsonb_path_query_first` (PG 12) and `jsonb`→`numeric` casts (PG 11) |

PostgreSQL 12 is the floor because `_SafeJsonFloat` compiles to
`jsonb_path_query_first`, which does not exist before it. Behavioral checks
below were run on 17; the cast and JSON-path shapes the guarantees depend on were
additionally confirmed on 12, since a floor that is never exercised is not a
floor. Anything claimed here for a version outside that matrix is unverified.

## What This Is

A user-facing expression language, written in a subset of Python syntax, that
compiles to a SQLAlchemy `WHERE` clause over the `spans` table. It reaches the
server from three directions:

- the filter field in the spans/traces UI (`SpanFilterConditionField`)
- the `spans(filterCondition:)` GraphQL argument and its sibling resolvers
- `SpanQuery` in the REST/client surface, via `SpanFilter.from_dict`

The public entry points are `SpanFilter(condition)` and the module-level
`root_span_scope(condition)`.

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
additionally compiles the statement to SQL text. It does **not** execute.

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
| Boolean literal | `True`, `False` | **no** | yes |

Anything else in either position is rejected. See
[Boolean Position](#boolean-position).

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

**Reserved** — `parent_span`. Usable *only* as `parent_span is None` /
`parent_span is not None` (and the `==`/`!=` spellings). Traversal
(`parent_span.name`) is rejected with a dedicated message; it is not yet
supported. A span attribute literally named `parent_span` is still reachable as
`attributes['parent_span']`.

**This list is exhaustive.** Every identifier not named above — including ones
that look like span columns, such as `events` — resolves to an attribute path,
not a column. `events == 'x'` compiles to a comparison against
`attributes['events']` and has nothing to do with the `events` column on the
table.

Reading the vocabulary out of the code is easy to get wrong here. `_NAMES` is
the **evaluation namespace** handed to `eval`, and it binds `attributes` and
`events` because the compiled expression needs them; it is not the set of names
a user may write. The user-facing vocabulary is
`_STRING_NAMES ∪ _FLOAT_NAMES ∪ _DATETIME_NAMES ∪ _FLOAT_ATTRIBUTES` plus the
reserved keyword — exactly the list above.

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

A bare `annotations['name']` is an **existence check** and is boolean-valued.
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
| Collection | list or tuple of literals, homogeneously typed |
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

### Casts

`str(x)`, `float(x)`, `int(x)` are the only calls permitted. Every other call —
`len()`, lambdas, comprehensions, method calls like `name.upper()` — is
rejected. `float()` and `int()` are equivalent; both produce a float.

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
how datetime literals are written at all.

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

- compared against a boolean → `_SafeJsonBoolean`
- compared against a number, or wrapped in `float()`/`int()` → `_SafeJsonFloat`
- otherwise → cast to text

Both `_SafeJson*` functions are **total**: a value that cannot be converted
yields `NULL` and the row drops out rather than aborting the statement. This is
the mechanism that makes schemaless attributes safe to filter on, and it is
verified against deliberately hostile rows (`"abc"`, `"1_000"`, `"nan"`,
`"inf"`, `" 12 "`, containers, nulls).

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
means the same thing on both, or is rejected on both.**

Guaranteed:

- Validation is dialect-independent. Accept/reject never varies by backend.
- Dynamic JSON conversion is total on both (`SafeJsonFloat`,
  `SafeJsonBoolean`), including the three JSON boolean encodings (`true`,
  `"true"`, `1`) and their false counterparts, with JSON `null` matching neither.
- A container never converts to a number. This needs `strict $.double()` on
  PostgreSQL: a jsonpath in the default **lax** mode auto-unwraps arrays, so
  `[1, 2]` converts to `1` and matches a comparison against a number the row
  does not hold.

Not guaranteed:

- **JSON booleans compared as numbers.** SQLite's `json_extract` collapses JSON
  `true` to the integer `1`, so `metadata['x'] >= 0` matches a boolean there and
  not on PostgreSQL. The distinction is destroyed before the conversion sees
  the value — `json_type` can recover it only when given the original column
  *and* path — so closing this means passing the path down rather than the
  extracted value.
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
deleted; it simply matches nothing. Name existence checking exists
(`valid_eval_names`) but is **disabled in the GraphQL resolver as too
expensive** (`Project.py`, commented out). A stored filter can therefore rot
into a silently-empty result.

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

A version field is only useful if every caller can be asked which version it
meant. Conditions arrive from GraphQL arguments, from client-managed state, and
from URLs and history entries that no server controls — none of which can carry
or negotiate a version. Absent that, there is no branch point for a rewrite and
no migration hook to hang one from.

So the grammar evolves **additively**: nothing already accepted may be removed
or given a different meaning. Internal structure — the translator, the planner,
the generated SQL — is free to change. Accepted text and its meaning are not.

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

---

## Design Principles

These follow from what this language is: a user-facing surface, borrowed from a
host grammar, compiled to two SQL dialects, over partly schemaless data, whose
accepted text becomes durable. Each constraint below is a consequence of one of
those five facts.

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

The ladder is the decomposition. Almost every bug in this module was a
condition that *should* have failed at 1–2 and instead failed at 3–5.

- `X and r` — should fail at 2 (not a boolean), failed at 3.
- `latency_ms > '100'` — should fail at 2 (type mismatch), failed at 4.
- `label == 100` — should fail at 2 (type mismatch), failed at 5, and only when
  a non-numeric label happened to be in range.

Two rules follow, and they cover most of what this module does.

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

### 2. What cannot be known statically must be made total

Some things genuinely cannot be decided before the rows are read. Attribute
values are schemaless; `attributes['x']` has no type until you look.

For those, there are exactly two acceptable designs — **reject statically**, or
**make the operation total** so it can never abort. `_SafeJsonFloat` and
`_SafeJsonBoolean` take the second: an unconvertible value yields `NULL` and its
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

Two practical consequences:

- **Any coercion or cast change must be executed on both backends before it
  lands.** Compiling on both is not enough (see 1).
- **Silently-wrong is worse than loudly-broken.** When the two dialects
  disagree, prefer the behavior that fails, and make the validator reject the
  input on *both* so they agree again.

### 5. A host-language parser is a liability, not a grammar

Using `ast.parse` is enormously convenient and quietly hands your users
everything Python accepts: bytes literals, complex numbers, `Ellipsis`,
`~`, `**`, walrus, comprehensions, NFKC identifier normalization. None of it was
designed for; all of it was admitted.

If the surface is borrowed, the grammar must be an **allowlist**, never a
denylist. Every node type, every operator, every literal type is opt-in. A
denylist is a permanent backlog of things you have not thought of yet — and
under an additive-only policy, each one you miss becomes permanent.

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
- If the UI renders them, messages are **part of the contract** and their
  stability matters as much as the grammar's.

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

**Snapshot tests are the seductive case.** They look like verification and are
not: a snapshot records the SQL we *generate*, never whether that SQL *runs*.
Three separate snapshots in this codebase recorded PostgreSQL that cannot
execute — `X IS Y` between two expressions, a raw `CAST(jsonb AS FLOAT)`, and
`-'hello'` — each passing for as long as it existed. A snapshot is a
change-detector for the compiler, and it is worth having as that; it is not
evidence that anything works.

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
- **Sibling languages share defects.** SessionFilter inherited the same
  unary-plus sign flip and the same non-boolean operand hole. A fix to shared
  machinery needs regression coverage on every grain that uses it.

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
8. Does SessionFilter share the machinery being touched?
9. If a snapshot changed, has the new SQL been *run* on both backends?

## Error Messages

Messages are user-facing: the frontend renders `errorMessage` verbatim in the
filter field's error badge and tooltip. They should name the offending fragment
and, where possible, suggest the repair.

| Situation | Message |
|---|---|
| Value in boolean position | ``​`r` is not a condition, expected a comparison such as `r == ...`​`` |
| Mismatched comparison | `cannot compare number and string` (+ unquote hint when applicable) |
| Naive datetime | ``datetime literal '...' has no timezone, add an offset (e.g. 'Z' for UTC)`` |
| Uncastable string | `cannot cast string to number` |
| Two literals in membership | ``​`1 in [1, 2]` compares two literals, expected a span field on the left`` |
| Unknown annotation member | ``invalid eval attribute `.x` in `...`, expected `.score` or …`` |
| Unsupported construct | `invalid expression: <source>` |
| Depth limit | `filter condition is nested too deeply` |

Raw SQL is deliberately never surfaced. The original bug reports pasted walls of
PostgreSQL error text as the *symptom*.

---

## Known Gaps

### Structural

- **`parent_span` traversal** (`parent_span.name`) is reserved but unimplemented.
- **Annotation name existence** is not checked in the GraphQL path (cost). A
  stored condition naming a deleted annotation stays valid and matches nothing.
- **Annotation aliasing is a byte-offset splice**, not an AST transform. The
  offset table agrees with the tokenizer and multi-byte/multi-line cases are
  tested, but rewriting the tree instead of the text would close a whole class
  at once: escape decoding, literal corruption, and diagnostics that leak
  generated alias names. Worth doing before conditions become durable.
- **No `EXPLAIN`-based differential test** against PostgreSQL; agreement between
  the validator and the database is asserted by hand-written cases only.
- **`Projector`** (the projection sibling of `SpanFilter`) has weaker
  validation; `TestProjectorValidationGap` documents this deliberately.
- **No declared minimum PostgreSQL version**, so the version floor the JSON
  guarantees depend on is implicit.
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

## Relationship to SessionFilter

`SessionFilter` (`src/phoenix/db/session_filters.py`) is a sibling language over
sessions rather than spans, built on the same shape: a borrowed Python grammar,
a structural allowlist, annotation aliasing, and translation to the same two
dialects.

Shared shape means shared defects. A construct that is unsound here is very
likely unsound there, and the reverse — so a finding on either grain is worth
checking against the other, and a fix to shared machinery needs regression
coverage on **both**. The principles in this document are grain-independent;
only the vocabulary and the scope analysis are specific to spans.

---

## Files

| Path | Role |
|---|---|
| `src/phoenix/trace/dsl/filter.py` | Parser, validator, translator, scope analysis |
| `src/phoenix/server/api/types/Project.py` | `validateSpanFilterCondition`, `analyzeSpanFilterCondition` |
| `src/phoenix/server/api/exceptions.py` | `SpanFilterError` → GraphQL error mapping |
| `app/src/components/filter/DSLFilterConditionField.tsx` | Debounced field, error badge |
| `app/src/pages/project/spanFilterValidation.ts` | Client validation + cache |
| `app/src/pages/project/spanFilterSeed.ts` | Mount-time seed classification |
| `app/src/pages/project/SpanFilterErrorFallback.tsx` | Error-boundary fallback |
| `tests/unit/trace/dsl/test_filter.py` | Grammar, type, dialect, and execution tests |
