# Span analytics seeds

Deterministic database seeds for the span-analytics surface's demos and
dogfooding sessions — unlike `scripts/fixtures/` (notebook example data)
and `scripts/analytics/` (usage analytics), these write directly into a
Phoenix database to create known, queryable workloads.

Three scripts fill a Phoenix database with synthetic span data for
dogfooding sessions. All are deterministic (same `--now` and `--seed`
produce the same data), work on SQLite and PostgreSQL, and are safe to
re-run with `--replace`.

| Script | Project(s) | Purpose |
|---|---|---|
| `seed_incident.py` | `payments-agent`, `payments-agent-dev` | Scripted exercises: a planted release regression with a known answer key |
| `seed_support_copilot.py` | `support-copilot` | Organic questioning: a realistic workload with **no** answer key, by design |
| `seed_eval_quality.py` | `assistant-quality`, `assistant-quality-dev` | Scripted exercises on *eval scores*: a quality drop that is mostly a shift in who was measuring, with an answer key |

## Prerequisites

- A running Phoenix server (the normal case), **or** a bare database you
  want initialized (`--migrate`).
- Repository dependencies installed (`uv sync` or equivalent); run the
  commands below from the repository root.

The scripts write directly to Phoenix's database. Point them at the same
database your Phoenix server uses:

- **SQLite (default Phoenix setup):** with no `--database-url`, the scripts
  read the standard Phoenix environment configuration and resolve the same
  `phoenix.db` file a locally running default-config server uses. If your
  server runs with a custom `PHOENIX_WORKING_DIR` or
  `PHOENIX_SQL_DATABASE_URL`, export the same variables first.
- **PostgreSQL:** pass the server's database URL explicitly.

## Seeding

SQLite (default environment):

```sh
uv run python scripts/span_analytics_seeds/seed_incident.py --now 2026-07-23T12:00:00Z
uv run python scripts/span_analytics_seeds/seed_support_copilot.py
uv run python scripts/span_analytics_seeds/seed_eval_quality.py --now 2026-07-29T12:00:00Z
```

PostgreSQL:

```sh
uv run python scripts/span_analytics_seeds/seed_incident.py --now 2026-07-23T12:00:00Z \
    --database-url postgresql://user:password@localhost:5432/phoenix
uv run python scripts/span_analytics_seeds/seed_support_copilot.py \
    --database-url postgresql://user:password@localhost:5432/phoenix
uv run python scripts/span_analytics_seeds/seed_eval_quality.py --now 2026-07-29T12:00:00Z \
    --database-url postgresql://user:password@localhost:5432/phoenix
```

Notes:

- `seed_incident.py` and `seed_eval_quality.py` require `--now` (their
  timelines are anchored to it); a recent timestamp keeps the data inside
  default time windows.
- `seed_support_copilot.py` defaults `--now` to the current time and
  backdates its sessions over the trailing 24 hours.
- Neither script runs database migrations by default — a running server
  owns its database, and migrating under it is unsafe. For an **empty**
  database (no Phoenix server has used it yet), add `--migrate` once to
  initialize the schema.

## What success looks like

Each script prints one confirmation line per project, for example:

```
Seeded project "payments-agent": 1925 spans, 960 traces, 36 annotations, 959 cost records
Seeded project "payments-agent-dev": 240 spans, 120 traces, 0 annotations, 120 cost records
```

```
Seeded project "support-copilot": 3147 spans, 909 traces, 300 sessions, 274 annotations, 798 cost records
```

```
Seeded project "assistant-quality": 972 spans, 480 traces, 780 annotations
Seeded project "assistant-quality-dev": 162 spans, 80 traces, 80 annotations
```

Then open the Phoenix UI and check the projects appear in the projects
list with spans in them.

## Re-running

Generated ids are deterministic, so running a script twice against the
same database collides. The scripts detect this and stop with a message;
re-seed intentionally with:

```sh
uv run python scripts/span_analytics_seeds/seed_incident.py --now 2026-07-23T12:00:00Z --replace
uv run python scripts/span_analytics_seeds/seed_support_copilot.py --replace
uv run python scripts/span_analytics_seeds/seed_eval_quality.py --now 2026-07-29T12:00:00Z --replace
```

`--replace` deletes only that script's own projects (by name) before
inserting, cascading to their sessions, traces, spans, and annotations.
Other projects are untouched.

## Which project to use for what

- **`payments-agent`** (with its decoy `payments-agent-dev`) is for
  scripted exercises: something specific went wrong in this data, and a
  ground-truth answer key exists to check conclusions against.
  **Do not run `--answer-key` before participating** — reading the key
  first spoils the exercise. Facilitators can print it afterwards:

  ```sh
  uv run python scripts/span_analytics_seeds/seed_incident.py --now <same-timestamp> --dry-run --answer-key
  ```

  (`--dry-run` prints without writing; use the same `--now` and `--seed`
  as the original seeding run.)

- **`support-copilot`** is for organic questioning. There is no planted
  anomaly and no answer key — explore it the way you would a production
  project: what are users asking about, which model is slower, where do
  errors cluster, what do the retrieval scores look like, which turns got
  poor helpfulness scores.

- **`assistant-quality`** (with its decoy `assistant-quality-dev`) is the
  eval-score counterpart of `payments-agent`: the measured quantity is
  `correctness`, not errors or latency. A prompt-version cut sits at the
  midpoint of its 24 hours, and the naive average of `correctness` drops
  about twelve points across it. Most of that drop is not a quality
  change — it is a change in who was measuring. Its answer key prints the
  decomposition, and the same do-not-read-it-first rule applies.

## Participant exercises

A few starting points once seeding is done (all through the MCP span
analytics tools):

1. Discover the fields of a project before querying it, and use only
   identifiers discovery returned.
2. `payments-agent`: find what changed, when it changed, and where the
   change is concentrated. Name the single worst request and pull up its
   full prompt, response, and exception.
3. `support-copilot`: pick any question you would ask of a production
   assistant — busiest hours, error clustering, token spend by model,
   plans or channels that struggle — and answer it end to end.
4. **The annotation loop** — result rows carry stable span identities
   precisely so findings can become actions:
   (a) use the analytics tools to find the five worst spans in
   `support-copilot` by a criterion of your choosing (slowest, most
   tokens, lowest retrieval scores, ...);
   (b) annotate them via `annotateSpans`, using the `span_id` every
   result row carries;
   (c) read your annotations back via `listSpanAnnotationsBySpanIds`.

5. **The annotator-mix trap** — in `assistant-quality`, ask what happened
   to `correctness` across the prompt-version cut. Answer it twice: once
   with `from: "annotations"` (one row per annotation), and once on the
   spans grain with `annotations["correctness"].score`. The two numbers
   differ, and neither is wrong — they answer different questions. Then
   break the annotations down by `annotator_kind` and decide how much of
   the drop is a quality change at all. The response tells you which
   reduction produced any enriched value, and how many annotations of each
   kind stand behind it; the decomposition is the finding.

One honest boundary to try on purpose: on the annotations grain you cannot
group by a property of the annotated span — "average correctness by model"
is not expressible there, because the row is an annotation and the model
belongs to its parent. Run it, read the rejection, and take its route: ask
the same question on the spans grain, where the span is the subject and
its annotations reduce to a value. Per-span annotation *writes* still go
through the annotation tools, not the analytics surface.
