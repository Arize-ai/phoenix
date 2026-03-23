---
name: phoenix-cli-development
description: >
  Design and implementation guide for the Phoenix CLI (`px`). Covers the noun-verb command structure,
  dual-audience design (humans and coding agents), Commander.js patterns, configuration resolution,
  output formats, exit codes, and conventions for adding or modifying commands. Use this skill whenever
  working on phoenix-cli commands — adding new commands, modifying existing ones, refactoring command
  structure, or reviewing CLI code. Also trigger when the user mentions `px` commands, CLI design,
  or asks how to add a new resource to the CLI.
---

# Phoenix CLI Design Specification

The Phoenix CLI (`px`) is a command-line interface for the Phoenix AI observability platform. It serves two distinct audiences simultaneously: **humans** typing commands in a terminal and **coding agents** (Claude Code, Cursor, Codex, Gemini CLI) executing commands programmatically.

This specification uses RFC 2119 keywords (MUST, SHOULD, MAY, etc.) to indicate requirement strength.

## Command Structure: Noun-Verb

All commands MUST follow a **noun-verb** pattern, modeled after the GitHub CLI (`gh`):

```
px <resource> <action> [arguments] [options]
```

Resource names MUST be **singular** — they name the type of thing you're acting on, not how many:

```bash
px project list              # not "px projects"
px project create            # not "px create-project"
px trace get <trace-id>
px dataset get <name-or-id>
px auth status
```

### Standard verbs

Implementations SHOULD use these verbs consistently across all resources:

| Verb     | Purpose                        | Takes argument? | Example                          |
|----------|--------------------------------|-----------------|----------------------------------|
| `list`   | List/query multiple resources  | No (uses flags) | `px project list --limit 10`     |
| `get`    | Fetch a single resource by ID  | Yes (required)  | `px trace get <trace-id>`        |
| `create` | Create a new resource          | Varies          | `px project create --name foo`   |
| `update` | Modify an existing resource    | Yes (required)  | `px project update <id> --name bar` |
| `delete` | Remove a resource              | Yes (required)  | `px project delete <id>`         |

Not every resource supports every verb — datasets MAY omit `create` via CLI if the primary flow is through the SDK. Implementations SHALL only add verbs that make sense for the resource.

Additional verbs for specialized actions are RECOMMENDED when the standard set doesn't cover it:
- `px auth login`, `px auth status`
- `px self update`
- `px docs fetch`
- `px api graphql <query>`

### Backward compatibility during migration

The CLI is evolving from a flat structure (`px projects`, `px traces`) toward full noun-verb. During the transition, both forms MAY coexist. When migrating an existing command:

1. The new noun-verb form MUST be created as the primary command
2. The old form SHOULD be kept as a hidden alias (Commander's `.alias()` or a hidden command) so existing scripts don't break
3. Only the noun-verb form SHALL be documented going forward

## Dual-Audience Design: Humans and Agents

The CLI MUST be equally usable by a person at a terminal and by a coding agent executing commands in a subprocess. These audiences have different needs:

| Concern           | Human                            | Agent                                 |
|-------------------|----------------------------------|---------------------------------------|
| Output format     | Pretty tables, color, spinners   | Structured JSON, no decoration        |
| Error messages    | Friendly, actionable suggestions | Parseable, semantic exit codes        |
| Discoverability   | Help text, tab completion        | Predictable structure, `--help` flags |
| Progress feedback | Spinners, progress bars          | Suppress with `--no-progress`         |

### The `--format` flag

Every command that outputs data MUST support `--format`:

- **`pretty`** (default) — Human-readable tables and formatting. This is what you see when you type a command interactively.
- **`json`** — Indented JSON. Good for human inspection of structured data.
- **`raw`** — Compact single-line JSON. Designed for piping into `jq` or for agent consumption. No extra whitespace, no decoration.

Commands MAY support additional formats (e.g., `--format text` for prompts). The default MUST always be `pretty`.

### The `--no-progress` flag

Progress indicators (spinners, status messages) MUST write to stderr, so they don't contaminate stdout when piping. Agents SHOULD pass `--no-progress` to suppress them entirely — they add noise to agent logs with no benefit.

**Agent-friendly invocation pattern:**
```bash
px trace list --format raw --no-progress | jq '...'
```

### Semantic exit codes

Exit codes allow agents to branch on failure mode without parsing stderr:

| Code | Constant          | Meaning                                             |
|------|-------------------|-----------------------------------------------------|
| 0    | `SUCCESS`         | Command completed successfully                      |
| 1    | `FAILURE`         | Unspecified or unexpected error                     |
| 2    | `CANCELLED`       | User cancelled (e.g., declined a confirmation)      |
| 3    | `INVALID_ARGUMENT`| Bad CLI flags, missing required args, invalid input |
| 4    | `AUTH_REQUIRED`   | Not authenticated or insufficient permissions       |
| 5    | `NETWORK_ERROR`   | Failed to connect to server or network request      |

Exit codes are defined in `src/exitCodes.ts`. Implementations MUST use the named constants and MUST NOT use bare numeric literals for exit codes.

## Adding a New Command

### Options interface

Every handler MUST define a TypeScript interface for its options. Field names MUST be descriptive — abbreviations MUST NOT be used. Common options that appear across many commands:

```typescript
interface CommonOptions {
  endpoint?: string;    // --endpoint: Phoenix API endpoint override
  apiKey?: string;      // --api-key: API key override
  project?: string;     // --project: Project name or ID override
  format?: OutputFormat; // --format: Output format (pretty/json/raw)
  progress?: boolean;   // --no-progress: Suppress progress indicators
}
```

### Configuration resolution

The CLI MUST resolve configuration from multiple sources with this priority:

1. **CLI flags** (highest priority) — `--endpoint`, `--api-key`, `--project`
2. **Environment variables** — `PHOENIX_HOST`, `PHOENIX_API_KEY`, `PHOENIX_PROJECT`
3. **Defaults** — `http://localhost:6006` for endpoint

Implementations MUST use `resolveConfig()` from `src/config.ts` for this merge logic. Command handlers MUST NOT read environment variables directly.

### Output formatting

Each resource type SHOULD have formatting modules in `src/commands/format*.ts`:

- `formatTable.ts` — Shared table rendering with terminal-width-aware column truncation
- `formatProjectsOutput()`, `formatTracesOutput()`, etc. — Resource-specific formatters

Formatters MUST accept a `format` option and return a string. The `pretty` format uses ASCII tables; `json` returns indented JSON; `raw` returns compact JSON.

When creating a new resource command, a corresponding formatter MUST be created following the existing pattern — accept an object with the data and format, return a string.

### I/O functions

Implementations MUST use the helpers from `src/io.ts`:

```typescript
writeOutput({ message })   // → stdout (data the user/agent wants)
writeError({ message })    // → stderr (errors)
writeProgress({ message, noProgress })  // → stderr (suppressible status updates)
```

`console.log` MUST NOT be used directly. The `writeOutput`/`writeError` split ensures stdout contains only data output, which is REQUIRED for piping correctness.

## Naming Conventions

Implementations MUST follow these naming conventions (see also the phoenix-typescript skill):

- **Functions and variables**: `camelCase` — `createProjectCommand`, `projectListHandler`
- **Types and interfaces**: `PascalCase` — `ProjectListOptions`, `OutputFormat`
- **Constants**: `SCREAMING_SNAKE_CASE` — `ExitCode.SUCCESS`, `CLI_VERSION`
- **Files**: `camelCase.ts` — `projects.ts`, `formatProjects.ts`
- **No abbreviations** — `projectIdentifier` not `projId`, `annotationConfig` not `annCfg`

## Testing

Tests use **vitest** and live in the `test/` directory, mirroring `src/` structure.

```bash
pnpm test          # run all tests
pnpm test:watch    # watch mode
```

When adding a command, tests MUST cover:
- The handler logic (mocking the Phoenix client)
- Formatter output for each format mode
- Edge cases: missing config, network errors, empty results
- Exit code correctness for error paths

## Build and Run

```bash
pnpm build         # TypeScript → build/
pnpm dev           # Run from source via tsx (during development)
```

The CLI is published as `@arizeai/phoenix-cli` with binary aliases `px` and `phoenix-cli`.

## Global Options Placement

Global options (`--endpoint`, `--api-key`) MUST be placed on the **verb**, not the noun. This is REQUIRED because Commander attaches options to the command that defines them:

```bash
# Correct — options on the verb
px project list --endpoint http://my-server:6006

# Wrong — options on the noun (Commander won't parse these)
px project --endpoint http://my-server:6006 list
```

## Checklist for Adding a New Resource Command

1. Create `src/commands/<resource>.ts` with `create<Resource>Command()` exporting the noun
2. Add verb subcommands (`list`, `get`, `create`, etc.) as needed
3. Create `src/commands/format<Resource>.ts` for output formatting
4. Define options interfaces with descriptive field names
5. Use `resolveConfig()` for configuration, `createPhoenixClient()` for API calls
6. Use `writeOutput()`/`writeError()` for I/O, semantic `ExitCode` constants for errors
7. Export from `src/commands/index.ts`
8. Register in `src/cli.ts` via `program.addCommand()`
9. Add tests in `test/`
10. Update `README.md` with usage examples showing both human and agent-friendly invocations
