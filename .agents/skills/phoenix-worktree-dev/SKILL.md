---
name: phoenix-worktree-dev
description: Use whenever Codex operates in a Phoenix git worktree. Explains the optional managed development-session tooling for running, inspecting, restarting, sharing, screenshotting, and cleaning up isolated Phoenix instances. Do not use for a primary checkout unless the user asks for worktree session tooling.
metadata:
  internal: true
---

# Phoenix Worktree Development

This skill owns worktree-specific development workflow decisions. General
Phoenix skills should stay independent of how the server is launched.

Do not start a server only because the checkout is a worktree. Use a managed
session when the task benefits from a live full-stack instance, concurrent
servers, browser verification, screenshots, or a URL the user can open. Honor
an explicit user choice or a suitable server that is already running.

## Managed Sessions

Start an isolated full-stack session in a long-running terminal:

```bash
make dev-session
```

Portless allocates the HTTP and Vite ports and exposes stable HTTPS names.
The session allocates its remaining service ports. On first start, it snapshots
the primary checkout's `js/app/.env` and makes a private online copy of its
SQLite database. The worktree `.env` is an overlay, while session-owned ports,
URLs, and writable paths remain isolated.

Use `PHOENIX_DEV_SEED_DATABASE=false make dev-session` when existing data is not
needed, especially for screenshots that must not expose developer data. Use
`PHOENIX_DEV_DATABASE_SOURCE=/path/to/phoenix.db make dev-session` to select a
different SQLite source. Never point a managed session directly at the primary
database.

## Follow-up Changes

Vite handles ordinary frontend hot reload. Restart the API after Python or
runtime schema changes; restart both processes when environment or shared build
state changed:

```bash
make dev-sessions ARGS="restart api"
make dev-sessions ARGS="restart frontend"
make dev-sessions ARGS="restart all"
```

These commands retain the session URL and private data.

## Browser Verification and Screenshots

Resolve the current worktree URL instead of assuming port 6006:

```bash
PHOENIX_URL="$(make --silent dev-sessions ARGS=url)"
```

Use this URL with `agent-browser`. For PR screenshots, also follow the
`phoenix-pr-screenshot` skill. Use an empty session database unless the requested
image depends on representative primary data.

## Hand Off a Running Instance

If leaving the instance active helps the user review the work, run:

```bash
make dev-sessions ARGS="status"
```

Only describe the instance as available when both API and frontend report
`ready`. Give the user the clickable app URL and
`make dev-sessions ARGS="stop"`. Stop the session instead when it was used only
for internal verification and no follow-up access is useful.

## Manage Several Worktrees

The control plane works from any Phoenix worktree. A selector can be a session
ID, branch, or worktree path; omission selects the current worktree.

```bash
make dev-sessions
make dev-sessions ARGS="status <session>"
make dev-sessions ARGS="open <session>"
make dev-sessions ARGS="stop <session>"
make dev-sessions ARGS="stop --all"
make dev-sessions ARGS="prune"
make dev-sessions ARGS="clean <stopped-session>"
make dev-sessions ARGS="doctor"
```

`stop` preserves the session environment and data. `clean` removes them, so the
next start takes a fresh snapshot.
