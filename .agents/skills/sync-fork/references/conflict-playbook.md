# Conflict playbook

Where conflicts actually happen, and what to do about each. Every number here came from
measurement, not estimation — re-measure before trusting them, since both the fork and
upstream move:

```bash
# risk = upstream commits in 120 days x lines the fork changes
git log --oneline --since="120 days ago" upstream/main -- <path> | wc -l
git diff --numstat upstream/main -- <path>
```

## Ranked exposure

Only files **upstream also has** can conflict. The fork touches 32 of them.

Backend paths below are relative to `src/phoenix/`; frontend paths are given in full.

| Risk | Churn/120d | +/- | File |
|---|---|---|---|
| 2600 | 25 | 86/18 | `server/api/helpers/playground_clients.py` |
| 1098 | 18 | 61/0 | `config.py` |
| 871 | 13 | 60/7 | `app/src/pages/playground/playgroundUtils.ts` |
| 585 | 5 | 97/20 | `app/src/pages/playground/PlaygroundChatTemplate.tsx` |
| 500 | 5 | 96/4 | `server/api/input_types/PromptVersionInput.py` |
| 450 | 25 | 18/0 | `server/api/queries.py` |
| 396 | 3 | 130/2 | `db/types/prompts.py` |
| 351 | 13 | 27/0 | `db/models.py` |
| 350 | 5 | 69/1 | `app/src/pages/playground/fetchPlaygroundPrompt.ts` |
| 295 | 1 | 280/15 | `server/api/helpers/message_helpers.py` |
| 145 | 29 | 5/0 | `server/app.py` |

Read the columns together. `app.py` has the highest churn in the repo but the fork adds
five one-line insertions, so it is near-harmless. `message_helpers.py` holds 280 fork lines
but upstream touched it once in four months. The dangerous combination is both.

## Per-file guidance

### `src/phoenix/server/api/helpers/playground_clients.py` — expect conflicts, keep them small

Where upstream adds providers and models. The fork's remaining lines are 1–3 line
delegations into `playground_media/`, one per provider class, plus an import block.

Resolving: apply upstream's change, re-add the delegation, then run
`uv run pytest tests/unit/server/api/helpers/test_playground_media.py -q`. Those tests read
each provider's payload, so a dropped delegation fails rather than silently sending
text-only.

Do not inline media logic back into this file to resolve a conflict. Put it in
`playground_media/` and call it.

### `config.py`, `queries.py`, `app.py`, `server/api/routers/v1/__init__.py`

Insertions among upstream's own lists — env vars, resolvers, daemon wiring, router
registration. Small and mechanical, but they land where upstream inserts too. Take both
sides; ordering rarely matters.

### `Makefile`

The `.PHONY` line is one long shared line that upstream also edits, so a conflict there is
near-certain eventually. Union the target names, keep the fork's `sync-fork` /
`sync-fork-check` entries.

### `src/phoenix/db/models.py`

`MediaFile` is appended near the end, where upstream also appends new models. Take both.

### Frontend

`playgroundUtils.ts`, `PlaygroundChatTemplate.tsx` and `fetchPlaygroundPrompt.ts` carry the
most. Media-variable extraction already lives in the fork-owned
`app/src/pages/playground/playgroundMedia.ts`; the remainder is call sites, JSX props and
converter branches that cannot move without restructuring upstream's components.

## Hazards that never appear as a text conflict

These are the ones that make a sync look successful and break later.

### Two alembic heads

Phoenix calls `command.upgrade(config, "head")` — singular. Two branches can each append a
migration without touching the same line, so git reports nothing and the failure surfaces
only when a database is opened.

Caught by `tests/unit/db/test_migration_heads.py`. Fix by re-pointing the earliest
fork-local migration's `down_revision` at upstream's new head.

### A dev database stamped at a deleted revision

If fork migrations were merged or renumbered, existing databases have the right schema but
an `alembic_version` row naming a revision that no longer exists. Phoenix refuses to start
with *"Can't locate revision identified by ..."*.

Back the database up first — for SQLite use the backup API, not `cp`, because WAL mode means
a plain copy can be torn:

```python
import sqlite3
src = sqlite3.connect("file:<db>?mode=ro", uri=True)
dst = sqlite3.connect("<backup>")
src.backup(dst)
```

Then stamp it at the surviving revision.

### The DDL snapshot hook

A hook regenerates `scripts/ddl/postgresql_schema.sql` on any migration edit. On PostgreSQL
17+ it emits ~327 `NOT NULL <column>` table constraints. That form is legal from 17 but
absent from `postgres:12`, which upstream CI uses — so the regenerated file is unloadable on
the oldest supported server.

Always diff this file before committing after a migration change, and restore the committed
version unless the schema genuinely changed. Leave upstream's generator alone.

### Fork tests pinned to third-party SDKs

`TestProviderSdkContracts` asserts the fork's media allowlists equal the Anthropic, Bedrock
and Google SDKs' own literal unions. Upstream runs weekly dependency upgrades, so the
trigger is frequent even though a real failure only happens when a provider adds a format.
A failure here is information, not breakage: a provider now supports something the fork
could accept.

### OpenInference coupling

`src/phoenix/server/api/helpers/playground_media/_tracing.py` records a document as a *text* block naming it, because
OpenInference's `MessageContent` is a closed union of text, image and reasoning with no
document type. If a dependency bump adds one, that workaround becomes wrong rather than
merely suboptimal, and nothing will fail to say so. Re-check it whenever
`openinference-instrumentation` moves.

### Places the fork modifies upstream behaviour

Mostly the fork only adds. The exception: `src/phoenix/server/daemons/experiment_runner.py` changes `_build_messages`
from sync to async so media can be resolved. If upstream edits that method the conflict is
semantic, not textual, and a careless resolution silently breaks media in experiments.

## Verifying a sync properly

```bash
uv run pytest tests/unit/db/test_migration_heads.py            # boots at all?
uv run pytest tests/unit/server/api/helpers/test_playground_media.py -q --db all
make typecheck-python && (cd app && pnpm typecheck)
cd app && pnpm vitest run
```

A media-suite pass on both dialects plus a green migration-head test covers every failure
mode listed above except the DDL snapshot, which needs the eyeball diff.
