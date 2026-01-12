# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## config-schema

- Zod v4 is already installed (`zod: ^4.3.5`) in package.json - no need to add it
- The schema uses `.default()` on each field to provide defaults when parsing empty objects
- Added a `getDefaultConfig()` helper function that uses `configSchema.parse({})` to get all defaults - this is cleaner than manually constructing defaults
- Had to update `test/scaffold-structure.test.ts` to account for the new `config` directory:
  - Added "config" to the subdirectories array
  - Changed item count from 9 to 10
  - Added `.filter((item) => !item.startsWith("."))` to exclude hidden files like `.DS_Store` from the count
- Test patterns from the existing codebase: use `describe`, `it`, `expect` from vitest, group related tests in describe blocks
- For enum types like `mode`, use `z.enum(["sandbox", "local"])` - this provides both validation and TypeScript type inference

## config-loader

- The `getConfigPath()` function returns both the path AND whether it's the default path - this is needed by `createDefaultConfig()` to decide if it should create the file
- Used a module-level variable (`cliConfigPath`) with a setter function (`setCliConfigPath`) to allow the CLI to pass in the `--config` argument before config resolution
- Priority order for config path: CLI (`--config`) > env var (`PHOENIX_INSIGHT_CONFIG`) > default (`~/.phoenix-insight/config.json`)
- `createDefaultConfig()` only creates files at the default path, never for custom paths (to avoid accidentally overwriting user files)
- Zod validation errors have an `issues` array - we check for this to extract detailed validation error messages
- Error handling pattern: for "expected" cases like file not found, return `null` silently; for unexpected errors like invalid JSON or permission errors, log a warning AND return `null`/defaults (fail gracefully)
- Using `fs.access()` to check if a file exists is cleaner than catching ENOENT from `fs.readFile` when you specifically need to check existence
- Tests use `vi.mock("node:fs/promises")` to mock the fs module entirely - this prevents actual file system operations during tests
- The test file is located at `test/config/loader.test.ts` to match the source file location pattern (`src/config/loader.ts`)

## config-singleton

- The singleton pattern uses a module-level variable (`configInstance`) with `initializeConfig()` to set it and `getConfig()` to retrieve it
- Added `resetConfig()` for testing - essential for test isolation since the singleton persists across tests
- The CLI uses `--local` flag but the config uses `mode: "sandbox" | "local"` - the `cliArgsToConfig()` function handles this conversion
- Environment variable parsing requires type-specific handling: strings pass through, numbers need `parseInt`, booleans need string comparison (`"true"`, `"1"`), and enums need validation
- Used `configSchema.safeParse()` for final validation to avoid throwing on invalid merged configs - instead logs warnings and falls back to defaults
- The `CliArgs` interface maps directly to Commander.js options, making integration straightforward in the next task
- Re-exported `Config` type from `index.ts` for convenience - users can import both `getConfig` and `Config` from the same module
- Test pattern: mock `fs.access` to throw ENOENT to simulate "file doesn't exist" scenario for `createDefaultConfig`
- The env var mappings are centralized in `ENV_VAR_MAPPINGS` constant for easy maintenance and documentation

## cli-config-flag

- Commander.js provides `.hook('preAction', ...)` to run async code before any command action - perfect for initializing config singleton early
- Global options must be added to the main program (not subcommands) with `.option()` before any `.command()` definitions
- The `--config` flag becomes available as `thisCommand.opts().config` in the preAction hook, where `thisCommand` is the root Command instance
- In the hook, only pass `{ config: opts.config }` to `initializeConfig()` - CLI args for other options will be handled in a later task (cli-use-config)
- Help text best practices: Add a "Configuration:" section explaining priority order (CLI > env vars > config file) with examples
- For integration tests that need file system, use `fs.mkdtemp()` to create unique temp directories and clean up in `afterEach`
- Test both "happy path" (valid config file) and error cases (non-existent file, invalid JSON) to ensure graceful handling
- The config singleton's `initializeConfig()` is async because it may need to create the default config file on first run

## cli-use-config

- The preAction hook now gathers ALL CLI options and passes them to `initializeConfig()`, not just `--config`
- Changed `runInteractiveMode(options)` to `runInteractiveMode()` (no params) - it now uses `getConfig()` internally instead of receiving options
- When refactoring from `options.local` (boolean flag) to `config.mode`, use `config.mode === "local"` instead of `config.local` since the config schema uses an enum
- Removed default values from Commander options (like `process.env.PHOENIX_BASE_URL || "http://localhost:6006"`) - the config singleton now provides all defaults
- For the `--stream` option, keep the custom parser function `(v) => (["f", "false"].includes(v.toLowerCase()) ? false : true)` to handle user input, but remove the default value
- The snapshot command's action handler no longer uses `options` parameter - it calls `getConfig()` directly since all values come from config
- Test patterns for cli-use-config: integration tests using `tsx` to run the actual CLI with config files are more reliable than unit tests with mocked modules
- Environment variable tests can pass env vars inline with the command: `PHOENIX_BASE_URL="..." tsx ${cliPath} ...`

## cli-snapshot-use-config

- The snapshot command was defining its own options (`--base-url`, `--api-key`, `--refresh`, `--trace`) which duplicated the global options on the root program
- Removed these redundant options from the snapshot subcommand - it now relies entirely on `getConfig()` for all configuration values
- The global `preAction` hook captures CLI args and passes them to `initializeConfig()`, so subcommands don't need their own option definitions
- Updated `test/cli.test.ts` to reflect the new snapshot help output (no longer shows the removed options)
- Created `test/cli-snapshot-use-config.test.ts` with tests verifying:
  - Snapshot help no longer shows `--base-url`, `--api-key`, `--refresh`, `--trace`
  - Global options are still available on the main help
  - Config file, CLI args, and env vars all work correctly with the snapshot command
- This change simplifies the CLI by having a single source of truth for config values (the config singleton)

## readme-config-docs

- Documentation-only tasks don't require new tests, but should still run `pnpm test` to verify nothing is broken
- The README Configuration section was restructured to clearly explain the priority order (CLI > env vars > config file) at the very top before diving into details
- Added a comprehensive config file section that covers: auto-creation on first run, all three ways to specify config path (default, env var, CLI flag), and a complete example with all options
- Updated the Environment Variables table to include the config key mapping, making it easier to understand the relationship between env vars and config file options
- Added `PHOENIX_INSIGHT_LIMIT`, `PHOENIX_INSIGHT_STREAM`, `PHOENIX_INSIGHT_REFRESH`, and `PHOENIX_INSIGHT_TRACE` env vars to the table (these were documented in the code but missing from README)
- Added `--config` to the Command Line Options table - important to document this new global flag
- Fixed the `--stream` default from `false` to `true` in the CLI options table (matches the actual schema default)
- Updated the Local Mode Storage section to show `config.json` at the correct level (directly under `~/.phoenix-insight/`, not in a subdirectory)
