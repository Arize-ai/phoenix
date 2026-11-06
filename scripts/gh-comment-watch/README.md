# GH Comment Watch

A small TypeScript + React app for on-call engineers to catch GitHub issue/PR comments from **outside users that nobody on the team has replied to** — the ones we tend to overlook on old threads.

It scans **all open** issues, PRs, **and discussions** across **one or more repos** into a local SQLite cache, figures out who "spoke last" on each thread, and surfaces the ones awaiting a response in a React dashboard. It also has a **My queue** tab for issues/PRs assigned to you or personally awaiting your review. Defaults to monitoring `Arize-ai/phoenix` and `Arize-ai/openinference`; each item is tagged with its repo and the UI has a per-repo filter.

> **State is local and persistent.** The SQLite database defaults to `~/.phoenix/.gh-comment-watch/local.db` — under your home dir, outside the repo, so it survives `git clean` and is shared across checkouts. Startup runs Drizzle Kit migrations before the server starts, so restarts keep the local cache and schema upgrades are applied idempotently.

> **No activity window.** Every *open* thread is tracked regardless of age — a thread ignored for a year is exactly what this tool exists to surface, so it must never age out. (Closed/merged threads drop off.) The tool only reads GitHub; it never posts, labels, or reacts.

## What counts as "needs attention"

For each open thread we walk the conversation (the opening post + every comment, plus threaded replies for discussions), ignoring bots, and look at the **last human entry**:

| Last human entry | Verdict |
| --- | --- |
| A team member posted it | ✅ handled — _"Team posted last"_ |
| An outside user, no later team reply | ⚠️ **needs attention** |
| Discussion exceeds the fetched GraphQL slice | ⚠️ **needs attention** — _"Long discussion; review manually"_ |

"Team" is the @claude workflow allowlist in `.github/workflows/claude.yml`. Closed/merged threads are treated as handled (they're simply not synced).

Flagged comments whose author is an **org member but not on the allowlist** get an "Arize-ai org" badge — a hint that it's a colleague off the on-call list rather than an outside user. Membership is checked via `GET /orgs/{org}/members/{login}` and cached for a week in `org_membership_cache`.

A **Hide team-authored** toggle (on by default) drops threads *opened* by a team member — our own issues and PRs, where an outside reply landing last would otherwise flag the thread even though it's our own work. Untick it to include team-opened threads. The toggle only applies to the Needs reply / All tracked views, not My queue.

> Scope note: only conversation comments are tracked, not PR code-review comments. Issues/PRs come from the REST API; discussions (which have no REST API) come from GraphQL, including their threaded replies.

## My queue

The **My queue** tab tracks open issues/PRs that are **directly assigned to you** or have **a review personally requested from you** — scoped to the monitored repos. "You" defaults to the `gh` token's user; set `VIEWER` to watch someone else's queue. Review requests use GitHub's `user-review-requested` qualifier, so a request routed through a team you belong to does **not** count — only requests addressed to you personally. Each row is badged _Assigned to me_ / _Review requested_, and still shows its team-triage status (e.g. _Team posted last_) so you can see whether others have already weighed in.

## Requirements

- Node ≥ 22, `pnpm`
- `gh` CLI logged in (`gh auth login`) — the app reuses its token. Or set `GITHUB_TOKEN`.

## Setup & run

```bash
make gh-comment-watch
```

Or run it directly:

```bash
cd scripts/gh-comment-watch
pnpm start          # install deps, build UI, migrate DB, serve UI + API
```

Open http://localhost:58736 and click **Sync now** for the first pull.

### Development (hot reload)

```bash
pnpm dev            # migrate DB, then run the Hono API on :58736
pnpm dev:web        # Vite UI on :5173 (proxies /api → :58736)
```

### Database

The schema lives in `src/schema.ts` and migrations live under `drizzle/`. Use Drizzle Kit for schema changes:

```bash
pnpm db:generate    # generate a migration after editing src/schema.ts
pnpm db:migrate     # apply pending migrations to the local SQLite file
```

`DB_FILE_NAME` can point at a different SQLite file. Its parent directory is created automatically.

## Architecture

- `src/server.ts` is a Hono server using `@hono/node-server`; it exposes `/api/status`, `/api/items`, and `/api/sync`, and serves the built React app from `web/dist`.
- `src/db.ts` uses Drizzle ORM over `better-sqlite3` for typed reads and writes.
- `src/sync.ts`, `src/github.ts`, and `src/discussions.ts` pull GitHub data via REST and GraphQL, then write rows through the Drizzle data-access layer.
- `web/src/App.tsx` is the React dashboard. Tabs and filters are driven by URL query params (`tab`, `mine`, `type`, `repo`, `q`, `sort`), so refreshing or bookmarking a filtered view preserves it.

## Syncing

The server keeps the local SQLite cache fresh on its own: it runs a sync on startup and then every `SYNC_INTERVAL_MINUTES` (default 15). You can also hit **Sync now** in the UI any time.

The **first** sync (an empty DB on startup, or `POST /api/sync?full=1`) does a **baseline scan of every open thread**, regardless of age — nothing is dropped for being old. After that, syncs are **incremental**: they ask GitHub only for threads updated since our cursor (issues/PRs via `?since=…&sort=updated`; discussions paged newest-first by `updatedAt`, stopped once past the cutoff), including ones that were just closed so they can be dropped. Untouched older rows are left in place. This keeps regular syncs cheap — a quiet interval fetches ~zero threads — while still tracking the whole open backlog.

The cursor is a **data watermark**, not wall-clock time: per repo and kind we remember the newest `updated_at` we've actually ingested and ask for threads updated since `watermark − SYNC_OVERLAP_MINUTES`. Because the watermark never moves past data we haven't seen, an update briefly missing from GitHub's `since` index can't slip behind the cursor — the next sync still catches it (a wall-clock cursor would jump to "now" and strand it until the next baseline). The overlap only has to cover GitHub's index reordering window. To catch closures/transfers that never re-surface, the server also does a periodic full baseline scan every `FULL_SYNC_INTERVAL_HOURS` (default 24; set to `0` to disable).

## Configuration (env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `REPOS` | `Arize-ai/phoenix,Arize-ai/openinference` | comma/space-separated `owner/repo` list to monitor (`REPO` still works for a single repo) |
| `PORT` | `58736` | server port |
| `DB_FILE_NAME` | `~/.phoenix/.gh-comment-watch/local.db` | local SQLite cache file (parent dir created automatically) |
| `SEED_ORG` | first repo's owner | org used to check membership badges (all repos assumed in this org) |
| `VIEWER` | `@me` (the token's user) | whose personal queue to track for the **My queue** tab |
| `GITHUB_TOKEN` | — | used instead of the `gh` CLI token if set |
| `CONCURRENCY` | `8` | parallel GitHub fetches during a sync |
| `SYNC_INTERVAL_MINUTES` | `15` | background auto-sync cadence (`0` disables) |
| `FULL_SYNC_INTERVAL_HOURS` | `24` | periodic full scan cadence to prune stale closed rows (`0` disables) |
| `SYNC_OVERLAP_MINUTES` | `10` | how far before the data watermark incremental syncs look back, to cover GitHub's `since`-index reordering |
