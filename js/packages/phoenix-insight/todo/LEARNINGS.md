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
