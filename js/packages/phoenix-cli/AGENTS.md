# Phoenix CLI (`px`)

## Overview

The Phoenix CLI is a command-line interface for the Phoenix AI observability platform, published as `@arizeai/phoenix-cli` with binary aliases `px` and `phoenix-cli`. It serves two audiences: **humans** and **coding agents**.

## Build & Development

```bash
pnpm install    # install dependencies (from repo root)
pnpm build      # TypeScript → build/
pnpm dev        # run from source via tsx
pnpm test       # run all tests (vitest)
pnpm test:watch # watch mode
```

## Key Conventions

- **Noun-verb command structure**: `px <resource> <action>` (e.g., `px project list`, `px trace get <id>`)
- **Singular resource names**: `px project`, not `px projects`
- **Output formats**: `--format pretty|json|raw` on every data command
- **Exit codes**: use named constants from `src/exitCodes.ts`, never bare numbers
- **I/O helpers**: use `writeOutput()` / `writeError()` / `writeProgress()` from `src/io.ts` — never `console.log`
- **Config resolution**: `resolveConfig()` from `src/config.ts` — CLI flags > env vars > defaults
- **No abbreviations**: `projectIdentifier` not `projId`

## Directory Structure

```
src/
├── cli.ts              # Main entry point
├── config.ts           # Configuration resolution
├── exitCodes.ts        # Semantic exit codes
├── io.ts               # I/O helpers (stdout/stderr)
├── commands/
│   ├── index.ts        # Barrel file
│   ├── projects.ts     # px project list|get|create
│   ├── traces.ts       # px trace list|get
│   ├── auth.ts         # px auth status|login
│   └── format*.ts      # Output formatters
└── ...
test/                   # Mirrors src/ structure (vitest)
```

## Adding a New Command

1. Create `src/commands/<resource>.ts` with `create<Resource>Command()`
2. Add verb subcommands (`list`, `get`, `create`, etc.)
3. Create `src/commands/format<Resource>.ts` for output formatting
4. Export from `src/commands/index.ts`
5. Register in `src/cli.ts` via `program.addCommand()`
6. Add tests in `test/`

See `.agents/skills/phoenix-cli-development/SKILL.md` for the full design guide.
