# mcpbench

Measures what an agent spends answering analytics questions through Phoenix's
`/mcp` surface. Drives `claude -p` with no system prompt and no built-in tools, so
the only thing in its context is the MCP surface under test.

```
bench.yaml     suite defaults
tasks/         the questions — reviewed in git, since editing a prompt
               invalidates comparability with results already collected
harness/       the Python package
results/       transcripts, bench.db and reports; gitignored
```

## The idea

A run targets **one** MCP server and carries a **label** you choose. Comparison is
between labels, so what a run means is your annotation rather than a taxonomy baked
into the harness.

```bash
mcpbench run --target https://host/mcp --label "with sql"
mcpbench run --target https://other/mcp --label "no sql"
mcpbench run --target none --label "no tools"   # the floor everything else beats
```

Each task carries a `task_class` grouping it by shape of work, which is the row axis
in every summary:

| `task_class` | shape |
| --- | --- |
| `noop` | no work asked; isolates the fixed cost of the tool surface |
| `trivial` | one call answers it; overhead dominates |
| `multi-call` | needs a chain of calls |
| `large-result` | big payload, short answer |

Primary metric is `total_context_tokens` (input + cache_creation + cache_read) —
everything the model had to read. It is invariant to prompt-cache warmth, where cost
is not. `peak_context_tokens` is the companion: totals sum, but peak decides whether
a run still fits in a smaller context window.

Durations are secondary; they move with server warmth and the shared rate limit.
`duration_api_ms` is the defensible one.

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

```bash
export BENCH_TARGET_URL=https://app.phoenix.arize.com/s/phoenix-devs/mcp
export BENCH_TARGET_API_KEY=<viewer key>   # omit if the target has auth disabled
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
mcpbench analyze --all                              # rebuild bench.db from every run
mcpbench annotate --run-id 20260816-182817 --note "what this run was"
```

Cells are checkpointed by `(label, task, trial)` and resume on transcript existence,
so raising `--trials` never re-pays for what is done, and an interrupt loses at most
the cells in flight. The matrix stops cleanly at `max_total_usd` and resumes with the
same command.

Cheapest task classes run first, so a run gives usable signal in seconds rather than
after the slowest task.

`concurrency` defaults to 4. Parallel runs can contend for the server's sandbox pool;
that shows up as `n_sandbox_errors`, and `summarize` warns when any land in passing
runs. If you see that warning, drop to `--concurrency 1` — those numbers measure the
pool, not the tool surface.

## Optional: tracing the benchmark itself

Off by default, because turning it on makes every run depend on a second Phoenix.
Set `tracing.enabled` in `bench.yaml`, point `plugin_dir` at a checkout of
[arize-claude-code-plugin](https://github.com/Arize-ai/arize-claude-code-plugin), and:

```bash
export PHOENIX_ENDPOINT=http://localhost:6006   # sink — base URL, no /mcp
export PHOENIX_API_KEY=<member-or-admin key>    # omit if the sink has auth disabled
```

It adds **zero** context tokens: the plugin's hooks write only to stderr, and
`--plugin-dir` loads them without restoring the settings `--setting-sources ""` strips.

The sink must not be the instance under test — spans one trial ingests are visible to
the next, and the tasks count traces and spans, so they would measure their own
instrumentation. Preflight refuses if the hosts match, and posts a canary span,
because the plugin swallows every delivery error.

Sink keys need **member or admin**: span ingest is viewer-restricted, unlike the
read-only target key.

## Results

`raw/*.jsonl` and `manifest.json` are the durable truth and are never rewritten.
`bench.db` is a **disposable index** — delete it any time and `analyze --all` rebuilds
it from the run folders.

Three tables, keyed by `(run_id, label, task, trial)`:

- `runs` — one row per cell
- `turns` — one row per API call, for context growth
- `tool_calls` — `tool_name`, `is_discovery`, `input_bytes`, `result_bytes`,
  `is_error`, `error_kind`

`tool_calls` explains the token numbers rather than restating them: the discovery tax,
the volume of code written, and the single largest payload (which a sum hides).

```sql
SELECT task_class, label, COUNT(*) n, AVG(total_context_tokens)
FROM runs WHERE passed GROUP BY task_class, label;
```

```bash
mcpbench report   # self-contained results/<run-id>/report.html
mcpbench serve    # same page plus run controls on 127.0.0.1:8765
```

Opened from disk the page is a read-only snapshot; served, it polls for updates and
can start runs. `serve` binds loopback only and never receives a credential — keys
stay in the server's environment.

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
