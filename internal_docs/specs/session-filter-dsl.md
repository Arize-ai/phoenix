# Session Filter DSL

> This spec (with its conformance tests) is the authority on what the language accepts. The
> **user-facing** grammar reference is the public
> [Filter Expressions](https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions)
> doc — a curated derivative of this spec, not a second authority. Keep them in sync when the
> accepted grammar changes.

Phoenix groups traces into sessions by `session_id`. A trace records one exchange — an input
and the response produced for it — so a session reads as a conversation. The session filter
DSL lets a user or an agent select sessions with a small Python expression, e.g.:

```python
num_traces > 5 and any(span.status_code == "ERROR" for span in spans)
```

It is the session-level sibling of the span filter language used on the spans view. Today it
drives the sessions table (filtering, counts, and the filter bar). It is also the filter
vocabulary that session-level project evaluators (see [online-evals.md](./online-evals.md))
will use to scope which sessions get evaluated.

Core modules:

- `src/phoenix/trace/dsl/filter.py` — the shared filter compiler, parameterized per grain
- `src/phoenix/trace/dsl/session_filter.py` — the session bindings and query assembly
- `src/phoenix/db/session_aggregates.py` — reusable per-session aggregate subqueries

## Design Philosophy

Four commitments shaped the design. They matter more than any single feature, because they
decide how the language grows.

### One language family, one flavor

Phoenix already has a span filter language: a Python expression over flat names like `name`,
`latency_ms`, and `annotations["quality"].score`. The session language keeps that exact
flavor — same expression grammar, same flat-name style, same casting and annotation idioms,
same error messages. Users and agents learn the family once and carry that knowledge across
grains ("grain" here means the artifact level a filter runs at: span, session, and later
trace). Internal consistency across grains outranks per-grain optimization. If a construct
cannot be made consistent with the family, that is a design smell to resolve before shipping.

The commitment is why string containment ignores case at every grain rather than only at the
one that needed it: the span grain was flipped alongside the session grain so the same query
gets the same answer in both views. The reasoning is under
[Case](#case-containment-ignores-it-equality-does-not).

### Python with a SQL backend, not Python-flavored SQL

A filter condition is real Python, and Python defines what it means. The same expressions are
meant to later run as actual Python inside evaluator bindings, so the two execution worlds
must agree. The spec of correctness is therefore a small Python reference evaluator, and the
SQL compiler is correct exactly when it agrees with the reference on every test fixture (see
[Correctness](#correctness-the-reference-evaluator)). Behavior is inherited from CPython
rather than designed: `all()` over an empty selection is true, `len([])` is `0`, `sum(())` is
`0`, and `len(...)` accepts a list comprehension but not a generator.

Holding that line took a typed acceptance policy, because the shared compiler coerces where it
cannot type: it casts an operand to a number when the other side is one, reads `is` as `==`,
and passes any Python operator through to whatever SQLAlchemy makes of it. That is the accepted
surface of the older span language and stays there. But a language declaring its conditions to
*be* Python cannot also read `session_id == 1` as a numeric comparison against string data, or
`+x` as `-x`. So this grain resolves every sub-expression to a type before any SQL is built and
rejects what does not fit — the rules, and the reason behind each, are in
[What the language accepts](#what-the-language-accepts). Every divergence found in review ended
one of two ways: the implementation conforming, or the deviation being legislated below. None
was left accepted by accident, because an accepted form is a compatibility promise whether or
not anyone meant to make it.

### Legislated deviations from Python

Filters cannot raise an exception per row, and SQL NULL does not behave like a Python value.
So the language legislates a deviation from Python: a missing value fails every comparison. A
session with no recorded input, a span with no token counts, an empty `max(...)` — comparing
any of these against anything is false, in both directions. Sessions with the value genuinely
missing are targeted explicitly with `is None`.

There is one other: `in` against a string haystack ignores case, where Python's is exact (see
[Case](#case-containment-ignores-it-equality-does-not)). Both departures are
legislated for the same reason — the Python-faithful behavior silently drops rows the user
meant to find — and both are implemented twice, once in the SQL compiler and once in the
Python reference, so the two execution worlds still agree. Everything else stays CPython.

### The vocabulary cannot drift from the compiler

Everything the language binds — fields, aggregates, iterables, element fields — is served to
clients from the same tables the compiler reads. There is no hand-maintained list of
suggestions. If a name compiles, the vocabulary endpoint serves it; if it does not compile,
nothing suggests it. Autocomplete, agent tooling, and validation all sit on this one source.

## The Language

### Session fields

Direct columns of the session row:

| Name | Type | Meaning |
| --- | --- | --- |
| `session_id` | string | Session identifier |
| `start_time`, `end_time` | datetime | Earliest and latest trace timestamps |
| `duration_ms` | float | Wall-clock duration in milliseconds |

Datetime comparands are ISO 8601 strings with an explicit offset, e.g.
`start_time > '2026-07-01T00:00:00+00:00'` or a trailing `Z`. A literal without one is
rejected at validation (`datetime literal '…' has no timezone, add an offset (e.g. 'Z' for
UTC)`). The offset is required rather than defaulted to UTC: general REST normalization
localizes naive input to the server timezone, and an expression that means different
instants in different places is a bad thing to save.

`start_time` and `end_time` are not the view's time range, and the difference is easy to trip
over. `timeRange` selects the candidate universe by *interval overlap* with a half-open
window — a session counts if it was active inside it, however long before it started. These
two are *point comparisons* against the session's own bounds. So a session that started
yesterday and is still running is inside today's `timeRange` and outside
`start_time > '<today>'`. Supplied together they compose with `AND`; neither changes how
aggregates or comprehension subqueries are scoped beyond the session-scope join they already
carry. Keep relative intents such as "last 7 days" in the time-range surface, where they
belong, and keep saved DSL text deterministic with absolute literals.

### Aggregates

Per-session rollups, computed on demand. Each is `0` when the session has no matching data —
never null:

| Name | Meaning |
| --- | --- |
| `num_traces` | Trace count |
| `num_traces_with_error` | Traces containing an errored span |
| `token_count_prompt`, `token_count_completion`, `token_count_total` | LLM token totals |
| `prompt_cost`, `completion_cost`, `total_cost` | Cost totals |
| `tool_span_count`, `llm_span_count` | Spans of kind TOOL / LLM |

A trace is one trace. Instrumentation that opens a trace per exchange makes `num_traces` an
approximate conversation-turn count, and it is a useful thing to say to a user reaching for
turns — but it is an ingestion convention Phoenix does not enforce, so neither the glosses
nor this table state it as the meaning of the term.

### Root-span access

A session has no attributes of its own, so several names read from the session's spans:

- `attributes["llm.model_name"]` — attribute access on the session's *earliest root span*,
  addressed by OTel wire key. String subscripts are joined with dots, so
  `attributes["llm"]["model_name"]` names the same key. The lookup matches the key however
  ingestion nested it. A missing key is treated as missing (see the deviation rule above).
- `user.id` and `metadata["key"]` — accepted shorthands for the matching `attributes` keys.
- `first_input` / `last_output` — strings, read from the session's earliest and latest root
  span. "Earliest" is a deterministic ordering, not a claim about roles: trace start time,
  then trace id, then span id. Useful for "did the session end well" checks.
- `'refund' in any_input` / `any_output` — an EXISTS over the session's root spans: does
  *some* root span's input or output contain this text. Cheaper than the first/last forms and
  the right default for "does this session mention X". Note the three universes a search can
  address — every span, every root span (`any_*`), and one root span (`first_input`,
  `attributes[...]`) — and that they narrow in that order. These two are containment-only:
  they take `in` and `not in` against a string literal and never `==`, and the served
  vocabulary types them `containment` so autocomplete does not invite the equality form.

### Annotations

`annotations["quality"].score > 0.8` reads session-level annotations, using the same idiom as
the span language. Annotations on individual spans are reached through the `span_annotations`
iterable below.

The spelling is entity-relative: `annotations[...]` reads `project_session_annotation` rows
here and `span_annotation` rows in the span filter. That is ordinary — the filter is always
about its own grain — but nothing about the expression says so, so the served vocabulary says
it for anyone who uses both filters.

### Comprehensions

The language quantifies and aggregates over a session's members with real Python
comprehension syntax:

```python
any(span.status_code == "ERROR" for span in spans)
all(trace.latency_ms < 30000 for trace in traces)
len([span for span in spans if span.span_kind == "TOOL"]) > 3
sum(detail.tokens for detail in span_cost_details if detail.token_type == "cache_read") > 0
```

Six callables accept a comprehension: `any`, `all` (quantifiers) and `len`, `max`, `min`,
`sum` (reductions). Five iterables are available:

| Iterable | Element fields |
| --- | --- |
| `spans` | `name`, `span_kind`, `status_code`, `latency_ms`, `llm_token_count_prompt`, `llm_token_count_completion`, `llm_token_count_total` |
| `traces` | `start_time`, `end_time`, `latency_ms`, and a nested `spans` iterable |
| `session_annotations` | `name`, `label`, `score` |
| `span_annotations` | `name`, `label`, `score` (every span's annotations, flattened to session scope) |
| `span_cost_details` | `token_type`, `is_prompt`, `cost`, `tokens`, `cost_per_token` |

Design notes, each a deliberate choice:

- **Comprehension syntax over helper functions.** An alternative was string-nested helpers
  like `any_span("status_code == 'ERROR'")`. Comprehensions won because the loop variable
  solves a real problem: `start_time` exists at both the session and trace grain, and
  `trace.start_time` is unambiguous where a bare name inside a string is not. Comprehensions
  are also the form language models produce most reliably.
- **Explicit grain names.** The iterables are named `spans` and `session_annotations`, not
  context-relative names like `annotations`. Inside a comprehension you always know what you
  are iterating.
- **Row-backed only.** Every iterable is an existing database table. No JSON-backed
  iterables (messages, documents, events) in this version; they can be added later without
  breaking anything.
- **One sanctioned nesting.** A `traces` element exposes `trace.spans`, so per-turn questions
  work: `any(any(s.span_kind == "TOOL" for s in trace.spans) for trace in traces)`. Nesting
  stops there, and stops loudly: a session-level collection named inside a comprehension has no
  correlation to the element being iterated, so it is rejected by name rather than compiling
  into a subquery with nothing to key on.
- **Leaf token counts.** Span elements expose the per-span `llm_token_count_*` columns, never
  the `cumulative_*` rollups. Summing cumulative counts over a session would count the same
  tokens repeatedly through wrapping agent and tool spans.
- **Loop-variable scope only.** Inside a comprehension, the predicate may reference the loop
  variable's fields, literals, and arithmetic over them. Bare session-level names inside a
  comprehension are rejected for now; this is a restriction, not a semantic choice, and can
  be lifted later.
- **Per-name tool counting has one spelling.** Counting calls to a single tool is written as
  a comprehension — `len([span for span in spans if span.name == "search"])`. The earlier
  `tool_span_count["search"]` subscript was retired: it needed a scan of observed tool names
  to validate, and a name that never occurred silently counted as 0 rather than erroring.
  Reintroducing the subscript would buy a shorter spelling for a query the language already
  answers, at the cost of that vocabulary scan.
- **Case-sensitive containment is gone, not hidden.** With `in` case-insensitive
  (see [Case](#case-containment-ignores-it-equality-does-not)), there is no way to ask
  for an exact-case substring. That is a real loss, accepted because searching text is
  overwhelmingly the case-insensitive question and a second operator on day one is vocabulary
  users have to learn before they need it. If the exact form is wanted later it is purely
  additive — a distinct operator alongside `in`, never a change to what `in` means.

### Case: containment ignores it, equality does not

`in` and `not in` against a string haystack ignore case, everywhere in the filter language —
at the session grain (`any_input`, `any_output`, `first_input`, `last_output`, `session_id`,
root-span attribute reads, annotation labels) and at the span grain (`name`, `input.value`,
`status_message`, attribute reads) alike. `==` and `!=` stay exact, and so does membership
in a literal list (`span.name in ["search", "lookup"]`), which is a set test rather than a
text search. So `'refund' in first_input` finds a session that opened with `REFUND please`,
while `first_input == 'refund please'` does not.

The reason is the surface this language replaced. The sessions table used to carry a separate
substring search box that matched case-insensitively; retiring it in favor of the DSL would
otherwise have quietly narrowed what users could find. Searching text is the case where
people mean "mentions this", not "spells it exactly this way", and a filter that silently
misses `REFUND` reads as broken rather than as precise. It compiles to PostgreSQL `ILIKE` and
SQLite's `text_lower` on both operands — the same mechanism the retired search used, so the
non-ASCII and wildcard-literal behavior carries over unchanged.

**The span grain was flipped to match, and that is a behavior change to a shipped
language.** Span-grain `in` and `not in` were exact; they now ignore case too, so a saved
span filter reading `'timeout' in output.value` starts matching spans that spell it
`Timeout`. A saved span filter using `in` returns the same rows or more, never fewer; one using
`not in` returns the same rows or fewer, never more. That was accepted rather than avoided: a
user moving between the sessions and spans views was getting
two different answers to the same-looking query, and of the two answers the case-insensitive
one is what people mean by searching text. The polarity is a flag on the shared compiler's
bindings, set the same way at every grain, so it stays one decision rather than a per-grain
habit — and a later exact-case operator alongside `in` remains purely additive at both
grains.

### What the language accepts

Every term has a type — text, number, timestamp, condition, or *attribute value* for a root-span
read whose stored type is unknown until the row is read — and a condition is accepted only if it
types. The rules below are the whole policy. Each exists because the alternative was a form that
compiled into something other than what its Python spelling says.

- **A condition is a condition.** Comparisons, quantifiers, and `and`/`or`/`not` over them. A
  bare number is not a filter, and `not num_traces` does not mean "no traces": numeric truthiness
  is a Python rule SQL has no equivalent for, and PostgreSQL rejects it outright.
- **Comparison operands match.** `session_id == 1` is a mistake, not a request to read a session
  id as a number. An attribute value compares against anything, because it genuinely could be
  anything; a timestamp compares against an ISO literal, which is the spelling the language
  already teaches. `True`/`False` compare only against a boolean-typed term.
- **`is` and `is not` take `None` only.** CPython's `is` is object identity, which no column
  comparison can mean. Reading it as `==` would make two spellings of the same expression differ
  from Python in the same breath.
- **`<`, `<=`, `>`, `>=` order numbers and timestamps, not text.** SQLite orders text by byte
  value and PostgreSQL by the database's collation, so a text ordering means different things on
  the two backends. The same reasoning rejects `max`/`min` over text, and a declared collation
  would lift both together.
- **Arithmetic is `+ - * / %` over numbers.** `//`, `**`, `<<`, `>>`, `&`, `|`, `^`, `@`, and `~`
  are rejected before lowering rather than failing later inside SQLAlchemy, and unary `+` is the
  identity Python defines it to be. Arithmetic on an attribute value asks for `float(...)`
  explicitly, since its stored type is not known.
- **Literals are text, numbers, `True`/`False`, and `None`.** Bytes, complex numbers, `Ellipsis`,
  a float literal large enough to overflow to infinity, and a NUL inside a text literal are all
  rejected — the last because PostgreSQL refuses a NUL in a text value while SQLite stores it, so
  accepting it would make the same filter mean different things per deployment.
- **`in` searches text, or looks a value up in a literal list.** The haystack is text or an
  attribute value and the needle is a text literal; a list holds literals of one type. A column
  needle (`session_id in first_input`) is cross-column substring search — a plausible feature
  whose cost has not been designed, so rejecting it now keeps it available later.
- **Empty collections are accepted.** `x in []` is always false and `x not in ()` always true,
  exactly as in Python, and SQLAlchemy's empty-set rewrites are portable. Both are tested as
  executed statements rather than inherited by accident.
- **Set literals are not accepted yet.** `x in {'a', 'b'}` is the idiomatic Python spelling and
  its absence is a real rough edge, deferred rather than resolved: admitting a rejected spelling
  later is purely additive, where withdrawing an accepted one is not.
- **`float(...)` and `str(...)` cast an attribute value; `int(...)` does not exist.** A cast is
  admitted only where its result agrees on SQLite and PostgreSQL. Already typed text, numbers,
  timestamps, and conditions are rejected: for example, an integral float renders as `1.0` on
  SQLite and `1` on PostgreSQL, so converting that number to text would silently select different
  sessions. Root-span attributes remain castable because their stored type is not known until the
  row is read. Both numeric casts share one lowering, so `int(1.9)` would compare as `1.9` — the
  opposite of what the spelling promises. Truncation can be implemented deliberately later.
- **Names are resolved strictly, including dotted ones.** `user.id` is the one accepted dotted
  shorthand; `usr.id` is a typo, not a request for an arbitrary attribute. The open dotted
  fallback would have quietly undone the did-you-mean protection every other name advertises,
  and `attributes["usr.id"]` says the same thing without ambiguity.
- **Reductions reduce numbers.** `sum(span.name for span in spans)` adds text — SQLite coerces it
  to zero and PostgreSQL refuses. Counting is what that question wants: `len([...])`.
- **A comprehension iterates one collection.** The only nesting is the one a `traces` element
  declares (`trace.spans`); a session-level collection named one scope down has nothing to
  correlate against and is rejected by name. A session-level *term* inside a comprehension is
  rejected with the scope named, since the same spelling works outside it.
- **A name is spelled the way the vocabulary spells it.** Python's parser NFKC-normalizes
  identifiers, so full-width `ｓｅｓｓｉｏｎ＿ｉｄ` would otherwise resolve as `session_id` —
  the parser defining aliases the vocabulary endpoint cannot serve, against the anti-drift
  commitment above. Subscript keys are data and keep whatever spelling they were given.
  Whitespace around a condition is normalized, so a leading space is not an `IndentationError`.

The rejections are pinned in an accept/reject corpus (`test_session_filter_semantics.py`), which
is where a future term change has to argue its case; the accepted forms in that corpus are
executed against a real database rather than only rendered, and their row-set semantics live in
the differential suite.

### Semantics of missing values, precisely

The missing-value deviation plays out as follows. Both execution worlds implement each line:

- A comparison against a missing value is false, in both directions.
- `all(P for x in IT)` counts an element with a missing field as a counterexample. In SQL the
  counterexample check compiles to `P IS NOT TRUE`, never `NOT P`, because under three-valued
  logic `NOT NULL` is still NULL and would silently pass.
- `all()` over an empty selection is true (inherited from Python, and structurally free:
  `NOT EXISTS` over an empty set).
- `len` and `sum` over an empty selection are `0` (inherited from Python).
- `max`/`min` over an empty selection are *missing*, so any comparison against them is false.
  Python raises here; a filter cannot, so the deviation rule applies. Coalescing to `0`
  instead was rejected: `max(...) < 5` would then confidently match sessions with no
  qualifying spans at all.
- Reductions skip elements whose reduced field is missing, matching SQL aggregate semantics.

## Compilation

### One compiler, parameterized per grain

There is a single filter compiler. Each grain supplies a bindings object declaring its
scalar names by type, its aggregate names, its annotation relation, and its iterables. The
span language and the session language are the same machinery with different bindings, which
is what keeps the flavor identical. The session bindings reject unknown names at validation
time and answer with a did-you-mean suggestion drawn from the bound vocabulary.

### Comprehensions become subqueries over the element table

Validation whitelists expression shapes on the parsed syntax tree. A pre-pass then extracts
each comprehension into a placeholder name and records what it needs: the kind (`any`, `sum`,
…), the iterable, the loop variable, the optional `if` clause, and any nested comprehension.
At query time each record builds a subquery against the element's table in one of the two
lowerings described below.

Under the probe lowering the subquery is correlated to the session row:

- `any(...)` → `EXISTS (SELECT 1 … WHERE predicate)`
- `all(...)` → `NOT EXISTS (SELECT 1 … WHERE predicate IS NOT TRUE)`
- `len`/`sum` → correlated scalar `COUNT`/`SUM`, coalesced to `0`
- `max`/`min` → correlated scalar, left NULL when empty

Under the scan lowering the outermost comprehension of each record is uncorrelated instead, so
one pass over the element table answers the question for every session at once:

- `any(...)` → `session_id IN (SELECT session_key … WHERE predicate)`
- `len`/`sum` → a `(session_key, aggregate)` subquery grouped by session and LEFT JOINed on
  the session row, read through a `COALESCE(…, 0)`
- `max`/`min` → the same grouped subquery, read raw so an empty set stays NULL

`all(...)` is the exception: it keeps the correlated `NOT EXISTS` shape under both lowerings.
The uncorrelated form — `session_id NOT IN (SELECT session_key … WHERE predicate IS NOT
TRUE)` — puts every element that fails the test in the anti-set, which is most of the element
table whenever the predicate is selective, i.e. whenever someone is actually filtering, and
`NOT IN` over a set that size degrades past statement timeouts where the correlated form
plans as a per-session anti-join probe. Measured on a 3M-span corpus (100k sessions in the
filtered project): the anti-set shape exceeded a 90-second statement timeout where the
correlated form returned in well under a second; on a predicate that is true almost
everywhere — the anti-set shape's best case — the two are within the same order of magnitude.
The correlated shape is also immune to the `NOT IN` NULL trap: `Trace.project_session_rowid`
is nullable, one NULL in a `NOT IN` set empties the whole result, and a NULL key simply never
matches the correlation.

The two lowerings agree by construction. A session with no matching elements is absent from
the `any` set and has no `all` counterexample, which is exactly the vacuous-truth rule; `len`
and `sum` coalesce to `0`; `max` and `min` stay NULL and so fail every comparison.

Only the outermost comprehension changes shape. A nested comprehension stays correlated to the
element enclosing it, which the enclosing subquery has already scoped to a session. Inner
predicates compile against the iterable's own bindings under both lowerings, so they inherit
the casting, uppercasing, and error behavior of a top-level condition.

### Two lowerings, chosen by access pattern

Every construct that reaches beyond the session row — aggregates, comprehensions, root-span
access — compiles to one of two physical shapes. The caller picks, because the compiler cannot
see whether the statement it is handed has a `LIMIT`, and that is the whole of the question:

- **probe** — one subquery per candidate session row. A statement with a `LIMIT` can stop as
  soon as it has enough matching rows, so it only pays for the rows it returns.
- **scan** — one pass over the element or trace tables, joined once. This is what a statement
  that has to touch every session wants, because there is no early exit to buy.

The shipped dispatch follows from that:

| Statement | Lowering | Why |
|---|---|---|
| Page, no annotation access, ordered by an indexed column | direct + probe | `LIMIT` stops after enough matching rows |
| Page ordered by an aggregate column | direct + scan, reusing the sort's subquery | the sort must materialize that aggregate for every session before it can order rows, so the early exit is already gone |
| Count, summary loaders, and any condition reading annotations | rowid subquery + scan | no `LIMIT` to exit on, or deduplication required |

"Direct" means the predicate is applied to the statement being paginated. The alternative —
wrapping it as `session_id IN (SELECT DISTINCT …)` — puts the per-session work outside that
statement, so the database evaluates the condition for every session in the project before
`LIMIT` sees a row. Measured at 100k sessions, one page cost about 2543 ms wrapped and about
2 ms applied directly. Conditions that read annotations keep the wrapper anyway: a session
annotation is unique on `(name, project_session_id, identifier)`, so one session can carry
several rows under one name and the wrapper's `DISTINCT` is what collapses them. Everything
else the compiler brings in contributes at most one row per session: quantifiers and the
`any_input`/`any_output` predicates are `EXISTS` or `IN` predicates that add no rows at all,
grouped aggregate and reduction subqueries carry one row per session by construction, and
root-span IO and `attributes[...]` are rank-one-per-session windows outer joined on the
session id.

Selectivity is the one thing this dispatch cannot see. A page whose condition matches nothing
never fills its `LIMIT`, so the probe lowering exhausts the project and loses to the scan
lowering there — measured at 243 ms against 117 ms. That trade is deliberate: the rare case
costs about 2x, the common case wins about 100x.

The benchmark harness lives at `scripts/perf/session_filter_perf.py`. It builds every measured
query from the two seams below, so it reports the shapes the server actually runs, across
construct family, access pattern, and selectivity.

### Two seams, one per access pattern

Server consumers reach the language through exactly two functions in
`src/phoenix/server/session_filters.py`, and the language never leaks past them.

`get_filtered_session_rowids_subquery(...)` produces the set of matching session row ids under
project and time-range scoping. Consumers apply it as a single `IN` clause: the session count
and the project-level summary loaders (record counts, annotation summaries, latency quantiles,
cost summaries) all take this one opaque subquery.

`apply_session_filter_to_page(...)` takes the statement a caller is paginating and returns it
with the condition applied — directly when that is safe, and through the rowid subquery when
the condition reads annotations. The sessions list is its only consumer.

The split exists because a page is the one access pattern with an early exit to protect, and
protecting it means handing the compiler the statement rather than a set of row ids. Both
seams answer with the same sessions for the same condition, which is what keeps a filtered
count and a filtered list in agreement. Time scoping is shared for the same reason and uses
interval overlap: a session matches a window when their intervals intersect, identical to the
sessions table's time range behavior, which is what keeps them agreeing at window edges too.

## Correctness: the reference evaluator

`tests/unit/trace/dsl/session_filter_reference.py` executes the full language directly over
in-memory fixture sessions, implementing the missing-fails-comparison rule once, with
three-valued logic for `and`/`or`/`not`. The differential suite seeds the same fixtures into
the database and asserts, for every (fixture, condition) pair, that the compiled SQL selects
exactly the sessions the reference selects.

The reference is deliberately an independent implementation, not a port of the compiler.
Agreement between two independent implementations is the evidence; a shared bug would need to
be made twice. The corpus covers the edges the deviation rule creates: vacuous `all`, empty
`max`/`min`, missing element fields under both quantifiers and every reduction, `if`-clause
filtering, each iterable, and trace→span nesting. It also carries the case rule, which is the
one place the language does not simply inherit CPython: containment cases that differ only in
spelling, alongside the equality and list-membership forms that must stay exact.

The reference models the root-span names and `annotations[...]` too, which is where the
missing-value rules bite hardest and where stating them was not the same as enforcing them.
`first_input` and `last_output` read the two ends of the root-span window and are missing when
that end recorded nothing, so `not in` and `==` exclude those sessions; `any_input` and
`any_output` are existential over every root span, so `'x' not in any_input` *matches* a session
with no input at all. Both are pinned against fixtures that have no root span, no input, and a
child span whose input must belong to neither.

`annotations["q"]` compiles to an outer join, so a session with several rows under one name is
several candidate rows and matches when any of them satisfies the whole condition — which the
reference models by binding one row per referenced name and trying every combination. That makes
one invariant checkable, and it is checked directly: `annotations["q"].score > 0.9` and
`any(a.name == "q" and a.score > 0.9 for a in session_annotations)` select the same sessions,
under duplicate names, null scores and labels, and missing annotations, even though one lowers to
an aliased join and the other to `EXISTS`. The invariant covers the *positive* forms only.
`annotations["q"].score is None` deliberately also matches sessions carrying no `q` annotation at
all — the outer join contributes a null row — where the quantifier spelling does not, so the two
idioms answer different questions there and the corpus pins that difference rather than papering
over it.

## API Surface

The language is served over GraphQL only; the REST API has no filter surface. Four fields on
`Project` carry it:

```graphql
sessions(..., sessionFilterCondition: String): ProjectSessionConnection!
sessionCount(timeRange: TimeRange, sessionFilterCondition: String): Int!
validateSessionFilterCondition(condition: String!): ValidationResult!
sessionFilterVocabulary: [FilterVocabularyTerm!]!
```

A `sessionFilterCondition` argument also appears on the project's span- and trace-grain
summary fields (`recordCount`, `traceCount`, `costSummary`, the latency quantiles, the
annotation summaries), so those numbers can be re-scoped to the filtered sessions. A field
that accepts both a span filter and a session filter rejects requests that pass the two
together — the grains are mutually exclusive, not composable.

The session-grain statistics the sessions aside renders take it too
(`sessionAnnotationSummary`, `averageSessionDurationMs`, `averageTracesPerSession`,
`sessionDurationMsQuantile`). They are the reason the argument reaches this far: with the
sessions search box retired, the DSL is the only table filter, so a statistic that cannot
follow it is a statistic that disagrees with the rows on screen. Every one of them scopes
through the same helper as `sessionCount`, so the aside and the table always describe the
same sessions, and the aside's session count doubles as the page's match count.

**Release notes.**

- **Span filters now match text case-insensitively.** `in` and `not in` against a string —
  `'timeout' in output.value`, `'search' in name`, any attribute or annotation-label read —
  ignore case, matching how the session filter behaves. A saved span filter using `in` returns
  the same rows or more, never fewer; one using `not in` returns the same rows or fewer, never
  more. `==` and `!=` still match exactly.
- **`sessionFilterCondition` is an expression, not a substring.** On the seven span- and
  trace-grain fields that carried it before this change, the argument meant a substring of
  the session's input/output. Plain-text inputs no longer match anything by substring —
  express them as `'text' in any_input or 'text' in any_output`.

### The compile boundary

Callers reach these resolvers without validating first, so every surface that compiles a
session filter — the sessions connection, the counts, the summary fan-out, the four
session-grain statistics, and `validateSessionFilterCondition` itself — goes through one
compile path in `phoenix/server/session_filters.py`. Expressions the compiler cannot use
come back as `BadRequest`; planner and database failures are not the caller's fault and stay
server errors. Routing validation through the same path is what keeps `isValid` honest: it
reports invalid exactly when a resolver would reject the expression.

### Validation

`validateSessionFilterCondition` compiles the condition and renders the SQL under both the
SQLite and PostgreSQL dialects; any failure returns `isValid: false` with an error message.
Rendering catches *generation* failures, not *execution* failures — a boolean cast to a number
renders on both dialects, runs on SQLite, and fails on PostgreSQL — so `isValid: true` means
"compiles and renders", not "will execute on both backends". The forms that made that gap
observable (a quantifier used as a number, a NUL literal, a mixed `IN` list) are now rejected by
the acceptance policy before they reach rendering at all, which narrows the gap rather than
closing it: the claim this section makes is about generation, and stays that way.
`ValidationResult` also carries a `warnings` list, a third channel between valid and
invalid. A condition that compiles but references an annotation name never observed on the
project comes back valid *and* warned — the filter still applies, and the warning names the
observed alternatives. Warnings exist because dynamic names cannot be errors: the annotation
may simply not have arrived yet.

Checking a referenced name does not require enumerating the project's names: validation asks
whether the names in the expression exist, scoped to the project, and only reaches for a
suggestion list once it already has an unknown name to explain. That list is capped — a
warning is read aloud in a screen-reader live region, so it names the closest few observed
alternatives rather than every annotation on the project.

### Vocabulary

`sessionFilterVocabulary` returns one term per bindable name:

```graphql
type FilterVocabularyTerm {
  name: String!          # exactly as written in an expression
  type: String!          # string | number | datetime | boolean | iterable
  description: String!
  category: String!      # session | aggregate | attribute | annotation | iterable | element
  iterableName: String   # set on element fields, e.g. "spans" for spans.latency_ms
}
```

The static terms and their types are read from the compiler's own binding tables — the
anti-drift commitment made concrete. Every binding must have a description, enforced at
build time, so a new name cannot ship undocumented. Three hand-written terms
(`attributes[...]`, `user.id`, `metadata["key"]`) teach the attribute-access shape even on
an empty project.

Two term groups are data-derived:

- **Observed attributes.** The server scans the earliest root span of the project's 1000
  most recently started sessions — the same span the compiler reads — and serves one term
  per attribute key. Keys are served in canonical OTel spelling
  (`attributes["llm.model_name"]`), however ingestion nested them, so one key never appears
  as two terms. The nested spelling remains an accepted synonym in the compiler but is not
  served. The scan is bounded because it is discovery, not correctness: an unlisted key
  still filters fine when typed by hand. A row bound alone says nothing about cost, since
  the scan reads whole attribute blobs, so it also stops at a byte budget.
- **Observed annotations.** Each observed annotation name is served as ready-to-use
  `annotations["name"].score` and `.label` terms, drawn from the same recent-session window
  as the attributes so the vocabulary carries one contract rather than two.

The consequence of that one contract is worth stating plainly, because it is what a user
notices: a name only older sessions carry drops out of the suggestions once 1000 newer
sessions exist. It has not stopped working — typed by hand it filters exactly as before.
The vocabulary is a discovery aid, and completeness is not something it promises.

## The Filter Bar

The sessions table hosts a code-editor filter field. It is the single search surface: the
older substring search box and its bespoke query path were retired, because the language
already expresses those searches (`session_id == '...'`, `'refund' in any_input`) and two
surfaces answering one question can disagree. The field itself is grain-agnostic: the
session layer injects the vocabulary, the snippets, the loop-variable names, and the
validation call, so a future trace grain reuses the component unchanged.

### Discovery

The typeahead is one ranked list of sections: recent searches, then suggestions (snippets),
then the session fields, aggregates, collections, attributes, and annotations. While the
user browses with nothing typed, the list is capped to five snippets and thirty fields.
Collections rank ahead of the data-derived attribute and annotation sections on purpose:
the core language must survive the cap, and the sections that grow with the user's data are
the right ones to lose to it.

Snippets follow two rules. Every snippet is valid as inserted — placeholders carry working
example values, never blanks, because a condition that errors until a blank is filled reads
as broken rather than as an invitation to edit. And each snippet teaches something no other
snippet covers. The five that survive the browse cap show one construct each: text search, an
aggregate, a quantifier, a reduction, a nested comprehension.

Text search holds a slot by right, not by luck. It is the query the retired search box used
to serve, so a user who reaches the sessions table looking for the old field has to find its
replacement without knowing the language first — and the snippet searches input and output
together, because the box it replaced matched either side. Ordering is a separate mechanism
from membership: array position decides which snippets make the cap, while the dropdown sorts
the survivors alphabetically within their section, so the search snippet carries a completion
boost to lead the group.

### Writing comprehensions

Completion is scope-aware around comprehensions. In the iterable slot of a `for` clause it
offers plain collection names. Inside a comprehension body it offers the loop variable's
element fields, always qualified (`span.latency_ms`, never the bare field the compiler
would reject). Inside a freshly typed `any(` it offers whole comprehension bodies.
Accepting a collection is position-aware too: at top level it inserts a full working
scaffold — `any(span.latency_ms > 1_000 for span in spans)` — with the example predicate
selected for immediate overtyping.

The scope detector is a text heuristic, not a parse, by necessity: a comprehension mid-edit
is not valid Python, so no syntax tree exists at exactly the moment completion matters. An
unrecognized collection name simply degrades to ordinary completion.

### Validation in the loop

The field validates as the user types, debounced, through the GraphQL validation field.
Errors and warnings surface as a single in-field badge with the message in its tooltip; the
typeahead stays the only floating window the field opens on its own, so an error can never
fight the dropdown for space. Comprehension errors get a wavy underline over the construct
— best effort, since server errors carry no character offsets. Only conditions that
validate are applied to the table; the in-progress text lives in separate state and an
invalid expression never reaches the server. A failed validation request is itself surfaced
as an error, so a normal-looking field never silently drops the filter.

Recent searches persist per project in browser storage. A condition enters history only
after the user sits with it for a few seconds — the filter applies live, so the dwell
separates searches the user meant from stepping stones on the way to them.

## Future Work

- **Trace grain.** The family is designed to extend to a trace filter language with the same
  flavor; the compiler is already grain-parameterized.
- **Session names inside comprehensions.** Lifting the loop-variable-only restriction so a
  predicate can compare an element field against a session field.
- **JSON-backed iterables.** Messages, documents, and events as iterables, once their access
  patterns settle.
- **Cumulative token fields on span elements.** Additive, for tree-shaped questions where
  rollups are the point.
- **Python execution.** Running the same expressions as actual Python inside evaluator
  bindings, with the reference evaluator's semantics as the contract.
- **A vocabulary benchmark.** The harness measures filter execution; nothing measures the
  vocabulary resolver that feeds the filter bar. That needs its own script: configurable
  distinct annotation-name counts, attribute payload sizes, and leaf-path cardinality across
  project-size tiers, reporting rows and payload bytes decoded on both a cold and a warm run.
