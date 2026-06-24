# @arizeai/pxi

A terminal chatbot for **PXI (Phoenix Intelligence)** — the Phoenix server agent.
`pxi` opens an interactive TUI that streams a conversation with the agent over the
Phoenix REST endpoint `POST /agents/server/sessions/{session_id}/chat`.

Built with [OpenTUI](https://github.com/sst/opentui) (React bindings) and runs on
[Bun](https://bun.sh). Type safety for the request/response contract comes from
`@arizeai/phoenix-client` (generated OpenAPI types) and connection/env resolution
from `@arizeai/phoenix-config`.

## Requirements

- **Bun** (OpenTUI's native renderer uses FFI, which Bun supports out of the box).
- A running Phoenix server with the agent enabled.

## Usage

```bash
# From a published install:
bunx @arizeai/pxi

# From this monorepo (workspace):
pnpm --filter @arizeai/pxi dev
# or
cd js/packages/pxi && bun run src/index.tsx
```

Type a message and press **Enter** to send. The assistant reply streams in as
rendered markdown, and server-side tool activity appears as dim status lines.
Press **Ctrl+C** to exit. Scroll the transcript with the arrow / Page keys.

## Configuration

Connection settings are resolved by `@arizeai/phoenix-config`. CLI flags take
precedence over environment variables.

| Setting    | Flag           | Env var                  | Default                 |
| ---------- | -------------- | ------------------------ | ----------------------- |
| Host       | `--host`       | `PHOENIX_HOST`           | `http://localhost:6006` |
| API key    | `--api-key`    | `PHOENIX_API_KEY`        | _(none)_                |
| Headers    | —              | `PHOENIX_CLIENT_HEADERS` | _(none)_                |
| Provider   | `--provider`   | —                        | `ANTHROPIC`             |
| Model      | `--model`      | —                        | `claude-opus-4-6`       |
| Session id | `--session-id` | —                        | random UUID per run     |

An API key is sent as `Authorization: Bearer <key>`.

```bash
PHOENIX_HOST=https://my-phoenix.example.com \
PHOENIX_API_KEY=phx-… \
bunx @arizeai/pxi --provider OPENAI --model gpt-5
```

## Scripts

- `bun run dev` — run with file watch
- `bun run start` — run once
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — unit tests (vitest)
