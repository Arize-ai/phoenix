# Phoenix Insight CLI - Learnings Log

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

## scaffold-package

- **Dependency versions**: Several packages from the PROMPT.md had outdated versions. Updated to: ai@^6.0.0, @ai-sdk/anthropic@^3.0.0, just-bash@^2.2.0, bash-tool@^1.3.0, tsx@^4.21.0
- **JSON imports in TypeScript**: Importing package.json directly causes TypeScript errors. Instead, hardcoded version in cli.ts as const. Future agents should consider a build step to inject version from package.json
- **Project structure**: The task instructions put everything in a todo/ subdirectory, but the actual package needs to be at js/packages/phoenix-insight/ level. Navigate carefully between these locations
- **Test execution**: Use `pnpm test --run` to run tests once without watch mode, as the default watch mode can timeout in CI environments
- **Phoenix-cli reference**: The existing phoenix-cli package provides excellent patterns for package.json structure, tsconfig setup, and build scripts. Follow its conventions for consistency
