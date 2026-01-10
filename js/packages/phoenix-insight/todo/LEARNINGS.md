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

## local-mode

- **zod dependency**: The `ai` SDK's `tool` function requires zod for parameter validation. Had to add `zod@^4.3.5` as a direct dependency
- **bash-tool limitations**: The bash-tool package is designed specifically for just-bash sandbox mode. For local mode, we can't use it directly. Instead, created a custom tool object that mimics the bash-tool interface
- **Tool structure**: The AI SDK's tool needs specific properties: `description`, `parameters` (JSON schema format), and `execute` function. The execute function should return structured results with success/failure status
- **child_process encoding**: When using `exec` from child_process, always specify `encoding: "utf-8"` in options to get string output instead of Buffer
- **Error handling**: child_process exec errors have a `code` property (not `exitCode`). Need to handle both command failures (non-zero exit) and execution errors (command not found, etc.)
- **Directory structure**: LocalMode creates timestamped directories under `~/.phoenix-insight/snapshots/{timestamp}/phoenix`. This allows multiple snapshots without conflicts
- **Path handling**: Need to carefully handle path prefixes. Files can be written with `/phoenix/` prefix or without. LocalMode strips the prefix to maintain consistent structure
- **Bash tool caching**: The getBashTool() method should cache the tool instance since the agent might call it multiple times. Used a Promise-based cache to handle async initialization
- **Test considerations**:
  - Use absolute paths when checking file existence in tests
  - jq is available on most systems and more reliable than complex awk scripts
  - Always check both stdout and exitCode in command execution tests
- **No cleanup by default**: Following the plan, LocalMode doesn't delete snapshots on cleanup(). This preserves data for user reference. A separate cleanup command could be added later

## ESM-only

- **Package.json changes**: Added `"type": "module"` and replaced `main`/`module` fields with a single `exports` field. The bin entry needs `./` prefix for ESM packages
- **Import extensions required**: All relative imports in TypeScript must use `.js` extension, even though the source files are `.ts`. This is how TypeScript handles ESM - it doesn't rewrite import paths
- **Build simplification**: Removed the dual CommonJS/ESM build setup. Only need single tsconfig.json with ESM output. Deleted tsconfig.esm.json and simplified build script
- **tsconfig module settings**: Set `"module": "ES2022"` and `"target": "ES2022"` in tsconfig.json. Also need `"moduleResolution": "Node"` for Node.js-style resolution
- **Node.js built-ins**: Already using `node:` prefix for built-in modules (e.g., `node:fs`, `node:path`), which is best practice for ESM
- **Dynamic imports remain**: The dynamic imports in SandboxMode for just-bash and bash-tool are still needed since they're conditional/lazy loading, not because of module format
- **Test updates**: Tests needed to use `import.meta.url` instead of `__dirname`. Use `url.fileURLToPath(import.meta.url)` and `path.dirname()` to get directory path
- **Vitest already ESM**: Vitest config and tests were already using ESM syntax, so minimal changes needed there
- **Index.ts addition**: Added src/index.ts as the package entry point that re-exports from modes/index.js. This provides a clean package API
- **CLI shebang preserved**: The `#!/usr/bin/env node` shebang is preserved in the built cli.js file, ensuring the CLI works correctly when installed globally

## phoenix-client-integration

- **openapi-fetch client**: The @arizeai/phoenix-client uses openapi-fetch under the hood, which has a different API than typical REST clients. It returns raw fetch clients with strongly typed paths
- **Error handling middleware**: The phoenix-client already includes middleware that throws on non-OK responses with a specific error format: "URL: STATUS STATUS_TEXT"
- **Headers structure**: API key should be passed as `api_key` header (not Authorization Bearer). The client accepts headers in the options object
- **TypeScript strictness**: When parsing error messages, be careful about undefined values. TypeScript's strict mode will catch potential undefined accesses
- **Error categorization**: Created 4 error codes: NETWORK_ERROR (connection issues), AUTH_ERROR (401/403), INVALID_RESPONSE (4xx), and UNKNOWN_ERROR (everything else)
- **Test mocking**: Mock the entire @arizeai/phoenix-client module using vitest's vi.mock(). The createClient function is the main export to mock
- **extractData helper**: Created a utility to safely extract data from API responses and throw appropriate errors for missing data. This centralizes response validation
- **Error preservation**: The PhoenixClientError class preserves the original error as a property, which is helpful for debugging and logging

## snapshot-projects

- **Phoenix client API pattern**: The client uses openapi-fetch pattern, so API calls are like `client.GET("/v1/projects")` not `client.projects.list()`. Always check the generated API paths
- **Response data structure**: The projects endpoint returns data wrapped in `{ data: projects[], next_cursor: string | null }`, not just the projects array directly
- **JSONL format**: When converting arrays to JSONL, use `items.map(JSON.stringify).join("\n")`. Empty arrays should produce empty string, not a line with just `[]`
- **Directory creation in ExecutionMode**: Since ExecutionMode only has writeFile, create directories by writing placeholder files like `.gitkeep`. The execution modes handle creating parent directories automatically
- **Project name handling**: Project names can contain spaces and special characters. The filesystem paths use these names directly - no need to sanitize unless the execution mode requires it
- **Test organization**: Created comprehensive tests covering happy path, empty data, error cases, and edge cases with special characters. Mock both the client and execution mode for full control
- **Error handling flow**: Use the withErrorHandling wrapper from client.ts to properly categorize errors. This ensures consistent error messages and types across all snapshot modules
- **TypeScript module imports**: When importing types from other packages, use `import type` to avoid runtime dependencies. Regular imports are only needed for runtime values

## snapshot-spans

- **Phoenix client spans API**: The spans endpoint is at `/v1/projects/{project_identifier}/spans` and accepts query parameters for pagination (cursor, limit) and time filtering (start_time, end_time)
- **Response structure**: Like projects, spans are wrapped in `{ data: spans[], next_cursor: string | null }`. The data array contains span objects with detailed tracing information
- **Pagination strategy**: Implemented pagination with a while loop instead of do-while to avoid TypeScript circular reference errors. Fetch spans in chunks of 100 until reaching the per-project limit
- **Time filtering**: Support both Date objects and ISO 8601 strings for start_time/end_time. Convert Date objects to ISO strings when passing to the API
- **Query parameter building**: Build query object separately before passing to client.GET() to avoid complex spread operations that can cause TypeScript inference issues
- **Reading projects from snapshot**: Use `mode.exec("cat /phoenix/projects/index.jsonl")` to read project names from the existing snapshot. Parse each line as JSON to extract project names
- **Empty data handling**: Empty projects list (empty stdout) should exit early. Projects with no spans should write empty JSONL file and metadata with spanCount: 0
- **Metadata files**: Write a metadata.json file alongside spans data containing: project name, span count, time filters used, and snapshot timestamp. This helps users understand what data was captured
- **Test mocking pattern**: Create a helper function `createMockClient()` that returns mock responses in sequence. This makes tests cleaner and easier to understand than inline mocking
- **Error message expectations**: The withErrorHandling wrapper prepends "Unexpected error during" to unknown errors, so test expectations need to match this format

## snapshot-datasets

- **Phoenix datasets API structure**: The datasets endpoint is at `/v1/datasets` with pagination, and examples are fetched separately at `/v1/datasets/{id}/examples`. Both use the standard Phoenix response wrapper pattern
- **Dataset examples response**: Unlike other endpoints, the examples endpoint returns `{ data: { dataset_id, version_id, filtered_splits?, examples[] } }` with an extra nesting level
- **Pagination limit adjustment**: When implementing pagination with a user-specified limit, calculate remaining items needed: `Math.min(limit - datasets.length, 100)` to avoid over-fetching
- **Empty JSONL handling**: For empty arrays, return empty string ("") not "[]". Use conditional: `items.length === 0 ? "" : items.map(JSON.stringify).join("\n")`
- **Multiple metadata files**: For each dataset, write three files: metadata.json (dataset info + timestamp), examples.jsonl (the actual data), and info.json (counts and version info)
- **Test file corruption recovery**: If test files get corrupted during editing (duplicate code blocks, syntax errors), it's often easier to rewrite the entire file than to fix incrementally
- **Mock error handling tests**: When testing error scenarios, use `mockClient.GET.mockRejectedValue()` not `mockRejectedValueOnce()` if you're testing the same error multiple times
- **Dataset names with special characters**: Dataset names can contain spaces, slashes, and other special characters. The execution modes should handle creating these directory paths correctly
- **Phoenix client error patterns**: Error messages from the Phoenix client follow the pattern "URL: STATUS STATUS_TEXT" (e.g., "localhost:6006: 401 Unauthorized")
- **Test assertion specificity**: When checking pagination calls, be specific about expected parameters including adjusted limits based on already fetched items

## snapshot-experiments

- **Phoenix experiments API structure**: Experiments are not fetched globally but per-dataset at `/v1/datasets/{dataset_id}/experiments`. This means we need to fetch all datasets first, then iterate through them to get experiments
- **Experiment runs API**: Runs are fetched at `/v1/experiments/{experiment_id}/runs` with pagination support. The response includes detailed execution results for each run
- **TypeScript module resolution**: When importing from phoenix-client submodules like `@arizeai/phoenix-client/experiments`, TypeScript complains about module resolution. The package exports are configured but TypeScript's Node resolution mode doesn't support them. Used direct client.GET calls instead
- **API response typing**: Defined minimal interfaces for API responses (Experiment, ExperimentRun) to avoid importing complex types from phoenix-client. This keeps the implementation self-contained
- **Dataset name enrichment**: Since experiments don't include the dataset name in the API response, we enrich each experiment object with `datasetName` during fetching for better context in the snapshot
- **Error handling strategy**: When fetching experiments for multiple datasets, catch and log errors per dataset rather than failing the entire operation. This ensures partial data can still be captured
- **Multiple file outputs per experiment**: For each experiment, create three files: metadata.json (full details), runs.jsonl (execution data), and summary.json (quick stats). This provides different levels of detail for different use cases
- **Console.warn for errors**: Used console.warn instead of throwing when individual dataset/experiment fetching fails. This shows up in test output but allows the operation to continue
- **Pagination for both experiments and runs**: Both the experiments list and runs list support pagination. Handle cursor-based pagination with while loops, checking for null cursor to end iteration
- **Test warning suppression**: The vitest test runner shows console.warn output which is expected behavior. The tests still pass - these warnings are part of the error handling strategy

## snapshot-prompts

- **Phoenix prompts API typing**: The actual API response types differ significantly from what's documented in the phoenix-client types. Rather than fighting TypeScript, used `any` type for API responses and focused on runtime behavior
- **Prompt template formats**: Prompts can have either STRING or CHAT template formats. STRING templates can be plain strings or wrapped in objects with `{ type: "string", template: "..." }`. Chat templates have a messages array
- **Markdown conversion strategy**: Converting prompt versions to markdown provides better readability than JSON. Used YAML frontmatter for metadata, then template content formatted appropriately for its type
- **Filename sanitization**: Prompt names and version IDs can contain special characters (slashes, spaces, etc.). Used `.replace(/[^a-zA-Z0-9-_]/g, "_")` to create safe filesystem paths
- **Latest version endpoint**: The `/v1/prompts/{id}/latest` endpoint provides convenience access to the most recent version. Handle 404 errors gracefully as some prompts may not have versions
- **Chat message complexity**: Chat template messages can have string content or multi-part content (text + images, tool calls, etc.). Handle both cases when converting to markdown
- **Multiple markdown sections**: For each version, include template content, invocation parameters, tools (if present), and response format (if present). This captures all configuration aspects
- **Test data structure**: When mocking prompt versions, be careful with the template field structure. It varies based on template_format and the actual Phoenix implementation
- **Console.warn for missing latest**: Used console.warn when latest version fetch fails, similar to the experiments pattern. This is expected behavior for some prompts
- **JSONL consistency**: Maintained the same JSONL conversion pattern as other snapshot modules: empty arrays produce empty string, use newline separation without trailing newline
## snapshot-context

- **ExecutionMode usage**: The context generator needs to read data from the snapshot filesystem using mode.exec() with bash commands like cat, wc -l. This is because we only have access to the ExecutionMode interface, not direct file reading
- **JSONL parsing**: When reading JSONL files, split by newlines and parse each line separately. Always filter out empty lines to avoid JSON parse errors
- **Experiment status determination**: Determining experiment status requires checking both completion percentage and failure ratio. Failed experiments (more failures than successes) should be identified separately from in-progress ones
- **Summary formatting**: When showing counts like "3 experiments: 1 completed, 1 in progress, 1 failed", only include non-zero counts. If all experiments are completed, just show "3 experiments: 3 completed"
- **Recent activity detection**: Use a time window (e.g., 24 hours) to identify recent updates. The isRecent helper function calculates time differences in milliseconds
- **Relative time formatting**: Format timestamps as human-readable relative times like "2 hours ago" or "just now". Handle edge cases for very recent times (< 1 minute)
- **Error resilience**: Wrap all exec calls and JSON parsing in try-catch blocks. Continue processing even if individual operations fail to ensure partial context can still be generated
- **Mock testing patterns**: When testing context generation, mock the ExecutionMode exec method to return different outputs based on the command. This allows testing various snapshot states
- **Test organization**: Separate tests for different aspects: basic generation, empty snapshots, recent activity, time formatting, status determination, and error handling
- **TypeScript any type**: Used any type for parsed JSON from JSONL files since the data structures come from external APIs and vary. Focus on runtime safety with try-catch blocks

## snapshot-orchestrator

- **API key header format**: The Phoenix client expects the API key to be passed as "api_key" header, not "Authorization Bearer". This differs from typical REST APIs
- **ExecutionMode file paths**: When using mode.writeFile(), paths should start with "/" to be relative to the Phoenix root directory (e.g., "/_meta/snapshot.json")
- **Parallel fetching strategy**: Datasets, experiments, and prompts can be fetched in parallel using Promise.all() since they don't depend on each other. This improves performance
- **Cursor tracking design**: While the plan mentions cursor tracking for incremental updates, the current span fetcher doesn't return cursors. Added TODO comment and empty cursor objects as placeholders
- **Metadata file location**: The _meta/snapshot.json file stores snapshot metadata in a dedicated directory to avoid conflicts with data directories
- **Error propagation**: Let errors bubble up from individual fetchers rather than catching them locally. This ensures the CLI can handle errors appropriately (retry, user notification, etc.)
- **Progress logging**: Conditional progress logging using a showProgress flag provides flexibility for both interactive and programmatic usage
- **Incremental snapshot fallback**: When no existing metadata is found, createIncrementalSnapshot falls back to creating a full snapshot. This simplifies the CLI logic
- **Test mocking pattern**: Mock all individual snapshot modules to test the orchestration logic in isolation. This avoids complex setup and focuses on coordination behavior
- **Time filtering**: Pass startTime/endTime options through to the spans fetcher to support time-based queries. Other fetchers don't currently support time filtering
