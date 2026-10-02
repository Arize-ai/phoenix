# Agent Instructions — `@arizeai/phoenix-cli`

Guidance for agents working on the Phoenix CLI (`px`, `pxi`). The repository-wide
[AGENTS.md](../../../AGENTS.md) takes precedence; the full design specification is the
[`phoenix-cli-development` skill](.agents/skills/phoenix-cli-development/SKILL.md) — read it
before adding or changing a command.

## What this package is

A noun-verb CLI (`px <resource> <verb>`) over the Phoenix REST and GraphQL APIs, built on
Commander.js and `@arizeai/phoenix-client`. It serves two audiences at once: humans at a
terminal and coding agents piping `--format raw --no-progress` output into `jq`. `pxi` is the
interactive agent chat UI (Ink/React) in `src/pxi/`.

## Layout

- `src/cli.ts` — builds the `Command` tree; every noun is registered here
- `src/commands/<resource>.ts` — one file per noun: options interfaces, handlers, `create<Resource>Command()`
- `src/commands/format<Resource>.ts` — pure formatters (`pretty` | `json` | `raw`) returning strings
- `src/commands/options.ts` — shared option shapes (`CommonOptions`, `DeleteOptions`, …); reuse, don't redeclare
- `src/config.ts`, `src/settings.ts` — config resolution (flags → env → profile → `.env.phoenix` → defaults) and `~/.px/settings.json`
- `src/exitCodes.ts`, `src/structuredError.ts`, `src/io.ts`, `src/confirm.ts` — exit codes, `{error, code, hint}` envelope, stdout/stderr helpers, delete gating
- `src/setup/` — `px setup` onboarding flow with injectable deps
- `test/` — vitest suite mirroring `src/`; `test/mockServer.ts` + `test/testUtils.ts` are the harness

## Commands

Run from `js/` unless noted (`pnpm` is the package manager, see `js/package.json`).

```bash
pnpm install --frozen-lockfile
pnpm --filter "@arizeai/phoenix-cli..." run build   # builds the CLI and its workspace deps
cd packages/phoenix-cli && pnpm test                 # vitest (needs the deps above built once)
cd packages/phoenix-cli && pnpm typecheck
pnpm fmt:check && pnpm lint                          # oxfmt + oxlint, what CI runs
cd packages/phoenix-cli && pnpm dev -- <args>        # run from source, e.g. `pnpm dev -- secret set --help`
```

CI (`.github/workflows/typescript-CI.yml`) runs build → typecheck → fmt:check → lint → test.
Publishing uses changesets: add `js/.changeset/<slug>.md` for any user-visible change.

## Non-negotiables

- **stdout is data, stderr is everything else.** Use `writeOutput` / `writeError` /
  `writeProgress` from `src/io.ts`; never `console.log`.
- **Semantic exit codes** (`ExitCode`): `3` bad input, `4` auth, `5` network, `2` cancelled. Under
  `--format json|raw`, errors go through `writeStructuredError` so agents can parse them.
- **Delete verbs** are gated by `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` (`assertDeletesEnabled`)
  and confirm via `confirmOrExit` unless `-y/--yes`. Use `DeleteOptions` as-is.
- **Handlers never read `process.env` for connection settings** — pass flags to `resolveConfig()`.
- **Secrets never reach argv, stdout, or error text.** `px secret set` has no `--value` flag by
  design; values come from stdin, `--value-file`, `--from-env`, or `--env-file`. Error messages
  name key names and input positions only, and `redactSecretValues` scrubs every submitted value
  from any error that did not originate in the CLI. Keep it that way; the
  `secretConventions.test.ts` security invariants enforce it.
- **Tests use typed MSW handlers** (`setupMockPhoenixServer`, `http.put(...)`), not client mocks
  and never a stubbed global `fetch`. Every command has a conventions test that validates
  `--help`, `README.md`, and skill examples against the real option surface — when you add a flag
  or example, run the suite.
- Every new or changed command updates `README.md`, `.agents/skills/phoenix-cli/SKILL.md`
  (bump its `version`), and `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-cli.mdx`.

## Checklist for a new verb

1. Options interface extending the matching shape in `options.ts`, TSDoc per field
2. Handler: shape validation before the `try` block, `resolveConfig` → `createPhoenixClient`, typed
   `client.GET/POST/PUT/DELETE` call, formatter for output, catch-all mapping to `getExitCodeForError`
3. `.addHelpText("after", …)` with `# commented` examples, at least one agent-friendly
4. Register in `src/commands/index.ts` and `src/cli.ts`; add to `test/cli.test.ts`
5. Tests: handler over HTTP, one unpinned run against generated handlers, each error/exit path,
   formatter output, and a conventions test
6. Docs + changeset (see above)
