# Span Filter DSL

Reference for the filter-condition language implemented in
`src/phoenix/trace/dsl/filter.py`. Every statement here was verified against the
code and, where behavior is dialect-dependent, executed against both SQLite and
PostgreSQL 17.

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

Three phases, in order. The distinction matters because only the first two run
before a query is issued.

| Phase | Function | Catches |
|---|---|---|
| 1. Parse | `ast.parse(mode="eval")` | Python syntax errors |
| 2. Validate | `_validate_expression` → `_validate_operand_types` | Structure, types, boolean position |
| 3. Translate | `_FilterTranslator` → `compile` → `eval` | Shapes the validator admits but cannot express |

`validateSpanFilterCondition` (GraphQL) runs 1–3 and additionally compiles the
statement to SQL text. It does **not** execute. See
[Validation Is Not Execution](#validation-is-not-execution).

All three phases raise `SpanFilterError`, a subclass of `SyntaxError`. Stack
exhaustion at any phase is normalized to
`SpanFilterError("filter condition is nested too deeply")` rather than escaping
as `RecursionError`.

---

## Grammar

### Expression forms

The whole condition must be a **condition**, not a value. So must every operand
of `and`, `or`, and `not`. A condition is one of:

| Form | Example |
|---|---|
| Comparison | `latency_ms > 100` |
| Chained comparison | `0.5 < latency_ms < 1000` |
| Logical combination | `a == 1 and b == 2`, `not (a == 1)` |
| Bare annotation (existence check) | `annotations['quality']` |
| Boolean literal | `True`, `False` |

Anything else in that position is rejected. See
[Boolean Position](#boolean-position).

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
| Identity | `is` `is not` (with `None`) | — |
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

Every operand of `and`, `or`, `not` must be a condition. This is the rule that
closes issues [#5802](https://github.com/Arize-ai/phoenix/issues/5802) and
[#10306](https://github.com/Arize-ai/phoenix/issues/10306).

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
- Dynamic JSON conversion is total on both (`_SafeJsonFloat`,
  `_SafeJsonBoolean`), including the three JSON boolean encodings (`true`,
  `"true"`, `1`) and their false counterparts, with JSON `null` matching neither.

Not guaranteed:

- **Row-level ordering and collation.** String comparison collation differs.
- **Numeric precision.** PostgreSQL `NUMERIC` vs SQLite `REAL`.
- **NULL sort position** in downstream `ORDER BY`.

Historically the divergence was much larger, and it is the root cause of the
filter-crash issue family: the same condition produced a crash on PostgreSQL and
silently wrong rows on SQLite. Any new coercion should be checked against both
before it lands.

> PostgreSQL CI currently pins `postgres:12`, which reached end of life in
> November 2024. See [#14940](https://github.com/Arize-ai/phoenix/issues/14940).

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

1. **A test that only constructs a `SpanFilter` proves very little.** Several
   defects survived precisely because the tests never ran a query. Coercion
   changes need execution-level tests that assert returned rows.
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

The **condition string**, verbatim. `SpanFilter.to_dict()` emits
`{"condition": ...}` and `from_dict` round-trips it exactly. No parsed or
compiled form is persisted, and none should be: the AST and generated SQL are
implementation details that change between releases.

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
rows. This has already happened twice in one change: quoted numbers
(`latency_ms > '100'`) and naive datetime literals were both accepted before and
are rejected now. Both were only ever valid on SQLite.

**5. Loud — new reserved keywords.** `parent_span` became reserved recently. Any
new reserved name silently changes meaning for conditions that used it as an
attribute, or starts rejecting them.

**6. Loud — removing a backward-compatibility alias.** The five aliases above
are the only reason older conditions still parse.

**7. Environment-dependent — dialect migration.** A condition stored on SQLite
may fail on PostgreSQL after a backend migration. This is not hypothetical: it
is exactly the class of bug this DSL work exists to remove, and older stored
conditions predate the fixes.

### The compatibility policy: additive only

**There is no grammar version, and there will not be one.** The standard set for
the sibling SessionFilter DSL applies here verbatim:

> This product cannot reasonably ask GraphQL callers and client-managed/history
> state to select a filter-language version. Existing expressions and argument
> meanings must remain backwards-compatible. Internal compiler/planner
> architecture can change later; shipped text and meaning cannot.
>
> — `.scratch/pr_reviews/pr-14101-session-filter-dsl/review.md`

So the grammar evolves **additively**: new names, new operators, and new forms
may be introduced; nothing already accepted may be removed or given a different
meaning. There is no version field to branch on and no migration hook to hang a
rewrite from.

### The tightening window closes at persistence

This has a consequence worth stating plainly, because it is time-boxed.

Every restriction is a breaking change *once conditions are stored*. Before
that, a restriction only invalidates text a user can retype. The current change
makes exactly two:

- quoted numbers against numeric fields (`latency_ms > '100'`)
- naive datetime literals (`start_time >= '2025-12-16T13:43:00'`)

Both were only ever valid on SQLite — they failed at execution on PostgreSQL —
so they were never portable behavior. Landing them now costs nothing beyond
retyping. Landing them after persistence would be impossible under the policy
above.

**Anything else in [Known Gaps](#known-gaps) that should be rejected has to be
rejected before conditions are written to the database.** After that, the only
available response is to keep accepting it.

### Recommendations for the persistence work

- **Validate on read, and degrade visibly.** A stored condition that no longer
  parses should surface as a repairable error attached to the saved object — not
  as a crash, and not as a silently absent filter.
- **Decide the policy for vanished annotation names** before shipping. Options:
  leave silent (status quo), validate on read against the project's current
  names, or warn at save time only.
- **Never persist generated SQL or a parsed form.** Only the source text is
  stable across releases; the AST and SQL are implementation details.
- **Pin or test the dialect.** A condition stored while on SQLite may fail after
  a migration to PostgreSQL. Conditions written before the fixes in this change
  are the likeliest to.

---

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
  offset table now agrees with the tokenizer, and multi-byte/multi-line cases are
  tested, but the SessionFilter review argues for AST-transform aliasing as the
  structurally correct fix — it would also close escape-decoding and literal
  corruption. Worth considering here before conditions become durable.
- **No `EXPLAIN`-based differential test** against PostgreSQL; agreement between
  the validator and the database is asserted by hand-written cases only.
- **`Projector`** (the projection sibling of `SpanFilter`) has weaker
  validation; `TestProjectorValidationGap` documents this deliberately.
- **No declared minimum PostgreSQL version** — see
  [#14940](https://github.com/Arize-ai/phoenix/issues/14940).
- **Collation and numeric precision** differ between backends and are not
  specified.

## Inherited Python Surface

This DSL was built before it had a database: conditions were evaluated in Python,
and the language was whatever Python's parser accepted. The SQL backend came
later, and with it a large surface that had no SQL meaning but was still
admitted — because nothing had ever needed to reject it.

That surface was closed in the final pre-persistence tightening. Each rule
replaces a Python behavior that could not survive the move:

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

`SessionFilter` (PR [#14101](https://github.com/Arize-ai/phoenix/pull/14101),
`src/phoenix/db/session_filters.py`) is a sibling language over sessions rather
than spans. It shares this module's shape and several of its defects, including
the unary-plus sign flip and non-boolean logical operands — both fixed here, both
still open there at the time of that review.

Fixes that touch shared machinery need regression coverage on **both** grains.
The review for that PR is the authority on session-grain semantics and on the
compatibility standard quoted above.

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
