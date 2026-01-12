# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat(phoenix-insight): <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Config Schema & Core

### config-schema

- content: Create `src/config/schema.ts` with Zod schema for all config values: `baseUrl` (string, default "http://localhost:6006"), `apiKey` (string, optional), `limit` (number, default 1000), `stream` (boolean, default true), `mode` ("sandbox" | "local", default "sandbox"), `refresh` (boolean, default false), `trace` (boolean, default false). Export the schema and inferred TypeScript type `Config`.
- status: complete
- dependencies: none

### config-loader

- content: Create `src/config/loader.ts` with functions to: (1) `getConfigPath()` - return config file path from `PHOENIX_INSIGHT_CONFIG` env var, or `--config` CLI arg, or default `~/.phoenix-insight/config.json`; (2) `loadConfigFile(path)` - read and parse JSON file, return parsed object or null if not found; (3) `validateConfig(raw)` - validate with Zod schema, log warnings on parse failure, return validated config or defaults; (4) `createDefaultConfig(path)` - if no config file exists at the default path, create the directory if needed and write a config.json with ALL default values from the schema, then log an informational message to stderr (e.g., "Created default config at ~/.phoenix-insight/config.json"). This should only trigger for the default path, not for custom paths specified via env var or CLI flag.
- status: complete
- dependencies: config-schema

### config-singleton

- content: Create `src/config/index.ts` with singleton pattern: (1) `initializeConfig(cliArgs)` - merge config file < env vars < CLI args (with priority to env vars as specified), validate with Zod, store in module-level variable; (2) `getConfig()` - return the initialized config or throw if not initialized. Export `Config` type from schema.
- status: complete
- dependencies: config-loader

---

## Phase 2: CLI Integration

### cli-config-flag

- content: Add `--config <path>` global option to the CLI in `src/cli.ts`. This flag should be parsed early (before other options) and passed to `initializeConfig()`. Update help text to document the new flag.
- status: complete
- dependencies: config-singleton

### cli-use-config

- content: Refactor `src/cli.ts` to use the config singleton instead of directly reading `process.env` and CLI options. Replace all occurrences of `options.baseUrl`, `options.apiKey`, `options.limit`, `options.stream`, `options.local`, `options.refresh`, `options.trace` with `getConfig().<field>`. Remove default value specifications from Commander options (config provides defaults).
- status: pending
- dependencies: cli-config-flag

### cli-snapshot-use-config

- content: Update the `snapshot` command in `src/cli.ts` to use `getConfig()` for `baseUrl`, `apiKey`, and `trace` instead of reading from options directly.
- status: pending
- dependencies: cli-use-config

---

## Phase 3: Documentation & Cleanup

### readme-config-docs

- content: Update `README.md` to document the new config system: (1) Add section explaining config file location and format; (2) Document `PHOENIX_INSIGHT_CONFIG` env var; (3) Document `--config` CLI flag; (4) Add example `config.json` with all options; (5) Explain precedence order (config file < env vars < CLI args); (6) Document the auto-creation behavior on first launch (default config file is created automatically with all default values if not present).
- status: pending
- dependencies: cli-snapshot-use-config
