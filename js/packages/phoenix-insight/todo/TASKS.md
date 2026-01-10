# Phoenix Insight CLI Tasks

Task tracker for Ralph-style agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat(phoenix-insight): <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Package Setup

### scaffold-package

- content: Create js/packages/phoenix-insight: package.json with deps, tsconfig, bin entry, README
- status: complete
- dependencies: none

### scaffold-structure

- content: Create src/ directory structure: cli.ts, modes/, snapshot/, commands/, agent/, prompts/
- status: complete
- dependencies: scaffold-package

---

## Phase 2: Execution Modes

### execution-mode-interface

- content: Define ExecutionMode interface: writeFile, exec, getBashTool, cleanup methods
- status: complete
- dependencies: scaffold-structure

### sandbox-mode

- content: Implement SandboxMode using just-bash with InMemoryFs, integrate bash-tool
- status: complete
- dependencies: execution-mode-interface

### local-mode

- content: Implement LocalMode with ~/.phoenix-insight/ directory and child_process bash
- status: complete
- dependencies: execution-mode-interface

### ESM-only

- content: Convert phoenix-insight to ESM-only module, remove CommonJS compatibility
- status: complete
- dependencies: sandbox-mode, local-mode

---

## Phase 3: Data Ingestion

### phoenix-client-integration

- content: Create snapshot/client.ts: wrapper around @arizeai/phoenix-client with error handling
- status: complete
- dependencies: scaffold-structure

### snapshot-projects

- content: Implement snapshot/projects.ts: fetch projects list, write to /projects/index.jsonl
- status: complete
- dependencies: phoenix-client-integration

### snapshot-spans

- content: Implement snapshot/spans.ts: fetch spans with time filtering, pagination, limits
- status: complete
- dependencies: snapshot-projects

### snapshot-datasets

- content: Implement snapshot/datasets.ts: fetch datasets and examples
- status: complete
- dependencies: phoenix-client-integration

### snapshot-experiments

- content: Implement snapshot/experiments.ts: fetch experiments and runs
- status: complete
- dependencies: phoenix-client-integration

### snapshot-prompts

- content: Implement snapshot/prompts.ts: fetch prompts and versions as markdown
- status: complete
- dependencies: phoenix-client-integration

### snapshot-context

- content: Implement snapshot/context.ts: generate \_context.md summary file
- status: complete
- dependencies: snapshot-projects, snapshot-spans, snapshot-datasets, snapshot-experiments, snapshot-prompts

### snapshot-orchestrator

- content: Implement snapshot/index.ts: orchestrate all fetchers, write \_meta/snapshot.json
- status: complete
- dependencies: snapshot-context

---

## Phase 4: Incremental Updates

### snapshot-incremental

- content: Add incremental logic: compare timestamps, fetch only new/updated data
- status: complete
- dependencies: snapshot-orchestrator, local-mode

---

## Phase 5: Custom Commands

### px-fetch-more-spans

- content: Implement px-fetch-more spans command: fetch additional spans on-demand
- status: complete
- dependencies: snapshot-spans

### px-fetch-more-trace

- content: Implement px-fetch-more trace command: fetch specific trace by ID
- status: complete
- dependencies: snapshot-spans

---

## Phase 6: Agent Setup

### system-prompt

- content: Create prompts/system.ts: INSIGHT_SYSTEM_PROMPT with \_context.md instructions
- status: complete
- dependencies: scaffold-structure

### agent-setup

- content: Implement agent/index.ts: ToolLoopAgent with bash tool and custom commands
- status: complete
- dependencies: sandbox-mode, local-mode, system-prompt, px-fetch-more-spans, px-fetch-more-trace

### agent-visibility

- content: Add brief progress message to the cli output as the agent takes actions.
- status: complete
- dependencies: agent-setup

### agent-observability

- content: Add observability to the agent. Use the @arizeai/phoenix-otel package. Optionally enable tracing of the agent with --trace flag.
- status: complete
- dependencies: agent-setup, cli-flags

---

## Phase 7: CLI Interface

### cli-single-query

- content: Implement CLI single-query mode: phoenix-insight 'query' with --sandbox/--local
- status: complete
- dependencies: agent-setup, snapshot-orchestrator

### cli-flags

- content: Add CLI flags: --base-url, --api-key, --refresh, --limit, --stream
- status: complete
- dependencies: cli-single-query

### cli-interactive

- content: Implement interactive mode: REPL for multiple queries in one session
- status: complete
- dependencies: cli-flags

---

## Phase 8: Polish

### error-handling

- content: Add comprehensive error handling: network errors, auth failures, invalid responses
- status: complete
- dependencies: cli-flags

### progress-indicators

- content: Add progress indicators for snapshot fetching and agent thinking
- status: complete
- dependencies: cli-flags

### documentation

- content: Write README.md with usage examples, configuration, and troubleshooting
- status: complete
- dependencies: cli-interactive

### Agent Improved Visibility

- content: Progress is reported by the agent as "Tool bash completed" etc. Enhance this to show the actual command being executed.
- status: complete
- dependencies: agent-setup

## Phase 9: Bug Fixes

### agent-tools

- content: Fix agent tools. Remove usage of the `any` type. Read the AI SDk documentation for the correct types. The following error is currently being thrown:

```
pnpm dev "show me error patterns in the playground"

> @arizeai/phoenix-insight@0.0.1 dev /Users/tony/repos/phoenix/js/packages/phoenix-insight
> tsx src/cli.ts 'show me error patterns in the playground'

✔ ✅ Snapshot created successfully!
⠹ 🤔 Analyzing...
❌ Error executing query:

AI generation failed: tools.0.custom.input_schema.type: Field required

💡 Tips:
   • Run with DEBUG=1 for more detailed error information
   • Check your Phoenix connection with: phoenix-insight snapshot --base-url <url>
   • Use --help to see all available options
 ELIFECYCLE  Command failed with exit code 1
```

- status: complete
- dependencies: agent-setup

### tests

- content: Tests got broken by some commit. Fix them all.
- status: complete
- dependencies: documentation

---

## Phase 10: Documentation Audit

### cli-flags-documentation

- content: Audit README.md to ensure ALL CLI flags from src/cli.ts are documented. Compare the commander definitions in cli.ts with the README CLI reference section. Add any missing flags with descriptions and examples.
- status: complete
- dependencies: documentation, cli-flags

## Phase 11: Self-improvement

Because phoenix-insight can ingest data from Phoenix, and it can trace its own execution back to Phoenix, it can be used to improve itself.

### self-improvement

- content: Use `pnpm dev "read the latest trace from 'phoenix-insight' project and analyze the bottlenecks to performance"` and then use the results to edit the code and improve the performance of the agent.
- status: complete
- dependencies: agent-setup, cli-flags, snapshot-orchestrator, agent-observability
