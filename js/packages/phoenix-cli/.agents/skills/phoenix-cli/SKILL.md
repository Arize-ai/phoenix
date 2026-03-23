---
name: phoenix-cli
description: >
  Design and implementation guide for the Phoenix CLI (`px`). Covers the noun-verb command structure,
  dual-audience design (humans and coding agents), Commander.js patterns, configuration resolution,
  output formats, exit codes, and conventions for adding or modifying commands. Use this skill whenever
  working on phoenix-cli commands — adding new commands, modifying existing ones, refactoring command
  structure, or reviewing CLI code. Also trigger when the user mentions `px` commands, CLI design,
  or asks how to add a new resource to the CLI.
---

# Phoenix CLI Design Guide

The Phoenix CLI (`px`) is a command-line interface for the Phoenix AI observability platform. It serves two distinct audiences simultaneously: **humans** typing commands in a terminal and **coding agents** (Claude Code, Cursor, Codex, Gemini CLI) executing commands programmatically. Every design decision should consider both.

## Command Structure: Noun-Verb

All commands follow a **noun-verb** pattern, modeled after the GitHub CLI (`gh`):

```
px <resource> <action> [arguments] [options]
```

The resource is always **singular** — it names the type of thing you're acting on, not how many:

```bash
px project list              # not "px projects"
px project create            # not "px create-project"
px project get <id>          # not "px project <id>"
px trace list                # not "px traces"
px trace get <trace-id>      # not "px trace <trace-id>"
px dataset list
px dataset get <name-or-id>
px experiment list --dataset <name-or-id>
px prompt get <name> --tag production
px auth status
px self update
```

This matters because it makes the CLI **predictable**. Once a user (or agent) learns the pattern for one resource, they can guess the command for any other resource without reading docs. A coding agent that knows `px project list` exists can confidently try `px dataset list` without searching for help text.

### Why noun-verb over verb-noun or flat commands

**Discoverability**: `px project <TAB>` reveals all project-related actions. With flat commands (`px list-projects`, `px create-project`), you'd need to scan the entire command list to find project-related operations.

**Consistency**: Every resource supports the same verbs where applicable (`list`, `get`, `create`, `update`, `delete`). This predictability is especially valuable for agents, who can construct commands from knowledge of the resource name alone.

**Composability**: Grouping by resource makes it natural to add new actions to existing resources without polluting the top-level namespace.

### Standard verbs

Use these verbs consistently across all resources:

| Verb     | Purpose                        | Takes argument? | Example                          |
|----------|--------------------------------|-----------------|----------------------------------|
| `list`   | List/query multiple resources  | No (uses flags) | `px project list --limit 10`     |
| `get`    | Fetch a single resource by ID  | Yes (required)  | `px trace get <trace-id>`        |
| `create` | Create a new resource          | Varies          | `px project create --name foo`   |
| `update` | Modify an existing resource    | Yes (required)  | `px project update <id> --name bar` |
| `delete` | Remove a resource              | Yes (required)  | `px project delete <id>`         |

Not every resource supports every verb — datasets may not support `create` via CLI if the primary flow is through the SDK. Only implement verbs that make sense for the resource.

Additional verbs for specialized actions are fine when the standard set doesn't cover it:
- `px auth login`, `px auth status`
- `px self update`
- `px docs fetch`
- `px api graphql <query>`

### Backward compatibility during migration

The CLI is evolving from a flat structure (`px projects`, `px traces`) toward full noun-verb. During the transition, both forms may coexist. When migrating an existing command:

1. Create the new noun-verb form as the primary command
2. Keep the old form as a hidden alias (Commander's `.alias()` or a hidden command) so existing scripts don't break
3. Document only the noun-verb form going forward

## Dual-Audience Design: Humans and Agents

The CLI must be equally usable by a person at a terminal and by a coding agent executing commands in a subprocess. These audiences have different needs:

| Concern           | Human                            | Agent                                 |
|-------------------|----------------------------------|---------------------------------------|
| Output format     | Pretty tables, color, spinners   | Structured JSON, no decoration        |
| Error messages    | Friendly, actionable suggestions | Parseable, semantic exit codes        |
| Discoverability   | Help text, tab completion        | Predictable structure, `--help` flags |
| Progress feedback | Spinners, progress bars          | Suppress with `--no-progress`         |

### The `--format` flag

Every command that outputs data supports `--format`:

- **`pretty`** (default) — Human-readable tables and formatting. This is what you see when you type a command interactively.
- **`json`** — Indented JSON. Good for human inspection of structured data.
- **`raw`** — Compact single-line JSON. Designed for piping into `jq` or for agent consumption. No extra whitespace, no decoration.

Some commands support additional formats (e.g., `--format text` for prompts). The default is always `pretty`.

### The `--no-progress` flag

Progress indicators (spinners, status messages) write to stderr, so they don't contaminate stdout when piping. But agents should pass `--no-progress` to suppress them entirely — they add noise to agent logs with no benefit.

**Agent-friendly invocation pattern:**
```bash
px trace list --format raw --no-progress | jq '...'
```

### Semantic exit codes

Exit codes let agents branch on failure mode without parsing stderr:

| Code | Constant          | Meaning                                             |
|------|-------------------|-----------------------------------------------------|
| 0    | `SUCCESS`         | Command completed successfully                      |
| 1    | `FAILURE`         | Unspecified or unexpected error                     |
| 2    | `CANCELLED`       | User cancelled (e.g., declined a confirmation)      |
| 3    | `INVALID_ARGUMENT`| Bad CLI flags, missing required args, invalid input |
| 4    | `AUTH_REQUIRED`   | Not authenticated or insufficient permissions       |
| 5    | `NETWORK_ERROR`   | Failed to connect to server or network request      |

Exit codes are defined in `src/exitCodes.ts`. Always use the named constants, never bare numbers.

## Adding a New Command

### File structure

Each resource group gets its own file in `src/commands/`:

```
src/commands/
├── index.ts              # Barrel file re-exporting all create*Command functions
├── projects.ts           # px project list, px project get, etc.
├── traces.ts             # px trace list, px trace get, etc.
├── spans.ts
├── datasets.ts
├── experiments.ts
├── sessions.ts
├── prompts.ts
├── auth.ts               # px auth status, px auth login
├── self.ts               # px self update
├── api.ts                # px api graphql
├── docs.ts               # px docs fetch
├── formatTable.ts        # Shared table formatting utilities
└── format*.ts            # Resource-specific formatters
```

### Command registration pattern

Every command file exports a `create<Resource>Command()` function that returns a Commander `Command` instance. The top-level command is the **noun**, and subcommands are the **verbs**:

```typescript
import { Command } from "commander";

// The noun: "project"
export function createProjectCommand(): Command {
  const command = new Command("project");
  command.description("Manage Phoenix projects");

  // The verbs
  command.addCommand(createProjectListCommand());
  command.addCommand(createProjectGetCommand());
  command.addCommand(createProjectCreateCommand());

  return command;
}

// verb: "list"
function createProjectListCommand(): Command {
  const command = new Command("list");
  command
    .description("List all available Phoenix projects")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--format <format>", "Output format: pretty, json, or raw", "pretty")
    .option("--no-progress", "Disable progress indicators")
    .option("-n, --limit <number>", "Maximum number of results", parseInt)
    .action(projectListHandler);
  return command;
}

// verb: "get"
function createProjectGetCommand(): Command {
  const command = new Command("get");
  command
    .description("Fetch a single project by name or ID")
    .argument("<identifier>", "Project name or ID")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--format <format>", "Output format: pretty, json, or raw", "pretty")
    .option("--no-progress", "Disable progress indicators")
    .action(projectGetHandler);
  return command;
}
```

Register in `src/cli.ts`:
```typescript
program.addCommand(createProjectCommand());
```

Export from `src/commands/index.ts`:
```typescript
export { createProjectCommand } from "./projects";
```

### Handler function pattern

Handler functions follow a consistent shape:

```typescript
interface ProjectListOptions {
  endpoint?: string;
  apiKey?: string;
  format?: OutputFormat;
  progress?: boolean;
  limit?: number;
}

async function projectListHandler(options: ProjectListOptions): Promise<void> {
  try {
    // 1. Resolve config (CLI flags override env vars)
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    // 2. Validate config
    if (!config.endpoint) {
      writeError({ message: getConfigErrorMessage({ errors: ["..."] }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // 3. Create client
    const client = createPhoenixClient({ config });

    // 4. Fetch data
    const projects = await fetchProjects(client, { limit: options.limit });

    // 5. Format and output
    const output = formatProjectsOutput({
      projects,
      format: options.format,
    });
    writeOutput({ message: output });
  } catch (error) {
    writeError({
      message: `Error fetching projects: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}
```

For commands that take a positional argument (like `get`), the argument comes before `options` in the handler signature:

```typescript
async function projectGetHandler(
  identifier: string,
  options: ProjectGetOptions
): Promise<void> {
  // ...
}
```

### Options interface

Define a TypeScript interface for every handler's options. Use descriptive names — never abbreviate option fields. Common options that appear across many commands:

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

The CLI resolves configuration from multiple sources with this priority:

1. **CLI flags** (highest priority) — `--endpoint`, `--api-key`, `--project`
2. **Environment variables** — `PHOENIX_HOST`, `PHOENIX_API_KEY`, `PHOENIX_PROJECT`
3. **Defaults** — `http://localhost:6006` for endpoint

Use `resolveConfig()` from `src/config.ts` — it handles the merge logic. Never read environment variables directly in command handlers.

### Output formatting

Each resource type has formatting modules in `src/commands/format*.ts`:

- `formatTable.ts` — Shared table rendering with terminal-width-aware column truncation
- `formatProjectsOutput()`, `formatTracesOutput()`, etc. — Resource-specific formatters

Formatters accept a `format` option and return a string. The `pretty` format uses ASCII tables; `json` returns indented JSON; `raw` returns compact JSON.

When creating a new resource command, create a corresponding formatter. Follow the existing pattern — accept an object with the data and format, return a string.

### I/O functions

Use the helpers from `src/io.ts`:

```typescript
writeOutput({ message })   // → stdout (data the user/agent wants)
writeError({ message })    // → stderr (errors)
writeProgress({ message, noProgress })  // → stderr (suppressible status updates)
```

Never use `console.log` directly. The `writeOutput`/`writeError` split ensures stdout contains only data output, which is critical for piping.

## Naming Conventions

Follow the conventions in the phoenix-typescript skill:

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

When adding a command, write tests for:
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

## Global options placement

Global options (`--endpoint`, `--api-key`) go on the **verb**, not the noun. This is because Commander attaches options to the command that defines them:

```bash
# Correct — options on the verb
px project list --endpoint http://my-server:6006

# Not — options on the noun (Commander won't parse these)
px project --endpoint http://my-server:6006 list
```

## Checklist for adding a new resource command

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
