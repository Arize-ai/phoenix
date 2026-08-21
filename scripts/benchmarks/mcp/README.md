# mcpbench

Measures what an agent spends answering analytics questions through Phoenix's
`/mcp` surface. Drives `claude -p` with no system prompt and no built-in tools, so
the only thing in its context is the MCP surface under test.

```
bench.yaml     suite defaults
tasks/         the questions — reviewed in git, since editing a prompt
               invalidates comparability with results already collected
harness/       the Python package
results/       transcripts, manifests and reports; gitignored
```

## The idea

A run targets **one** MCP server and carries a **label** you choose. Comparison is
between labels, so what a run means is your annotation rather than a taxonomy baked
into the harness.

```bash
mcpbench run --target https://host/mcp --label "with sql"
mcpbench run --target https://other/mcp --label "no sql"
```

`--target none` runs with no MCP server, for the rare case where you want it.
The `noop` task already prices the tool surface at 1,604 tokens; measured against
no server it is 1,396, and the 208-token difference is not worth a second run.
Running the whole suite this way measures nothing — the model declines rather
than guessing, so every data question fails by construction. The one use is
after editing a question, to check the new wording did not become answerable
without data; a two-option answer once passed that way.

Each task carries a `task_class` grouping it by shape of work, which is the row axis
in every summary:

| `task_class` | shape |
| --- | --- |
| `noop` | no work asked; isolates the fixed cost of the tool surface |
| `trivial` | one call answers it; overhead dominates |
| `multi-call` | needs a chain of calls |
| `large-result` | big payload, short answer |

Primary metric is `peak_context_tokens` — how long the conversation had grown by the
time the agent answered. The model is re-sent the whole conversation every turn, so it
only grows; its length at the end is what has to fit in the context window. A sum over
calls is also recorded but not displayed: it counts re-read text once per call that
follows it, and reads several times larger than the conversation ever was.

Cost is split into input, output, cache write and cache read, because cache traffic
usually dominates and one figure hides it. Two clocks are recorded: `duration_api_ms`
(the model thinking and writing) and `tool_time_ms` (waiting on the server). Together
they account for nearly all of a run's wall clock.

## Setup

Once, from the repo root. It runs in Phoenix's own venv, which already satisfies its
only dependency (`pyyaml`), so this installs nothing but the entry point:

```bash
uv pip install -e scripts/benchmarks/mcp/harness
```

Then invoke it as `mcpbench`, from any directory.

> **Do not use `uv run mcpbench`.** From inside `harness/`, `uv` treats it as its own
> project, ignores the active venv, and builds a separate 200MB environment. The bare
> console script has no such failure mode.

### Pointing it at data

The shipped tasks have answers pinned to the **`trail-gaia`** project (Patronus TRAIL
/ GAIA agent traces), so the target must be an instance holding it.

Put a `.env` next to `bench.yaml` — `scripts/benchmarks/mcp/.env`, gitignored.
`mcpbench` reads it from there regardless of the working directory; already-set
environment variables win.

```bash
# scripts/benchmarks/mcp/.env
BENCH_TARGET_URL=https://app.phoenix.arize.com/s/phoenix-devs/mcp
BENCH_TARGET_API_KEY=<viewer key>   # omit if the target has auth disabled
```

Use a **read-only (viewer)** key when one is needed. Under code mode the model writes
arbitrary Python calling `call_tool(...)`, including mutating tools, and nothing
watches each turn across a few hundred runs.

A plain Phoenix API key works at `/mcp` — API keys carry no RFC 8707 audience, so
they are unscoped and accepted at every resource. Interactive OAuth servers do
**not** work: a headless run cannot reach the stored token, connects with zero tools,
and still answers. Preflight catches that.

## Running

```bash
mcpbench preflight
mcpbench run --trials 3
mcpbench run --trials 10 --run-id 20260816-182817   # adds trials 4-10 only
mcpbench analyze --all                              # re-derive every run from transcripts
mcpbench annotate --run-id 20260816-182817 --note "what this run was"
```

Cells are checkpointed by `(label, task, trial)` and resume on transcript existence,
so raising `--trials` never re-pays for what is done, and an interrupt loses at most
the cells in flight. The matrix stops cleanly at `max_total_usd` and resumes with the
same command.

Cheapest task classes run first, so a run gives usable signal in seconds rather than
after the slowest task.

`concurrency` defaults to **3**, which is what the server admits. The sandbox pool is
four workers, but MCP is capped at `max_processes - 1` of them so it cannot starve the
evaluator, and a fourth concurrent `execute` waits 30s for a slot before failing with
"the sandbox is busy". At 4 this matrix spent 85% of its wall clock waiting on tools and
took nearly twice as long as running serially. Contention shows up as `n_sandbox_errors`,
which `summarize` warns about; if you see it, drop to 1.

## Optional: tracing the benchmark itself

Off unless `$PHOENIX_ENDPOINT` is set (or `tracing.enabled: true` in `bench.yaml`).
Point `plugin_dir` at a checkout of
[arize-claude-code-plugin](https://github.com/Arize-ai/arize-claude-code-plugin), and
put the sink in `.env`:

```bash
PHOENIX_ENDPOINT=http://localhost:6006   # sink — base URL, no /mcp
PHOENIX_API_KEY=<member-or-admin key>    # omit if the sink has auth disabled
```

It adds **zero** context tokens: the plugin's hooks write only to stderr, and
`--plugin-dir` loads them without restoring the settings `--setting-sources ""` strips.

Spans land in `mcp-bench-<label>`, not in the fixture the tasks name (`trail-gaia`),
so the sink may be the same Phoenix as the target. Preflight refuses only when the
sink *project* appears in a task prompt. It also posts a canary span, because the
plugin swallows every delivery error.

Sink keys need **member or admin**: span ingest is viewer-restricted, unlike the
read-only target key.

## Results

A run directory is self-describing: `raw/*.jsonl` (transcripts), `manifest.json`
(what produced them, including the questions as asked), and `annotation.json` (anything
you labelled after the fact). Nothing else is stored — every number is re-derived from
those files on demand, so there is no index that can fall out of step with them.

```bash
mcpbench report                    # self-contained results/<run-id>/report.html
```

`run` also rewrites the report after every cell, so a run in progress can be watched by
opening the page and refreshing. `runs.csv` lands beside it for spreadsheets.

### Replaying a run as traces

```bash
uv pip install -e "harness[otel]"
mcpbench export --all --project mcpbench    # every stored run, into one project
mcpbench export --dry-run                   # writes replay.json instead of sending
mcpbench run --export mcpbench              # ship each cell as it finishes
```

Turns the stored transcripts into OpenInference spans and posts them: one trace per
cell, an `AGENT` root carrying the prompt, the answer and how it graded, then an `LLM`
span per API call and a `TOOL` span per call underneath it. `--all` puts every run in
one project, keyed by `session.id`, so runs can be compared without re-spending the
matrix.

It replays rather than instruments, which is the point: nothing is re-executed, so the
numbers stay the ones the client produced, and runs already collected can be looked at
as traces. Two things the transcript does not carry are derived, and each LLM span says
so in its metadata — the model call's start (the clock only stamps arrivals) and the
per-call output tokens (the stream stamps a message before it exists, so the run's
reported total is divided by how much each call wrote). Both are exact in aggregate;
neither is a measurement of a single call.

The command reports how many spans the collector accepted and exits non-zero if any
did not land. The SDK reports a failed batch by logging it, so counting what was queued
would call a closed port a success. Acceptance is still not ingestion — Phoenix stores
the batch after answering, so a count read immediately after an export reads low.

Exporting records where the spans went, and the report grows a **trace** column
linking each row to it. The link is computed, not looked up: ids are derived from
`(project, run, cell, max-chars)`, so the page knows the trace id without asking the
backend anything. It addresses the trace through `/redirects/traces/<id>`, because a
direct link needs the project's internal id and a report that builds offline should not
need the server to be up. A run nobody exported has no column rather than an empty one.

`run --export` holds one connection open for the matrix and sends each cell the moment
its transcript lands, so traces appear as the run goes rather than after it. Per cell,
not per span: nothing exists to send until the cell ends, because the client's output is
captured whole. It cannot fail a run — the transcript is already durable by then, and an
unreachable sink is reported once and otherwise ignored. The sink is opened before the
matrix is planned, so a missing extra or a bad endpoint costs nothing.

Span ids are seeded from `(project, run, cell, max-chars)`, so re-exporting the same run
with the same settings is a no-op rather than a duplicate — which is what lets a
streamed run be re-exported afterwards without doubling it. Ingest keeps the first span
it sees for an id and never updates it, so re-rendering into the same project adds a
second copy alongside the first — use a fresh `--project` instead.

**Comparing labels requires one run directory.** Transcript filenames carry the label,
so a directory can hold several; the report compares whatever it finds. Pass the same
`--run-id` for each label:

```bash
mcpbench run --target https://host/mcp --label "with sql" --run-id compare-01
mcpbench run --target none            --label "no tools"  --run-id compare-01
```

## Caveats

**Answers are pinned to a fixture.** Retention has already emptied `trail-gaia` once;
only projects written to within ~10 days survived. Pin a retention policy or repin the
tasks against your own data.

**Grade on values that cannot be guessed.** A two-option answer was scored a pass by a
control run with no data access at all, while runs doing real work were marked wrong.
`--json-schema` holds on short no-tool runs but not on multi-turn tool-using ones, so
grading scans the answer text instead.

**Only harness failures are retried.** A wrong or unproductive answer is the data;
retrying it would select for lucky runs. Budget exhaustion is data too.

**Condition on correctness.** A cheap run that answers wrongly is not cheap.

**Pin the model ID.** `sonnet` is a moving alias; `claude-sonnet-5` is not.

**Editing a prompt does not re-mark earlier runs.** Each run records the questions it
asked in its manifest and is graded against those. Runs collected before that was
recorded are graded against the current task files instead, which can turn an answer
that was right at the time into a failure; `summarize` names those runs and warns. Do
not aggregate across them.
