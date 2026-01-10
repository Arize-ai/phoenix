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

## execution-mode-interface

- **TypeScript interface design**: Created a simple interface with 4 methods as specified in the plan. Used TypeScript doc comments to document each method's purpose and parameters
- **Tool type from AI SDK**: Since we don't have the AI SDK installed yet, I used `any` type for the `getBashTool()` return type. Future agents implementing concrete modes should import the proper Tool type from the AI SDK
- **Test strategy**: For interface testing, created mock implementations using vitest's `vi.fn()` to verify the interface shape and method signatures. This ensures any concrete implementation will have the correct structure
- **Index exports**: Created an index.ts file in the modes directory to re-export types. This follows TypeScript best practices and makes imports cleaner for consumers
- **Pre-commit hooks**: The project has prettier configured as a pre-commit hook, which automatically formats code on commit. No manual formatting needed

## sandbox-mode

- **ESM module imports**: just-bash and bash-tool are ESM-only modules. Since our package is CommonJS (no "type": "module" in package.json), we must use dynamic imports: `await import('just-bash')` instead of static imports
- **createBashTool API**: The createBashTool function accepts a `sandbox` option (not `bash` as I initially tried). It returns a Promise that resolves to a BashToolkit object with properties: `bash`, `tools`, and `sandbox`
- **Async initialization pattern**: Since we need dynamic imports, I implemented a lazy initialization pattern with an `init()` method that's called on first use. This avoids constructor async issues
- **getBashTool return type**: The ExecutionMode interface needed to be updated to return `Promise<any>` instead of `any` since createBashTool is async
- **just-bash filesystem**: Use `bash.fs.writeFileSync()` directly for better performance than executing echo commands. The filesystem is available as a property on the Bash instance
- **Testing challenges**:
  - wc -l counts newlines, so strings must end with \n to get expected line counts
  - awk in just-bash might have limitations, so using jq for JSON processing is more reliable (e.g., `jq -s 'map(.latency) | add'` instead of piping to awk)
- **@vercel/sandbox optional dependency**: bash-tool has an optional dependency on @vercel/sandbox that causes TypeScript errors when not installed. These can be safely ignored as it's only needed for Vercel's sandbox, not just-bash
