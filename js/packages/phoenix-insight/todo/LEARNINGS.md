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

## delete-scaffold-structure-test

- Deleted `test/scaffold-structure.test.ts` which only tested file/directory existence using `fs.existsSync`
- Tests that verify filesystem structure are redundant when build/typecheck already validates the structure
- The test was checking for 10 items in src/ (cli.ts, index.ts, progress.ts + 7 subdirectories) - this is brittle as it breaks when files are added/removed
- Build and type checking already provide better guarantees about file existence than runtime fs.existsSync tests
- Pattern: Tests should verify behavior, not structure. Let the compiler validate structure.

## delete-skipped-cli-tests

- Deleted three skipped test files that spawned real CLI processes: `cli-prune.test.ts`, `cli-flags.test.ts`, `cli-help.test.ts`
- All three used `describe.skip()` so they weren't running, but they would be dangerous if unskipped because:
  - `cli-prune.test.ts`: Created real temp directories, manipulated HOME environment, tested actual file deletion
  - `cli-flags.test.ts`: Used `spawn()` to run real CLI, could make network calls
  - `cli-help.test.ts`: Used `spawn()` with stdin/stdout interaction for interactive mode testing
- Pattern: Skipped tests are technical debt - they either need to be fixed or deleted. Skipped tests that spawn real processes are especially dangerous because someone might unskip them thinking they're harmless.
- Note: There's already a `cli-flags-unit.test.ts` that tests flag parsing logic through exported functions without spawning processes - this is the correct pattern.

## refactor-cli-test

- Deleted `test/cli.test.ts` entirely rather than refactoring because:
  - The CLI entry point (`src/cli.ts`) doesn't expose testable functions - it's just a Commander setup that calls `program.parse()`
  - All 7 tests spawned real processes using `exec`/`execAsync`, which is the anti-pattern we're eliminating
  - The tests were slow (3.9 seconds for 7 tests vs milliseconds for unit tests)
- What the deleted tests covered was either trivial or already covered elsewhere:
  - Version display: Trivial (hard-coded constant `VERSION = "0.0.1"`)
  - Help text: Trivial (Commander generates it automatically)
  - Flag acceptance (`--sandbox`, `--limit`, `--base-url`): Already covered in `cli-flags-unit.test.ts`
  - Mode selection logic: Already covered in `default-mode.test.ts`
  - Interactive mode banner: Testing console.log output from a spawned process isn't meaningful behavior testing
- Pattern: CLI entry points that just wire together Commander are hard to unit test. The better approach is to test the underlying functions (mode creation, config loading, etc.) in isolation, which `cli-flags-unit.test.ts` and `default-mode.test.ts` already do.
- Remaining process-spawning CLI tests to refactor: `cli-use-config.test.ts`, `cli-config-flag.test.ts`, `cli-snapshot-use-config.test.ts` - these are more justifiable because they test config loading integration, but they should still be refactored to use mocked fs instead of real temp directories.

## refactor-cli-use-config-test

- Completely rewrote `test/cli-use-config.test.ts` from process-spawning tests to unit tests using mocked filesystem
- Original: 16 tests that spawned real CLI processes with `execAsync` and created real temp directories with `fs.mkdtemp`
- Refactored: 29 tests that mock `node:fs/promises` and test `initializeConfig()` directly
- Key insight: The config module exports `initializeConfig()`, `resetConfig()`, and types that allow complete testing of config loading logic without any real I/O
- Pattern for mocking fs: Use `vi.mock("node:fs/promises")` at top level, then `vi.mocked(fs.readFile)` etc. to access mock functions
- The `mockConfigFile()` helper function simulates different config file states (valid JSON, file not found, etc.)
- Added new test categories not in the original:
  - CLI args override environment variables (priority testing)
  - Full priority chain test (config < env < CLI)
  - Invalid config handling (bad JSON, invalid values)
- Important: Always call `resetConfig()` in beforeEach/afterEach to reset the singleton state between tests
- The test file went from 239 lines + real I/O to 324 lines of pure unit tests - more comprehensive with zero disk/process usage
- Test speed: Original tests spawned tsx processes (slow). New tests run in ~10ms for all 29 tests

## refactor-cli-config-flag-test

- Deleted `test/cli-config-flag.test.ts` entirely rather than refactoring because the meaningful config flag logic was already covered by `cli-use-config.test.ts`
- Original file: 149 lines with 10 tests that spawned real CLI processes with `execAsync` and created real temp directories
- What was being tested:
  - Help text content (`--config option in help`, `example with --config`, `config priority documentation`) - trivial, just testing Commander-generated output
  - Flag acceptance (`--config flag without error`, before/after other options, with subcommands) - trivial, testing Commander's flag parsing behavior
  - Error handling (non-existent config file, invalid JSON) - **already covered** by `cli-use-config.test.ts`
- Key insight: When evaluating whether to refactor or delete, check what the existing unit tests already cover. `cli-use-config.test.ts` tests:
  - Custom config file path via `initializeConfig({ config: "/custom/path" })`
  - File not found behavior via `mockConfigFile(null)`
  - Invalid JSON behavior via mock rejection with SyntaxError
  - Config priority chain (config < env < CLI)
- Pattern: Tests that verify help text output or Commander's flag parsing are not valuable unit tests. The framework handles this automatically, and if it breaks, the issue is obvious at runtime. Focus tests on business logic, not framework behavior.
- Result: Deleted 149 lines of process-spawning tests with no loss of meaningful test coverage
