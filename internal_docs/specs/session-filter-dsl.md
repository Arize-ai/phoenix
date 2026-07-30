# Session Filter DSL

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

This commitment currently has one open exception: string containment ignores case at the
session grain and not at the span grain. It is recorded, with its reason and the question it
is waiting on, under [Case](#case-containment-ignores-it-equality-does-not).

### Python with a SQL backend, not Python-flavored SQL

A filter condition is real Python, and Python defines what it means. The same expressions are
meant to later run as actual Python inside evaluator bindings, so the two execution worlds
must agree. The spec of correctness is therefore a small Python reference evaluator, and the
SQL compiler is correct exactly when it agrees with the reference on every test fixture (see
[Correctness](#correctness-the-reference-evaluator)). Behavior is inherited from CPython
rather than designed: `all()` over an empty selection is true, `len([])` is `0`, `sum(())` is
`0`, and `len(...)` accepts a list comprehension but not a generator.

### Legislated deviations from Python

Filters cannot raise an exception per row, and SQL NULL does not behave like a Python value.
So the language legislates a deviation from Python: a missing value fails every comparison. A
session with no recorded input, a span with no token counts, an empty `max(...)` — comparing
any of these against anything is false, in both directions. Sessions with the value genuinely
missing are targeted explicitly with `is None`.

There is one other: `in` against a string haystack ignores case at this grain, where Python's
is exact (see [Case](#case-containment-ignores-it-equality-does-not)). Both departures are
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

Datetime comparands are ISO 8601 strings, e.g. `start_time > '2026-07-01'`; values without a
timezone are read as UTC.

### Aggregates

Per-session rollups, computed on demand. Each is `0` when the session has no matching data —
never null:

| Name | Meaning |
| --- | --- |
| `num_traces` | Trace count, ≈ conversation turns |
| `num_traces_with_error` | Traces containing an errored span |
| `token_count_prompt`, `token_count_completion`, `token_count_total` | LLM token totals |
| `prompt_cost`, `completion_cost`, `total_cost` | Cost totals |
| `tool_span_count`, `llm_span_count` | Spans of kind TOOL / LLM |

### Root-span access

A session has no attributes of its own, so several names read from the session's spans:

- `attributes["llm.model_name"]` — attribute access on the session's *earliest root span*,
  addressed by OTel wire key. String subscripts are joined with dots, so
  `attributes["llm"]["model_name"]` names the same key. The lookup matches the key however
  ingestion nested it. A missing key is treated as missing (see the deviation rule above).
- `user.id` and `metadata["key"]` — accepted shorthands for the matching `attributes` keys.
- `first_input` / `last_output` — the root-span input of the first trace and output of the
  last trace, as strings. Useful for "did the session end well" checks.
- `'refund' in any_input` / `any_output` — containment over *some* root span's input or
  output, anywhere in the session. Cheaper than the first/last forms and the right default
  for "does this session mention X". These two are containment-only: they take `in` and
  `not in` against a string literal and never `==`, and the served vocabulary types them
  `containment` so autocomplete does not invite the equality form.

### Annotations

`annotations["quality"].score > 0.8` reads session-level annotations, using the same idiom as
the span language. Annotations on individual spans are reached through the `span_annotations`
iterable below.

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
  stops there.
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
- **Case-sensitive containment is gone, not hidden.** With `in` case-insensitive at this
  grain (see [Case](#case-containment-ignores-it-equality-does-not)), there is no way to ask
  for an exact-case substring. That is a real loss, accepted because searching text is
  overwhelmingly the case-insensitive question and a second operator on day one is vocabulary
  users have to learn before they need it. If the exact form is wanted later it is purely
  additive — a distinct operator alongside `in`, never a change to what `in` means.

### Case: containment ignores it, equality does not

`in` and `not in` against a string haystack ignore case, everywhere in the session language —
`any_input`, `any_output`, `first_input`, `last_output`, `session_id`, root-span attribute
reads, and annotation labels alike. `==` and `!=` stay exact, and so does membership in a
literal list (`span.name in ["search", "lookup"]`), which is a set test rather than a text
search. So `'refund' in first_input` finds a session that opened with `REFUND please`, while
`first_input == 'refund please'` does not.

The reason is the surface this language replaced. The sessions table used to carry a separate
substring search box that matched case-insensitively; retiring it in favor of the DSL would
otherwise have quietly narrowed what users could find. Searching text is the case where
people mean "mentions this", not "spells it exactly this way", and a filter that silently
misses `REFUND` reads as broken rather than as precise. It compiles to PostgreSQL `ILIKE` and
SQLite's `text_lower` on both operands — the same mechanism the retired search used, so the
non-ASCII and wildcard-literal behavior carries over unchanged.

**This diverges from the span grain, deliberately and provisionally.** Span-grain `in` is
still case-sensitive. That breaks the one-flavor commitment above, which is why it is called
out here rather than buried: whether to flip the span grain too is an open question for the
span language's owners, and until it is answered a user who moves between the two views gets
two different answers to the same-looking query. The divergence lives in one place — a
per-grain flag on the shared compiler's bindings — so resolving it either way is a one-line
change, not a refactor.

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
- `all(...)` → `session_id NOT IN (SELECT session_key … WHERE predicate IS NOT TRUE
  AND session_key IS NOT NULL)`
- `len`/`sum` → a `(session_key, aggregate)` subquery grouped by session and LEFT JOINed on
  the session row, read through a `COALESCE(…, 0)`
- `max`/`min` → the same grouped subquery, read raw so an empty set stays NULL

The two lowerings agree by construction. A session with no matching elements is absent from
the `any` set and absent from the `all` counterexample set, which is exactly the vacuous-truth
rule; `len` and `sum` coalesce to `0`; `max` and `min` stay NULL and so fail every comparison.
The `session_key IS NOT NULL` guard on `all` is required, not defensive:
`Trace.project_session_rowid` is nullable, and SQL `NOT IN` returns no rows at all when its
subquery yields a single NULL.

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

**Release note.** On the seven span- and trace-grain fields that carried
`sessionFilterCondition` before this change, the argument meant a substring of the session's
input/output. It is now a filter expression. Plain-text inputs no longer match anything by
substring — express them as `'text' in any_input or 'text' in any_output`.

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
