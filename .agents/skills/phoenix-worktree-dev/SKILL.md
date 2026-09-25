---
name: phoenix-worktree-dev
description: Start and manage isolated Phoenix development instances in git worktrees when a task needs a live server, browser verification, or instance lifecycle management.
metadata:
  internal: true
---

# Phoenix Worktree Development

Honor the user's chosen workflow or a suitable instance that is already running.
Start an isolated development instance with:

```bash
make dev-session
```

It stays attached in a terminal. Without a TTY (an agent shell), it runs
headless: start it as a background task, then poll `status` until both services
are ready. Requires Node 24; the Portless proxy starts automatically on port
1355 when needed. First startup copies primary configuration and SQLite data
into private state. For screenshots, use an empty database unless representative
data is needed: `PHOENIX_DEV_SEED_DATABASE=false make dev-session` skips cloning
on first start; it does not clear data retained by an existing instance.

Resolve the current development instance URL for browser verification:

```bash
PHOENIX_URL="$(make --silent dev-sessions ARGS=url)"
```

Use this URL with your browser tooling; for PR screenshots, follow
`phoenix-pr-screenshot`. Vite handles frontend hot reload. After Python or
runtime schema changes, run `make dev-sessions ARGS="restart api"`. Restart `all`
when environment or shared build state changes. Restarting retains the URL and
data.

Before handing off a running development instance, check readiness:

```bash
make dev-sessions ARGS="status"
```

Only report it as available when API and frontend both show `ready`. Give the
user the clickable URL, the debugpy address from `status`, and
`make dev-sessions ARGS="stop"`. Stop instances used only for internal
verification when follow-up access would not be useful.

Stopping retains configuration and data; cleaning deletes them. Clean only
within the user's authorized scope; clone age alone does not authorize deletion.

See [the command reference](../../../DEVELOPMENT.md#optional-worktree-development-sessions)
for managing multiple development instances, selectors, alternate database
sources, `open`, `prune`, `clean`, and `doctor`.
