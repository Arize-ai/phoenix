# Analytics SQL fixture and cold-agent harness

Everything needed to reproduce the measurements behind the MCP analytics SQL
surface: a seeded database whose answers are known in advance, prompts that
probe it, and the oracle to grade against.

| File | What it is |
|---|---|
| [`seed_analytics_fixture.py`](seed_analytics_fixture.py) | Builds the fixture and emits the oracle as JSON |
| [`harness-prompts.md`](harness-prompts.md) | The prompts, their correct answers, and the specific wrong answers each mistake produces |
| [`advanced-use-cases.md`](advanced-use-cases.md) | Analytic questions worth answering, and which are blocked by the surface, instrumentation, or labelling. Product brainstorming, not fixture rationale — that lives in the seeder's docstring |

## Prerequisites

A running Phoenix server with the analytics SQL tools registered, and an MCP
client connected to it.

**Seed the database the server is actually using.** Every step below assumes
this. Seeding a different one produces a fixture nothing can query and probes
that answer from whatever the server does have.

**Access.** Both tools are open to any caller who reaches the MCP mount, so an
unauthenticated local server needs no setup. Why the surface is open, and what
bounds it instead, is in the [design spec](../../internal_docs/specs/mcp-analytics-sql.md#threat-model).

**The prompt wrapper below assumes MCP code mode**, where tool schemas are
fetched with `ToolSearch` and tools are called from Python through
`mcp__phoenix__execute`. It is the default. A client that exposes each tool
directly needs the tool names but not the loading preamble.

**The surface is two tools.** `describeSqlSchema` publishes the allowlisted
schema; `executeSql` runs read-only SQL. Typed fetch tools existed alongside
them and were removed, because everything they returned was reproducible in SQL
and one of them omitted `parent_id`. The informing prompts in
`harness-prompts.md` exist partly to measure whether SQL alone carries a
navigation question, so a reader who stops at the gating table has seen half
the harness.

Design principles, the decisions behind them, and the open questions are in the
[design spec](../../internal_docs/specs/mcp-analytics-sql.md). This file covers
only how to reproduce the measurements.

Both backends are supported and both have been measured. The fixture and every
oracle value below are identical on each.

## Reproducing

### 1. Seed

Seeding is destructive within its own namespace: it deletes every row whose name
begins `fixture-` before rebuilding, so a partial earlier run cannot leave
residue. It touches nothing else.

This repo runs Python through `uv`; `uv run python …` works for all of these,
and a plain `python` from an activated environment does too.

```bash
# SQLite — point at the database the server is actually using
python scripts/mcp_analytics_sql/seed_analytics_fixture.py \
    --url sqlite:///$HOME/.phoenix/phoenix.db --oracle oracle.json

# PostgreSQL
python scripts/mcp_analytics_sql/seed_analytics_fixture.py \
    --url postgresql://postgres:phoenix@localhost:5432/postgres --oracle oracle.json

# A scratch database that does not exist yet also needs the schema
python scripts/mcp_analytics_sql/seed_analytics_fixture.py \
    --url sqlite:///./fixture.db --oracle oracle.json --create-tables
```

The `+aiosqlite` and `+asyncpg` driver forms work too; the factory picks the
driver either way.

`--create-tables` runs the real migrations, which on SQLite emit several
`SAWarning: Skipped unsupported reflection of expression-based index` lines.
SQLAlchemy cannot reflect expression indexes on that backend. Nothing is wrong
and the indexes are created; the warnings appear only on this path.

`--oracle` writes every expected value as JSON. The seeder raises rather than
emitting an oracle it cannot stand behind — for instance if the busiest hour is
not unique, since publishing one of several tied hours would mark a correct
probe wrong.

**Do not re-seed while probes are running.** Seeding is idempotent but not
atomic, and a probe reading mid-purge reports a wrong answer that looks like a
surface defect.

### 2. Restart the server after any change

Nothing here is hot-reloaded. Both what the surface describes and what it admits
are derived from the immutable `manifest.py` curation singleton and cached
allowlists, so editing it under a live server changes neither until it restarts.

The two used to have different lifetimes, which let a server describe a schema it
would not execute. They are deliberately joined now; keep them that way if you
touch `allowlist.py`.

### 3. Run a prompt

The prompts in `harness-prompts.md` are the question text only. An agent also
needs to be told how to reach the tools, and that preamble is not optional —
without it the agent has no tools and will invent an answer. Use this wrapper
verbatim, substituting the question:

```
Load the Phoenix MCP tool schemas with `ToolSearch` using query
"select:mcp__phoenix__list_tools,mcp__phoenix__get_schema,mcp__phoenix__execute,mcp__phoenix__search,mcp__phoenix__tags".
Tools are invoked through `mcp__phoenix__execute`, which runs Python where
`await call_tool(name, params_dict)` calls a tool. Among them are
`describeSqlSchema` and `executeSql` for read-only SQL.

**Question:** <the prompt from harness-prompts.md>

Discover the schema yourself; do not guess table or column names. Report exactly
three things: (1) the answer, (2) every SQL statement you ran in order with its
outcome, (3) your confidence. Use only the MCP tools; do not read repository
files.
```

Three parts of that wrapper are load-bearing. Requiring the agent to discover the
schema is what makes the run a measurement of the discovery payload rather than
of the prompt. Requiring every statement in order is what lets a self-report be
checked against the server log. Forbidding repository access is what stops the
agent reading the seeder and answering from the fixture source instead of the
database.

**Run one prompt per agent.** Several prompts share a trap, and an agent that has
already met it in one question is no longer cold for the next.

Concurrency across agents is fine. The database is read-only to them, each
prompt names its own `fixture-*` scope, and the `q####` tags keep interleaved log
lines attributable.

### 4. Grade

`harness-prompts.md` lists, for each prompt, the correct answer and the value
each specific mistake produces. That second column is the point: a result that is
merely wrong tells you an agent failed, while a result that is exactly the
double-counted total tells you *which* misreading occurred.

Read the server log alongside the agent's own report. It records every statement
twice — `caller` as submitted and `executed` after rewriting — under one `q####`
tag, with the rewrites applied and whether the caller supplied a time window at
all. Where log and self-report disagree, the log is right, and the
disagreement is itself a finding about whether self-reports can be trusted.

**Those two lines are `DEBUG`.** On a default server they are absent, and an
empty grep reads as "the agent never ran SQL" when it means "the log is not
verbose enough". Start the server with `--debug`, or raise just this logger:

```python
import logging

logging.getLogger("phoenix.server.mcp_analytics_sql").setLevel(logging.DEBUG)
```

Then, against wherever your server writes (`phoenix serve --debug 2>&1 | tee $LOG`):

```bash
grep "analytics sql" "$LOG" | grep -E "caller|executed" | tail -40   # DEBUG
grep -cE "authorizer denied|admission bypass|plan verification failed|queue is full" "$LOG"
```

The second line is WARNING and above, so it works at any level. Grep for those
phrases rather than for error codes: the codes are returned to the caller, not
written to the log, so `grep -c queue_full` returns zero whether or not the queue
ever filled.

A denial is classified. `admission bypass` means the engine resolved a table
admission should have refused, which is the case the gate exists for. The other
wording says a relation belonged to no table at all, which refuses a query the
caller was entitled to run and is a defect in the layers rather than a defence of
them.

## What has already been measured

Recorded so a new run has something to disagree with. **Measured 2026-08-02 on
commit `05d59990c`, with the strongest available model at its highest reasoning
effort.** Re-seed before comparing: the fixture and several oracle values were
corrected that day, and a probe against an older database will be graded against
numbers the data no longer holds.

| Prompt | Answer | Backends |
|---|---|---|
| G1 token grain | 300 | SQLite, Postgres |
| G2 time window | `fixture-window-old-and-large`, 999,000 | SQLite, Postgres |
| G3 promotion gap | 556,000 | SQLite, Postgres |
| G4 dataset revisions | 2 | SQLite, Postgres |
| G5 trace links | 3 runs, 1 surviving | SQLite, Postgres |
| G6 attribute shapes | `chunk`, `core` | SQLite, Postgres |
| G7 percentiles | p50 80 ms, p95 900 ms, busiest 2026-07-31 15:00 with 32 spans | SQLite, Postgres |
| G8 time bucketing | 18 buckets, peak 32 spans | SQLite, Postgres |
| G9 `latency_ms` | 4 spans over 2000 ms, longest 2600 ms | SQLite, Postgres |

Nine of nine on both backends at frontier tier. Weaker models were measured on a
subset and diverge on exactly one prompt: the dataset-revision trap, which is the
only one nothing in the discovery payload teaches.

Cost runs 24,000–45,000 tokens and 8–24 tool calls per prompt, so a full
nine-prompt sweep is roughly 300,000. Those are total agent tokens, input and
output together, as reported by the Claude Code subagent runner; another client
will differ.

Model tier is a variable worth recording, not a constant. The one prompt where
weaker models diverge is the dataset-revision trap, which is the only one nothing
in the discovery payload teaches — so a sweep at a single tier measures the
surface under the most favourable conditions it will ever see.

## Reading a failure

A wrong answer is more often a defect in the fixture, the oracle, or the prompt
than in the agent. Every one of those has happened here:

- an oracle computed over a different population than any query returns
- a "unique" busiest hour that was a three-way tie, resolved silently by `max()`
- a prompt asking for "the single slowest span" where four are tied
- a fixture trace that existed but held no spans, making the question ambiguous

Before recording an agent as wrong, check that the oracle is answerable and that
the question has one answer. Agents in these runs pushed back correctly on all
four of the above, and each pushback was a better finding than the prompt it came
from.
