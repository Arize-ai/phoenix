# Vignette: Measuring and Improving Server Performance

This vignette is for an agent that must find out why Phoenix is slow, or show
that a change makes it faster. It explains how to bring up the stack with
telemetry, how to load it with enough data for query plans to matter, and how
to compare two builds.

Read [the devops README](../README.md) first. It describes the profiles, the
URLs, and the commands of `dev.sh`.

## The Agent's Role

Measure before you change anything, change one thing, and measure again on the
same data. Report numbers with the conditions they were measured under. A
result that cannot be reproduced from your notes is not a result.

- **Do the work instead of describing it.** Start the stack, seed it, and run
  the measurements yourself.
- **Compare like with like.** Two numbers are comparable only if the data, the
  table statistics, the engine settings, and the background load were the same.
- **Say what you did not measure.** Three runs on a laptop show a direction,
  not a size.

## What the Stack Gives You

Start it with the `lgtm` and `datagen` profiles:

```bash
./dev.sh doctor --profiles lgtm,datagen
./dev.sh up --profiles lgtm,datagen
```

- **Phoenix**, built from your working tree, at http://localhost:18273/phoenix.
  It sends its traces and logs to Grafana and serves metrics for Grafana to pull.
- **Grafana** at http://localhost:18273/lgtm/, with no login: Prometheus
  (metrics), Loki (logs), and Tempo (traces) in one container. The datasource
  UIDs are `prometheus`, `loki`, and `tempo`.
- **Grafana MCP** at http://localhost:18273/grafana-mcp/mcp: read-only tools to
  query those datasources. To connect Claude Code:

  ```bash
  claude mcp add --transport http phoenix-dev-grafana http://localhost:18273/grafana-mcp/mcp
  ```

- **Datagen**, which replays recorded traces into several projects. Its rate
  and a pause switch are at http://localhost:18273/datagen/ and
  `PATCH /datagen/api/state` (`{"rate": 12}`, `{"paused": true}`).

Grafana returns 404 for about 30 seconds after start, until its health check
passes.

## Load Enough Data

An empty database answers every query in milliseconds. Seed it:

```bash
./dev.sh seed --scale 5    # 9.7 million spans, about 6 minutes, 16 GB
```

Scale 1 is 1.94 million spans in about a minute. The seed makes seven projects
(`seed-target-app`, `seed-busy-app`, `seed-evaluator-1` to `-5`) whose rows
interleave on disk by start time, as they do on a server that ingests several
projects at once. It refuses to run twice; `./dev.sh destroy` wipes the
database.

A seeded project can be in one of two states, and they perform differently:

- **Pushed out.** Datagen keeps ingesting, so after a few minutes the newest
  spans in the database belong to other projects. This is the state after
  `./dev.sh seed`.
- **Busy right now.** Pause datagen, then run `./dev.sh seed-tail`. It adds
  spans from the last 10 minutes to the busy projects. `seed-target-app` stays
  stale.

Measure both. Some code paths look at the newest spans first and fall back to
a slower statement when the project has none there.

## Measure

- **Scorecard.** `./scripts/perf_scorecard.py --window 10m --json before.json`
  prints memory growth, connection pool timeouts, and the call count, average,
  and total time of the main GraphQL operations. Later,
  `./scripts/perf_scorecard.py --window 10m --compare before.json` shows both
  runs. `--url` points it at a hosted Grafana with the same datasource UIDs.
- **One request in detail.** `./scripts/perf_trace_breakdown.py <Operation>`
  adds up one server trace by span name. The resolver that holds the request is
  the one with the largest `max ms`. It then lists the trace's SQL statements,
  slowest first, with the resolver that ran each one.
- **The database.** `./dev.sh psql` opens `psql`. `pg_stat_statements` is
  preloaded: `create extension if not exists pg_stat_statements`, then read
  `calls` and `mean_exec_time`. Use `explain (analyze, buffers)` and compare
  buffer counts, which are steadier than milliseconds.
- **The browser.** What the user waits for is the time until rows are on
  screen, which the server numbers do not show. Load pages with a real browser
  when a change moves work between requests. The dev OIDC server signs the
  single test user in automatically, so browser automation needs no password.

Something must make the requests. The scorecard reports what happened in its
window; it does not generate load. It counts an operation from its second call
after a restart, because the first call only creates the counter.

## Compare Two Builds

1. Seed once. Two commits can share one database only if they have the same
   migrations; check `git diff --stat A B -- src/phoenix/db`.
2. Start the stack from the first commit, put the projects in the state you
   want, make the requests, and save the scorecard.
3. Check out the second commit and run `./dev.sh up` with the same profiles.
   It rebuilds Phoenix and keeps the database.
4. Repeat step 2 and compare.

Run the two builds back to back. If you want certainty about order effects,
run the first build again at the end.

## Known Hazards

- **Statistics.** `./dev.sh seed-tail` runs `ANALYZE`. Numbers from before and
  after it are not comparable.
- **Shared memory.** The database container has 64 MB of `/dev/shm`, the
  engine default. One parallel hash join can take most of it, and two at the
  same moment fail with `could not resize shared memory segment`, which GraphQL
  reports as `an unexpected error occurred`. That is a real failure a
  deployment can have, not noise. To see how much a page uses, sample
  `du -sk /dev/shm` in the `db` container while it loads.
- **Sign-in after a database restart.** Recreating the `db` container also
  recreates `oidc-dev`, which makes a new signing key. Phoenix then rejects
  every sign-in until you restart the `phoenix` container. Check that sign-in
  worked before a long browser run.
- **Evaluators need a model.** With no provider keys, no online evaluation
  runs, so the evaluation numbers on the scorecard stay empty. The `mock-llm`
  profile provides a model without keys; see
  [Setting Up Online Evaluation Load Testing](online-eval-load-testing.md).
- **Streamed responses.** A request that uses `@defer` finishes when its last
  part arrives. Its duration is not the time until the page is usable.
- **Disk.** A scale 5 seed needs about 20 GB in the engine's disk. Under
  Podman, size the machine for it: see the README's Container Engine section.
