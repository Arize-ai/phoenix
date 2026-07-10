---
name: verify
description: Build, launch, and drive a local Phoenix instance to verify UI/server changes end-to-end with real data. Use when verifying a frontend or server change at its runtime surface (browser), not via tests.
---

# Verify Phoenix changes at the runtime surface

Recipe that works (verified 2026-07):

## Build + launch

```bash
cd app && pnpm run build        # compiles React app into src/phoenix/server/static/ (~2 min)

# Copy the dev DB so you don't mutate it (it usually has rich data: traces, datasets, experiments)
sqlite3 ~/.phoenix/phoenix.db ".backup '<scratch>/phoenix-verify-workdir/phoenix.db'"

PHOENIX_PORT=6017 PHOENIX_GRPC_PORT=4327 \
  PHOENIX_WORKING_DIR=<scratch>/phoenix-verify-workdir \
  uv run phoenix serve
```

Gotchas:
- The user's dev Phoenix often occupies gRPC `:4317` — always set `PHOENIX_GRPC_PORT` or startup fails with "Failed to bind [::]:4317".
- Use `PHOENIX_PORT`, not a CLI flag. Server is ready in ~2s; poll `curl http://localhost:6017/datasets` for 200.
- Node IDs in URLs are base64 of `<Type>:<rowid>`, e.g. `python3 -c "import base64; print(base64.b64encode(b'Dataset:8').decode())"` → `/datasets/RGF0YXNldDo4/...`.
- Find data to drive with sqlite3 against the DB copy (tables: `datasets`, `experiments`, `experiment_runs`, `experiment_run_annotations`, `spans`, `traces`).

## Drive with agent-browser

```bash
agent-browser open "http://localhost:6017/<path>"
agent-browser wait --load networkidle && agent-browser wait 3000   # React hydration
agent-browser screenshot
```

- Inner panes scroll, not the window: `agent-browser eval "[...document.querySelectorAll('main')].find(m=>m.scrollHeight>m.clientHeight+10).scrollTop=700"`.
- Recharts hover: `agent-browser hover ".recharts-bar-rectangle"`; legend toggles are `button[title='<series name>']`.
- Theme: `localStorage.setItem('arize-phoenix-theme','light')` then reload to check light mode.
- Count GraphQL requests: `agent-browser eval "performance.getEntriesByType('resource').filter(e=>e.name.includes('/graphql')).length"`.

## Cleanup

Kill the serve process **by PID** (or stop its background task) — never `pkill -f "phoenix serve"`: multiple agent sessions often run Phoenix instances concurrently and a pattern kill takes down the other sessions' servers too. Then `agent-browser close` and delete the DB copy (it's ~500MB).
