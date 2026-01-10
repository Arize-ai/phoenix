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

## scaffold-structure

- **Directory confusion**: Be careful about working directory when running commands. I accidentally created directories in todo/src instead of the package's src/ directory at first
- **Git file recovery**: When files go missing during directory operations, use `git show <commit>:<path> > <filename>` to restore them from previous commits
- **Test path resolution**: When writing tests that check file existence, use absolute paths via `path.join(__dirname, "..", "src")` to ensure tests work regardless of where they're run from
- **Vitest console output**: Debug logs in tests (console.log) are shown in the test output, which is helpful for diagnosing path issues
- **Git status awareness**: Always check `pwd` and `git status` to ensure you're in the right directory before making changes, especially when working with nested directory structures
