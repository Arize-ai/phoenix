# Design: MCP Analytics SQL Surface

## Problem

Phoenix exposes its data through a GraphQL API and a REST API, both of which
answer a fixed set of questions. An agent asked an analytical question that
nobody anticipated — "which model has the worst p95 latency in this project
this week", "which prompts produce the most retries" — has no way to reach it.
It can page through spans and aggregate them itself, which costs a large number
of round trips and a correspondingly large amount of context, or it can give
up.

The database can answer these questions directly. What is missing is a way to
let an agent ask, without handing it the ability to read tables it should not
see, run statements that never terminate, or return more data than a context
window can hold.

## Goals

- Let an agent express an analytical question as SQL and receive the answer.
- Bound what any single statement can read, cost, and return.
- Describe the schema well enough that a competent model writes correct SQL on
  the first attempt.
- Keep that description cheap enough that schema discovery does not dominate
  the caller's token budget.

## Non-goals

- **Not a confidentiality boundary.** See [Threat model](#threat-model).
- No writes, DDL, or transaction control.
- No cross-database or federated queries.
- No query optimisation on the caller's behalf beyond what the engine does.
- No caching of results.
- No stored or named queries.

## Correctness: who authored the behaviour

Correctness questions on this surface almost always arrive in the same form. A
caller gets a result they did not expect, or two backends answer the same
statement differently, and someone has to say whether that is a defect. One
question settles it: who authored the behaviour that produced the result. What
this surface authored is ours to get right. What an engine authored is the
engine's, and the caller is entitled to rely on its documentation.

|  | this surface authored it | an engine authored it |
|---|---|---|
| **what a statement means** | we changed the meaning, so we repair it | the engines differ, so the difference passes through |
| **what is available to use** | the concept is ours, so both backends must agree | capability differs, so allow it where it runs and refuse elsewhere with a working spelling |

The four rules below are that question applied. Each carries the case it
settles.

- **The answer must answer the question that was asked.** The statement is
  rewritten freely — stars expanded, derived columns substituted, a limit
  injected — but never so that the result means something other than what the
  caller's SQL asked for. *Case:* SQLGlot renders a caller's `json_extract` as
  `->`, which returns JSON text instead of a value, so `MAX` compares
  lexicographically. Our pipeline changed the meaning, so we repair it.
- **Concepts this surface invents must mean one thing.** `latency_ms` and
  `graphql_node_id` exist nowhere else, so no specification defines them and
  nothing outside this package can check them. *Case:* `latency_ms` computes a
  different number on each backend. That is ours by definition, because two
  implementations of a concept we invented have nothing to agree with except
  each other.
- **Engine behaviour passes through.** *Case:* `->>` returns a typed value on
  SQLite and text on PostgreSQL, so `max` over a numeric JSON path answers
  `130000` on one and `'9'` on the other. Both engines are behaving as
  specified, so we neither reconcile it nor refuse it, and the schema teaches
  the cast.
- **Capability may differ, and a refusal must be actionable.** *Case:*
  `percentile_cont(...) WITHIN GROUP` has no SQLite grammar. The gap is the
  engine's, so the construct is admitted on PostgreSQL and refused on SQLite
  with a message naming `percentile(x, p)`.

## Threat model

This is the decision that most shapes the rest, and it was originally stated
wrongly in the code.

**The surface is open to any caller who reaches the MCP mount.** It reads
telemetry, datasets and experiments. Phoenix already lets any authenticated
user read all of that through GraphQL: exactly four queries carry `IsAdmin` —
`users`, `user_api_keys`, `oauth2_grants`, `system_api_keys` — and none of
those tables is allowlisted here, while `projects` and everything reachable
from it carries no permission class at all.

An earlier ADMIN/SYSTEM check was therefore *stricter for this data than the
API beside it*, refusing in SQL what the same caller could fetch in GraphQL. It
has been removed.

What bounds the surface is **capability, not identity**:

| Bound | Value |
|---|---|
| Statements | one read-only statement: `SELECT`, `UNION`, `INTERSECT`, `EXCEPT` |
| Rows | 500 default, 5000 maximum |
| Bytes | 256 KiB per row, 4 MiB per response |
| Deadline | 30 s (`statement_timeout` on PostgreSQL, progress handler on SQLite) |
| Concurrency | 4 concurrent on PostgreSQL, 1 on SQLite; queue depth 8 |

The adversary this design defends against is a **confused or steered model**,
not a malicious user seeking data they cannot otherwise obtain. Every control
above limits blast radius. None of them limits access to information the caller
could not get elsewhere.

Two consequences follow, and both are deliberate:

- **Omitted columns are curation, not secrecy.** See
  [Column omission](#decision-columns-are-omitted-for-being-uninformative).
- **Contention is the residual risk.** With SQLite the execution width is 1, so
  one slow query serialises every other analytics request until its deadline.
  The row limit, byte caps and deadline bound each query; they do not bound
  contention.

A separate concern this design does **not** address: `spans.attributes` and
`spans.events` contain text written by whatever application is being traced,
which usually means by that application's end users. Results are returned to a
model that, on the same MCP server, holds tools annotated as destructive.
Nothing here marks returned rows as untrusted content. That is a gap, recorded
in [Open questions](#open-questions).

## Architecture

A statement passes through six stages. One parses, two are policy gates, one
transforms, one generates the text that runs, and the last hands the result to
backstops belonging to the engine.

```
caller SQL
   │
   ├─ 1. parse            SQLGlot, one statement; SELECT or set operation
   ├─ 2. admission        allowlist over the parsed tree
   ├─ 3. rewrite          star expansion, derived columns, timestamp
   │                      literals, JSON canonicalisation, schema
   │                      qualification, limit injection
   ├─ 4. post-rewrite     relations and schema qualification re-checked
   ├─ 5. render           the tree is generated back into SQL text
   │
   └─ 6. execution        SQLite: authorizer callback
                          PostgreSQL: EXPLAIN plan gate
```

The caller's text is read once, at stage 1, and never read again. Every stage
after it works on the tree. The statement the database runs is generated from
that tree at stage 5, which means the database never sees what the caller
typed. Stage 5 is unconditional: there is no path on which an unmodified
statement is passed through as text, and there could not usefully be one, since
limit injection and schema qualification apply to every statement.

### A statement, end to end

This is a real trace, not an illustration. The caller submits:

```sql
SELECT latency_ms FROM spans WHERE name = 'chat'
```

`latency_ms` is a virtual column, so it is replaced by a per-dialect
expression. The substitution is parenthesised as a whole, so it binds exactly
where a column would:

```sql
SELECT (EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) AS latency_ms
FROM spans WHERE name = 'chat'
```

Schema qualification then resolves `spans` against the connection, and limit
injection appends `row_limit + 1` so that truncation is detectable rather than
assumed. This is the string PostgreSQL receives:

```sql
SELECT (EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) AS latency_ms
FROM public.spans
WHERE name = 'chat'
LIMIT 501
```

Four passes did nothing to this statement. It contains no `*`, so star
expansion had nothing to expand. It names no node id, compares against no
timestamp literal, and JSON canonicalisation is SQLite-only. The envelope
reports the three that did fire.

The last block is a different string from the one the caller submitted. It was
printed from the tree rather than edited from the caller's text. Every
property this design depends on — that the limit is present, that only
allowlisted relations appear — is a property of the tree, and holds of the
executed statement only because the executed statement is printed from that
tree. What follows from that is recorded under [allowlisting the parsed
tree](#decision-allowlist-the-parsed-tree-not-the-statement-text).

### Stage 2 — admission

Over the parsed tree, never over text. Four dimensions are **allowlists** —
node classes, function classes and names per dialect, relations, and cast
targets. Columns are **not**: they are a case-folded *denylist* of the columns
the manifest omits, so a name in neither list is admitted and only the engine
rejects it. `SELECT this_column_does_not_exist FROM spans` reaches PostgreSQL.

The two directions are mixed, and that is the standing weakness recorded in
[Open questions](#open-questions), not a resolved one. An allowlist fails
closed on an unfamiliar input and a denylist fails open, which is why an
unrecognised table spelling is refused while an unrecognised column spelling is
not.

One defect in that area has been fixed, and it is worth stating what it did and
did not settle. The denylist compared column names case-sensitively while both
engines resolve unquoted identifiers case-insensitively, so `SELECT
GRADIENT_START_COLOR` and `SELECT USER_ID` returned exactly the data their
lowercase spellings are refused for. Both sides are now case-folded. That
closed one spelling of a *known* omitted column; it did not change the
direction of the check, and a column nobody has thought to omit is still
admitted by default.

### Stage 3 — rewrite

Seven passes, in this order. The order is load-bearing, not incidental:

1. **Star expansion** — `*` becomes the exposed column list plus virtual
   columns, so it matches what the schema advertises. First, because it *emits*
   `latency_ms` and `graphql_node_id` for the next two passes to resolve;
   reversing it would send them to the engine unsubstituted.
2. **`latency_ms`** — substituted with a per-dialect expression.
3. **`graphql_node_id`** — decoded in a predicate, built in a projection, with
   the type resolved per reference through the qualifier.
4. **Timestamp literals** — a literal compared against a timestamp column is
   re-emitted in the layout the backend compares correctly. PostgreSQL parses
   its own literals, so this is SQLite-only in effect; on both dialects a bare
   date is recorded in `notes` as having been read as UTC.
4. **JSON canonicalisation** (SQLite only) — accessors are rewritten to the
   spelling the deployment's expression indexes use.
5. **Schema qualification** — allowlisted relations are qualified with the
   resolved PostgreSQL schema.
6. **Limit injection** — `row_limit + 1`, so truncation is detectable rather
   than assumed.

### Stage 4 — post-rewrite check

Verifies that the rewritten tree references only allowlisted relations, each
correctly schema-qualified.

**This is strictly weaker than admission**, and cannot be made equal to it: the
rewrites deliberately emit SQL admission would refuse — `encode` and
`convert_to` as anonymous functions. The property actually
guaranteed is "no new relation appeared", not "still admissible". This is a
known weakness, recorded in [Open questions](#open-questions).

### Stage 6 — engine backstops

The SQLite authorizer callback and the PostgreSQL `EXPLAIN` plan gate see the
statement *after* rendering, which is a different thing from what admission
saw: `json_extract(x, path)` is emitted as the `->` operator, and functions the
caller never named appear under their SQL names.

**They are not equivalent to each other.** The SQLite authorizer denies any
non-allowlisted function wherever it appears. The plan gate examines relations
and set-returning nodes, and reads scalar function names out of `ProjectSet`
expression *text* — which cannot distinguish a function from a keyword and does
not see ordinary scalar calls at all. So a hole in admission's function policy
is backed by a second layer on SQLite and unbacked on PostgreSQL.

## Design decisions

### Decision: capability is per-backend, divergence in answers is not

The function policy is a union with declared differences, not an intersection.
Each backend gets what it can do — `percentile`, `julianday` and `json_each` on
SQLite; ordered-set aggregates and the JSONB surface on PostgreSQL — on top of
28 portable node classes. Capping the surface at the lesser of the two engines
would delete real capability from both for the sake of symmetry.

The JSON surface is sized by where the data is rather than by what is portable.
Nearly everything this deployment stores sits in `spans.attributes`, so reading
into a document is most of what there is to ask of it, and both backends get as
much of their own JSON vocabulary as is pure and bounded by the document it
reads. On PostgreSQL that is key existence (`?`, `?|`, `?&`), containment (`@>`,
`<@`), path tests (`@?`, `jsonb_path_exists`, `jsonb_path_match`), path queries,
key enumeration, and the size, rendering and construction functions. On SQLite it
is the json1 equivalents: `json_array_length`, `json_valid`, `json_pretty`,
`json`, `json_quote`, `json_array`, `json_object`, and the two group aggregates.

Each capability is admitted on both backends wherever both can express it.
Aggregation into one document is `jsonb_agg` and `jsonb_object_agg` on
PostgreSQL and `json_group_array` and `json_group_object` on SQLite; all four
amplify, collapsing N rows into a cell that grows with N, and all four are
admitted on the terms `group_concat` already established — the per-cell byte
limit rejects an oversized result and the deadline bounds the work.

Producing a modified copy is admitted too: `jsonb_set`, `jsonb_insert` and `#-`
on PostgreSQL, `json_set`, `json_insert`, `json_replace`, `json_remove` and
`json_patch` on SQLite. None of them writes. Each returns a new document bounded
by its inputs, which is the same shape of operation as `jsonb_strip_nulls`, and
removing a large member before it crosses the per-cell byte cap is a use this
surface has reason to want.

What is left is a genuine difference in what the engines can express. SQLite has
no key-existence or containment operator and no SQL/JSON path functions, so those
questions are asked there with `json_extract(...) IS NOT NULL` and `json_each`.
That refusal is carried in the corpus, per the rule that an undeclared asymmetry
is indistinguishable from a gap.

A gap in a hand-maintained set is invisible until someone writes the statement it
omits, and the refusal that results names a parser class rather than anything the
caller wrote: `?` reports `jsonb_contains`, which is not PostgreSQL's function for
it, and `@?` reports `j_s_o_n_b_path_exists`, which is not a name that exists
anywhere. `sql_names()` has no function spelling for an operator, so the fallback
snake-cases the class. Both halves of that — the silent gap and the unactionable
message — belong to [open question 3](#open-questions).

Which divergences are acceptable is settled by [who authored the
behaviour](#correctness-who-authored-the-behaviour). Two consequences of that
rule shape this policy in particular.

A concept this surface invents carries the whole burden of agreeing, because
nobody can check it against a specification. A refusal is recoverable and a
quietly different number is not.

Engine semantics are not ours to reconcile, and trying would be worse than
leaving them alone. Making `->>` agree across the two backends would mean
either overriding a database's documented behaviour or degrading the backend
that already does the useful thing. The schema's populated-path comments are
where a caller learns that a path is numeric and needs a cast.

So an asymmetry is a decision, and is recorded as one. `admission_corpus.jsonl`
carries the same statement twice, once per dialect, with the outcome and the
reason. An undeclared asymmetry is a bug by definition, because nothing
distinguishes it from a gap.

### Decision: allowlist the parsed tree, not the statement text

Text-level filtering is defeated by comments, whitespace, case, unicode, and
nested constructs. Parsing first means the policy and the engine read the same
artefact, because the statement the engine runs is printed from the tree the
policy inspected.

The cost is a dependency on SQLGlot's parse being faithful, and that dependency
is heavier than it first appears. An unfaithful parse does not put the policy
out of step with the engine. Those two go on agreeing, because both of them
derive from the tree. It puts both of them out of step with the **caller**,
whose text was discarded at stage 1 and is never consulted again.

Nothing downstream can detect that, for two reasons. Every downstream check
reads the same wrong tree, so there is no second opinion anywhere in the
pipeline. And the round trip is stable on a wrong tree: parsing, rendering and
parsing again returns what it was given, so a self-consistency check passes.

Two practices follow from the dependency. Admission refuses node classes it
does not recognise rather than ignoring them. `admission_corpus.jsonl` records
every construct that ever slipped through. Neither reaches a construct that
parses cleanly into the wrong shape, which is [open question
6](#open-questions).

### Decision: rewrite the statement rather than reject what needs rewriting

A caller asking for `latency_ms` is asking a question the schema advertises.
Refusing it and explaining the correct expression costs a round trip and
assumes the model will get it right. Substituting is one exchange.

The cost is that the executed statement can come to mean something the caller
did not ask for. Two mitigations address the passes. Substituted expressions are
parenthesised as a whole, so they bind exactly where a column would. The
liveness suite executes every permitted construct against seeded rows rather
than an empty table.

Neither mitigation reaches the other source of a changed meaning, which is the
parse itself. A pass can only be as correct as the tree it is handed. A tree
that already misrepresents the caller's statement will be rewritten faithfully
into a statement that misrepresents it too, and both mitigations above will
report success. See [open question 6](#open-questions).

### Decision: the schema is DDL, not JSON

`describeSqlSchema` returns `CREATE TABLE` statements with `--` comments.

- **Measured:** fewer tokens than the equivalent JSON, which repeats
  `name`/`type`/`nullable` for every column. The figure moved as the renderer
  gained constraints and column notes; `ddl.py` carries the current one, and
  this document deliberately does not restate it, because two copies of a
  measurement drift and neither says what was compared.
- **Structural:** a JSON type is an abstraction and DDL is not. The manifest
  calls `start_time` a `datetime`, which is true of both backends and useful to
  neither — it is `TIMESTAMP` on SQLite and `TIMESTAMP WITH TIME ZONE` on
  PostgreSQL, and a caller writing a comparison needs the real one.
- **Native:** it is the form the caller writes back.

Curation the database cannot supply — areas, grain, join paths, populated JSON
paths, per-column notes — rides along as comments. The rendering is parsed
before it is returned, because a generator emits text that reads like DDL and
is not, and the caller cannot tell because it is prose to them.

### Decision: the schema is text, the result is a dict

The two tools return different shapes because they are consumed differently.

`describeSqlSchema` returns prose. Nothing parses it, so a JSON wrapper adds no
structure a reader uses, and it escapes every newline in a document that is
mostly newlines — 174 tokens at `detailed`, about 7%. `output_schema=None`
additionally suppresses the structured mirror, which for prose is a verbatim
repeat of the text block.

`executeSql` returns a dict, so a result set arrives as data rather than as
something to parse.

**On the duplication.** MCP's `CallToolResult` carries a required `content`
list and an optional `structuredContent`, and emitting both is the convention:
the text block is what every client can read, the structured view is for those
that understand it. It is not waste, and on the path this surface is actually
driven from it costs nothing at all — see [Consumption
model](#consumption-model).

### Decision: the result envelope carries only what varies

Every field that cannot take a second value was removed. Before the split, a
one-row result was 696 bytes of which 53 were the row and 401 could not have
differed: an `availability` map hardcoded to report every area available, a
literal `read_only: true`, the byte caps, and a `consistency` note repeated
verbatim on every call.

Those are properties of the surface, so `describeSqlSchema` carries them
instead — once per call of that tool, which a caller makes far less often than
it runs a query.

### Decision: columns are omitted for being uninformative

`hidden_columns` lists display attributes — a project's gradient colours — and
foreign keys into tables this surface does not expose, whose integer values
resolve to nothing a caller can reach.

**This is curation, not confidentiality.** Every omitted column is readable
through GraphQL by the same caller. Anything genuinely restricted is absent
from the allowlist entirely rather than listed here.

The omission is nonetheless *enforced* — absent from the DDL, absent from
`SELECT *`, and refused by admission — because a schema that omits a column and
an executor that returns it disagree about what the surface is. Consistency is
the reason, not secrecy, and the error message says so.

An omitted column is declared beside the column list rather than deleted from
it. That keeps the drift check against the SQLAlchemy models comparing complete
lists on both sides. The reason to want that is a column dropped by a migration:
it must fail the drift test, rather than resemble a column somebody omitted on
purpose.

### Decision: no default time window

An earlier version injected a trailing seven-day window when the caller gave
none. It could not bound a determined caller, since defeating it cost one
parameter, and for everyone else it answered a different question than the one
asked while reporting success. Across roughly twenty-five cold-agent runs every
caller noticed it and worked around it, so it protected nobody and charged
everybody a round trip.

The row and byte caps bound the answer; the deadline bounds the work.

### Decision: reads avoid the writer, by two different routes

Phoenix gained a dedicated SQLite read engine (`mode=ro`, queue pool) so reads
stop queueing behind the writer's single `StaticPool` connection. Measured at
490 statements/s with `NullPool` against 3,879/s with a queue pool, which is
why that is a pool rather than a connection per read.

This surface uses it for the PostgreSQL execution path and for catalog reads —
index reflection, engine version, schema resolution — through `db.read()`.

**SQLite `executeSql` deliberately does not.** It opens its own
`sqlean.connect(...?mode=ro)` per statement, because the authorizer callback
and the progress handler that bound the query are per-connection and must not
outlive it: on a pooled connection the next caller would inherit them, or they
would be stripped mid-query. `mode=ro` is also fixed at open time and cannot be
imposed afterwards. Nothing is lost by forgoing the pool there, because the
SQLite execution width is 1 — one statement runs at a time regardless.

Read-your-writes is not guaranteed on the pooled path, which is stated on
`DbSessionFactory.read` — it already was not, against a PostgreSQL replica.

### Decision: physical facts come from the database, curation from the manifest

Column names, types and nullability are compiled from the SQLAlchemy models per
dialect. Indexes are read live from `pg_get_indexdef` and `sqlite_master.sql`,
because SQLAlchemy's reflection silently drops expression indexes — which are
exactly the ones a caller must reproduce.

The manifest supplies what the database cannot know: which area a table belongs
to, what one row means, how to reach the project, which columns are omitted,
and which are virtual.

The PostgreSQL schema is resolved against the connection rather than assumed,
by the rule [#14172](https://github.com/Arize-ai/phoenix/pull/14172)
established for database usage statistics: the environment variable when set,
otherwise the schema an unqualified `projects` reference resolves from. Not
`current_schema()`, which reports where a `CREATE` would land rather than where
the table is — the two diverge once `search_path` gains a leading entry after
migration. Both tools use the same resolution, because a schema published by
one and read by the other must be the same schema.

What remains unverifiable is `time_column`, `grain` and `column_notes`.
`time_column` is the consequential one: it decides silently which relations a
caller's window filters.

## Consumption model

Token accounting for this surface depends on how the client calls it, and the
default is not the obvious one.

Under **MCP code mode** — the default, and what `scripts/mcp_analytics_sql`
assumes — the model does not receive tool results. It writes Python that calls
`call_tool(...)`, which returns a **deserialized dict**, and only what that code
returns reaches the model's context. Intermediate results are filtered and
aggregated inside the sandbox.

Measured across five orchestrated `executeSql` calls:

| | |
|---|---|
| Envelopes fetched inside the sandbox | 11,522 bytes |
| Reaching the model's context | ~200 bytes |

So the `content`/`structuredContent` duplication is invisible here: the code
sees neither representation, only the dict. Per-call envelope size matters much
less than it would if every result were surfaced — which is the reason
`executeSql` returns structured data rather than text, and the reason trimming
the envelope was worth doing anyway, since a caller that *does* surface results
pays for every field.

For a client that renders each tool result directly, both halves are charged
for. That is the case `output_schema=None` on `describeSqlSchema` addresses.

## Testing strategy

The dominant defect class in this surface has been **two policy layers with a
transformer between them, each verified alone and never against each other**.

Two properties of that class shape the suite. Defects have been introduced by
the fix for an earlier defect: the first version of the `::text[]` workaround
matched the cast anywhere in an index body, which broke
`array_length('{a,b}'::text[], 1)` — a cast that resolves a polymorphic
argument rather than a JSON path. And defects have survived a test that
appeared to cover them: the admission corpus built every fixture table with no
columns at all, so its column entries exercised a check that returned at its
first line.

The suite is therefore organised against the class rather than against the
individual failures, which are recorded in the commits that fixed them:

- **Admission corpus** (`admission_corpus.jsonl`) — data rather than code, one
  entry per construct that ever slipped through, with the outcome it must now
  produce. The cheapest way to weaken an allowlist is to widen it while the
  tests keep passing.
- **Liveness** — every permitted construct executes against seeded rows and
  must return them. Executing against an empty table verifies that the parser
  and the authorizer agree and nothing about whether the construct computes.
- **Node coverage** — pins the reachable non-`Func` expression classes, since
  several bypasses came from classes that are not what they appear.
- **Document-versus-executor** — `SELECT *` expansion is compared against the
  rendered DDL for every table, so the two lists cannot drift apart. This is
  the check that exists, and it is static. Submitting every advertised column,
  join hint and `CHECK` literal through the executor is *not* automated. That
  was done by hand during review, and it is what found the surface refusing its
  own output: `describeSqlSchema` published an index expression containing
  `'{session,id}'::text[]` under a heading telling the caller to reproduce it
  exactly, while admission refused every array cast target. A reader should not
  assume CI would catch the next one.
- **Rendered DDL parses** — a generator fails in ways handwritten DDL does not.

### Seeing it run

Both snippets below paste whole into the MCP Inspector. The surface is driven in
[code mode](#consumption-model), so a call is Python that returns the tool's
deserialized dict rather than a form to fill in.

`describeSqlSchema` at `full` detail is the call worth making, because `full` is
the only level that reads the live catalog:

```python
return await call_tool(
    "describeSqlSchema",
    {
        "tables": ["spans"],
        "detail": "full",
    },
)
```

It returns the `spans` DDL with its curation comments, the preamble rules for
writing JSON operators, and the deployment's expression indexes rendered as
`CREATE INDEX`. The index section is the part to read closely. An expression
index is usable only when a query repeats its expression character for
character, so those spellings are a requirement rather than a hint, and a caller
who has not seen them cannot guess which of several equivalent forms was the one
indexed.

`executeSql` can then ask a question no fixed API answers, because its
dimensions are not known ahead of time — tail latency per model, where the model
name is a JSON path rather than a column:

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT attributes #>> '{llm,model_name}' AS model,
               count(*) AS calls,
               round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1) AS p95_ms
        FROM spans
        WHERE attributes ? 'llm'
        GROUP BY model
        HAVING count(*) > 5
        ORDER BY p95_ms DESC
    """
    },
)
```

Four things in that statement are worth noticing, and each is a decision recorded
elsewhere in this document.

`attributes #>> '{llm,model_name}'` is the spelling `describeSqlSchema` publishes
for an indexed path, cast and all — which is to say, without one, because a path
literal needs no cast. `attributes ? 'llm'` is a key-existence test, admitted on
PostgreSQL and absent from SQLite, which is a [declared
asymmetry](#decision-capability-is-per-backend-divergence-in-answers-is-not)
rather than a gap. `percentile_cont(...) WITHIN GROUP` is admitted here and
refused on SQLite with a message naming `percentile(x, p)`. And `latency_ms` is
not a column at all.

That last one is visible in the answer. The envelope reports
`applied.rewrites` as `latency_ms`, `schema_qualification` and
`limit_injection`: the virtual column was substituted with a per-dialect
expression, `spans` was resolved against the connection, and `row_limit + 1` was
appended so a truncated answer is detectable rather than assumed.

## Open questions

Ordered by how much they would change the design.

1. **The boundary is drawn in the parser, over identifiers, while the data is
   reachable through values.** Four rounds of review produced four different
   ways to reach an omitted column: case variation, `USING`/`NATURAL JOIN`,
   row-valued references (`SELECT p FROM projects p`), and a table alias
   shadowing a CTE name. Each was fixed; the shape that produces them was not.
   The alternative is to make the *relation* the boundary — a dedicated role, a
   schema of views projecting only exposed columns, `GRANT SELECT` on views
   only — so that omission is projection rather than parsing. This matters less
   than it would if the omissions were confidential, which they are not.

2. **There is no positive column policy.** Tables are allowlisted; columns are
   denylisted. A column added to an allowlisted table by a future migration is
   exposed by default, and the manifest drift test is a CI control rather than
   a runtime one.

3. **One policy, ten enumerations, four vocabularies.** "Which computations may
   run" is written down in ten places, expressed as SQLGlot classes, caller
   spellings, SQLite authorizer names, and PostgreSQL plan identifiers. No set
   is derived from another; agreement is maintained by tests, and four
   divergences are recorded in the code comments. A generated capability table
   would make a missing cell fail at import.

5. **Results are not marked as untrusted content**, though they carry
   attacker-influenced text into a model holding destructive tools.

6. **SQLGlot parses the PostgreSQL JSON operators as accessors rather than as
   binary operators.** `->`, `->>`, `#>`, `#>>` and `?` are entries in SQLGlot's
   `COLUMN_OPERATORS`, so they bind at the tightest precedence tier and their
   right operand is parsed inconsistently. PostgreSQL puts them in the "any
   other operator" tier, below arithmetic and level with `||`. Four groupings
   come out wrong:

   | input | SQLGlot builds | PostgreSQL means |
   |---|---|---|
   | `a #>> b::text[]` | `CAST(a #>> b AS TEXT[])` | `a #>> CAST(b AS TEXT[])` |
   | `a -> b[1]` | `(a -> b)[1]` | `a -> b[1]` |
   | `a -> b.c -> d` | `a -> (b.c -> d)` | `(a -> b.c) -> d` |
   | `a -> b + 1` | `(a -> b) + 1` | `a -> (b + 1)` |

   The defect is in the parse, so no downstream check recovers the meaning, and
   the round trip does not expose it — parse, render and parse again returns
   the same wrong tree. The second and fourth rows render back to text that is
   character-for-character the caller's, so PostgreSQL reparses them under its
   own precedence and the caller's meaning survives by accident rather than by
   design. The first and third render the wrong grouping into a `CAST` or a
   `JSON_EXTRACT_PATH` call, where no engine can reinterpret it. `?` is refused
   for an unrelated reason, since the function allowlist does not carry
   `jsonb_contains`.

   Parentheses defeat all four. A parenthesised operand arrives under a `Paren`
   node and binds as a unit, so `a #>> ('{a,b}'::text[])`, `a -> ('a'[1])`,
   `a -> (b.c) -> d` and `a -> (1 + 1)` each parse and render the way PostgreSQL
   reads them. All four were checked against PostgreSQL 17.

   Three mitigations are in place. `catalog.py` drops the redundant cast from
   the index spellings this surface publishes, since `pg_get_indexdef` emits
   `'{a,b}'::text[]` for an expression index over a JSON path; the stripped form
   reaches the same index, verified with `EXPLAIN`. The schema preamble states
   the parenthesisation rule upfront, so a caller learns it before writing SQL
   rather than by being refused. And admission refuses the first row outright,
   because that tree is also what a deliberate `CAST(a #>> b AS text[])`
   produces — a valid statement that parses the extracted string as an array
   literal — and the two readings cannot be told apart once parsed. Choosing
   either one silently would answer a question the caller did not ask, so the
   refusal names both unambiguous spellings instead.

   What is left uncovered is a caller who does not follow the preamble on rows
   two through four. Rows two and four still render to text identical to what
   the caller wrote, so PostgreSQL recovers the meaning. Row three does not:
   `a -> b.c -> d` renders as a `JSON_EXTRACT_PATH` call with the associativity
   already fixed the wrong way, and returns a wrong value with nothing reported.

   Re-associating it was investigated and rejected. The shape is ambiguous in
   the same way row one's is: `json_extract_path(a, json_extract_path(b, c))`
   parses to the identical nesting, and that is a statement someone may mean.
   The two can be told apart only by undocumented parser internals — a node
   built from operator syntax carries different args from one built from a
   function call — and a meaning-changing rewrite resting on those is a bad
   trade. If the marker silently stops matching we are back to today's
   behaviour, which is survivable; if it silently starts over-matching we
   corrupt correct SQL, which is not. The asymmetry decides it, so row three
   stays a documented hazard that the preamble tells callers how to avoid.

   Filed upstream as <https://github.com/tobymao/sqlglot/issues/8035>, with a
   patch drafted for the first three rows. The fourth needs the operators moved
   to another precedence tier, which that patch does not do. Both the
   `catalog.py` workaround and the admission refusal become removable when the
   pin on `sqlglot==30.14.0` moves past the fix, the refusal because a corrected
   parser distinguishes the two readings it exists to separate.

7. **The plan gate and the SQLite authorizer are not equivalent backstops**
   (see [Stage 6](#stage-6--engine-backstops)).

## References

- Implementation: `src/phoenix/server/mcp_analytics_sql/`
- Tests: `tests/unit/server/mcp_analytics_sql/`
- Fixture and cold-agent harness: `scripts/mcp_analytics_sql/`
- Related: [Read replica routing](./pg-read-replica-routing.md)
