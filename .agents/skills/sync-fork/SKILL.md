---
name: sync-fork
description: >
  Sync this fork of Phoenix with upstream Arize-ai/phoenix and resolve the resulting
  conflicts. Use when the user asks to sync the fork, pull or merge upstream, update
  from Arize-ai/phoenix, fix a conflicted PR, or when a PR shows CONFLICTING /
  mergeStateStatus DIRTY. Also use before starting work on the fork, to check how far
  behind it is and what a sync would break.
metadata:
  internal: true
---

# Syncing this fork with upstream

This fork carries media (image and PDF) support for Prompt Management and the
Playground on top of a fast-moving upstream. The job of a sync is to take upstream's
work without losing the fork's, and to make sure a mis-resolved conflict fails loudly
rather than silently shipping a broken prompt.

## The principle

**Fork code lives in files upstream does not have.** Those cannot conflict, ever. Where
the fork must touch an upstream file, it does so in as few lines as possible — a one-to-
three-line delegation that git can auto-merge, never an interleaved block.

Measure it before and after any change to the fork's structure:

```bash
# lines in files upstream owns  = the whole conflict surface
# lines in files only we have   = cannot conflict
git diff --numstat upstream/main
```

At the time of writing, 79% of the fork's hand-written lines sit in fork-only files.
Keep that ratio going up, not down.

## Runbook

```bash
make sync-fork-check     # read-only preview; safe to run any time
make sync-fork           # merge + resolve everything mechanical
```

Then verify, in this order — cheapest and most diagnostic first:

```bash
uv run pytest tests/unit/db/test_migration_heads.py    # would the server even boot?
make typecheck-python && (cd app && pnpm typecheck)
uv run pytest tests/unit/server/api/helpers tests/unit/db -q
cd app && pnpm vitest run
```

Only then `git commit`. `make sync-fork` deliberately leaves the merge uncommitted so it
can be reviewed before it becomes history.

`git rerere` is enabled, so any resolution made once is replayed automatically next time.
Do not disable it.

## What the tooling resolves, and what it will not

| Category | Handling |
|---|---|
| Generated artifacts | Takes upstream's copy, re-runs codegen. **Never merge these by hand** — codegen reproduces the fork's additions deterministically. |
| Migration chain | Re-points the earliest fork-local migration onto upstream's new head. |
| Hand-written overlap | Left alone on purpose. This is the only part that needs judgment. |

Generated artifacts means anything under `__generated__/`, plus `app/schema.graphql`,
`schemas/openapi.json`, and the generated Python and TypeScript clients. If codegen is
needed manually: `make graphql` then `make openapi`.

## Reading a conflict

Before resolving anything, ask which of these it is:

1. **Upstream fixed something the fork also fixed.** Take upstream's version and delete
   the fork's. This has already happened once: the fork carried a `SpanDetails` bug fix
   that upstream shipped 17 hours earlier and more cleanly, and it caused *100% of that
   sync's conflicts*. Check `git log upstream/main -- <path>` before assuming the fork's
   version is wanted.
2. **Upstream changed code the fork's media branch sits inside.** Keep both: apply
   upstream's change, then re-apply the fork's delegation. Then run the provider tests —
   see Safety nets.
3. **Genuinely divergent logic.** Rare. Stop and ask rather than guessing.

`references/conflict-playbook.md` has per-file guidance with measured upstream churn, and
the list of hazards that never appear as text conflicts.

## Safety nets — and what their failures mean

These matter more than the merge. The dangerous outcome is not a conflict; it is
resolving one wrong and not finding out.

**`tests/unit/db/test_migration_heads.py`** — Phoenix runs `alembic upgrade head`,
*singular*. Two heads means the server will not start. Git reports **no conflict** for
this, because two branches can each append a migration without touching the same line. If
this fails after a sync, re-point the earliest fork-local migration's `down_revision` at
upstream's new head (`make sync-fork` does it; do it by hand if you merged manually).

**`TestEveryProviderAcceptsImagesNow`** in
`tests/unit/server/api/helpers/test_playground_media.py` — asserts each provider's payload
actually carries the media. A failure here means a conflict resolution dropped a media
branch. This is worth understanding: with the branch gone, every provider still returns a
valid *text-only* message, so any test that merely checks the builder returned something
will pass while the model receives no image at all.

**`app/src/schemas/__tests__/contentPartSelectionSets.test.ts`** — a GraphQL document that
selects `TextContentPart` without the media parts silently drops media from every prompt it
loads. This test also fires on **upstream's** new documents, roughly every two months. When
it does, decide which kind of document it is:

- feeds a prompt round-trip (loaded, then saved back) → add the media selections, because
  otherwise saving erases media;
- read-only display → add it to `EXEMPT` **with the reason**, since omitting media there is
  cosmetic.

## Gotchas that no test will catch

1. **After any migration edit, diff `scripts/ddl/postgresql_schema.sql` before
   committing.** A repo hook regenerates it, and on PostgreSQL 17+ it emits ~327
   `NOT NULL <column>` table constraints — legal on 17, absent from the `postgres:12`
   upstream CI uses. Restore the committed file (`git checkout HEAD -- <path>`) unless the
   schema genuinely changed. Do not patch `scripts/ddl/generate_ddl_postgresql.py`: it is
   upstream's generator and upstream's bug, and patching it enlarges the conflict surface.
2. **Merging or renumbering migrations breaks existing dev databases.** The schema stays
   correct but `alembic_version` points at a revision that no longer exists, and Phoenix
   refuses to start. Back the database up, then stamp it at the surviving revision.
3. **There is no Python reloader.** Restart the backend after backend changes, and tell the
   user to re-attach their debugger — the dev server runs under `debugpy`.
4. **Keep the branch to one concern.** Do not fold unrelated fixes into it. That single
   rule has prevented more conflict than every structural change combined.

## Adding to the fork

When the sync is done and there is new fork work to write, put it in fork-owned paths:

- backend media handling → `src/phoenix/server/api/helpers/playground_media/` (a module
  per provider, `__init__.py` re-exporting);
- leave only a one-to-three-line call in the upstream file.

If a block of fork logic has to be duplicated across upstream files, extract it instead.
Duplication is worse than its line count suggests: a merge can fix one copy and leave the
other stale, with no test failing.
