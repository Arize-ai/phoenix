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
