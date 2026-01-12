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
