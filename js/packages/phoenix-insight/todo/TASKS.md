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
7. Commit with message: `refactor(phoenix-insight): <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Delete Ineffective and Skipped Tests

These tests provide no value - they either check file existence, match documentation text, or are already skipped.

### delete-scaffold-structure-test

- content: Delete `test/scaffold-structure.test.ts` - it only checks source file existence using `fs.existsSync`, which is not meaningful unit testing (build/typecheck already validates structure)
- status: complete
- dependencies: none

### delete-skipped-cli-tests

- content: Delete the three skipped test files that spawn real processes: `test/cli-prune.test.ts`, `test/cli-flags.test.ts`, `test/cli-help.test.ts` - they are not running and would be dangerous if unskipped
- status: complete
- dependencies: none

---

## Phase 2: Refactor CLI Tests (Process Execution)

These tests use `execAsync` to spawn real CLI processes, which is dangerous (leaky network, real I/O). Refactor to test exported functions directly, or delete if logic is not easily testable.

### refactor-cli-test

- content: Refactor `test/cli.test.ts` to test CLI logic via exported functions (command parsing, option handling) instead of spawning real processes with `execAsync`. If the CLI entry point doesn't expose testable units, delete the tests that require process execution.
- status: complete
- dependencies: delete-scaffold-structure-test, delete-skipped-cli-tests

### refactor-cli-use-config-test

- content: Refactor `test/cli-use-config.test.ts` to use mocked filesystem instead of creating real temp directories and files. Test config loading logic through exported functions with `vi.mock("node:fs/promises")` instead of spawning real CLI processes.
- status: complete
- dependencies: refactor-cli-test

### refactor-cli-config-flag-test

- content: Refactor `test/cli-config-flag.test.ts` to use mocked filesystem and test flag parsing logic directly instead of spawning real CLI processes. Delete if config flag logic is already covered by other tests.
- status: complete
- dependencies: refactor-cli-use-config-test

### refactor-cli-snapshot-use-config-test

- content: Refactor `test/cli-snapshot-use-config.test.ts` to use mocked filesystem and test snapshot config integration through exported functions instead of spawning real CLI processes.
- status: complete
- dependencies: refactor-cli-config-flag-test

---

## Phase 3: Refactor Filesystem Tests

These tests write to real filesystem locations (temp dirs, `~/.phoenix-insight/`). Refactor to use mocked `fs` module.

### refactor-local-mode-test

- content: Refactor `test/local-mode.test.ts` to use `vi.mock("node:fs/promises")` instead of writing to real directories in `~/.phoenix-insight/snapshots/`. Mock all fs operations to prevent any real disk I/O.
- status: pending
- dependencies: refactor-cli-snapshot-use-config-test

### refactor-snapshot-incremental-local-test

- content: Refactor `test/snapshot-incremental-local.test.ts` to use mocked filesystem instead of creating real directories in `os.tmpdir()`. The LocalMode integration should be tested with mocked fs operations.
- status: pending
- dependencies: refactor-local-mode-test

### refactor-agent-tools-test

- content: Refactor `test/agent/tools.test.ts` to remove the temp directory creation in `os.tmpdir()` (lines 53-59). Use mocked filesystem for any tests that need directory structure.
- status: pending
- dependencies: refactor-snapshot-incremental-local-test

---

## Phase 4: Final Verification

### verify-all-tests-pass

- content: Run `pnpm test` and verify all tests pass. Run `pnpm typecheck` to ensure no type errors. Document any tests that were deleted vs refactored in LEARNINGS.md summary.
- status: pending
- dependencies: refactor-agent-tools-test
