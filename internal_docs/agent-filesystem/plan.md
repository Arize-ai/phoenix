# Agent Filesystem and Bash Plan

## Goal

- Add a hybrid tools architecture where Phoenix can expose tools to the LLM while executing some on the client and some on the server.
- Start with a client-executed `bash` tool using `bash-tool`/`just-bash`.
- Materialize Phoenix context into a predictable virtual filesystem so the agent can use `ls`, `find`, `grep`, `cat`, and `jq` instead of bespoke retrieval tools.

## Key Decisions

- Use `bash-tool` on the client.
- Execute `bash` on the client through AI SDK `onToolCall` + `addToolOutput`.
- Keep the backend as the model + streaming authority; it forwards tool definitions and tool calls.
- Default context injection strategy: page-context adapter with lazy tables.
- Adapters are not user-selectable in v1; they are a developer-facing experimentation mechanism.
- Overwrite injected context in place on refresh.
- Use `jsonl` for large tables and `json` for summaries.
- Always emit `INDEX.json` and `tables/_schema.json`.
- Default project-level exports to the current UI time range.
- Allow alternate requested time ranges under a separate top-level directory.
- Make `/phoenix/**` read-only and `/home/user/workspace/**` writable.
- Disable network by default.
- Show tool execution in a toggleable panel.
- Support refresh via auto-refresh on navigation/time-range changes and a literal `/refresh` chat command.
- Surface the active bash sandbox capabilities to the model so it does not attempt unavailable package managers, network installs, or host-level system mutations.
- Generate a short session summary from the first user message and use it anywhere the UI lists sessions.
- Treat agent sessions as first-class UI objects with summary/date metadata, switching, and deletion controls.

## Architecture

### Tool Execution Model

- The backend continues to own `/chat` request handling, model invocation, and UI message streaming.
- Tool schemas are included in chat requests.
- Tool calls stream back to the client.
- Client-executed tools are handled in the browser.
- Future server-executed tools can use the same schema and stream protocol.

### Client Bash Runtime

- Create a per-agent-session browser-side `just-bash` runtime so virtual filesystem state persists across turns.
- Use `bash-tool` as the wrapper around a browser-executed `just-bash` instance, not a remote VM sandbox.
- Execute tool calls through AI SDK client hooks:
  - define `bash` as a client tool
  - handle calls in `onToolCall`
  - return results with `addToolOutput`
  - continue automatically with `lastAssistantMessageIsCompleteWithToolCalls`
- Expose runtime capability metadata to the LLM on every turn, either through the tool description, the system prompt, or both.
- The capability description must explicitly call out browser-only execution, writable paths, disabled network, and unsupported package-management assumptions.

### Filesystem Contract

- `/phoenix/**`: injected Phoenix context, read-only
- `/home/user/workspace/**`: writable scratch space for the agent
- `/phoenix/MANIFEST.md`: human/agent discoverability
- `/phoenix/_meta/context.json`: machine-readable context metadata

## Context Injection Strategy

### Design Principle

Adapters should map Phoenix domain data into files, not expose custom retrieval APIs. The agent should solve tasks by exploring the filesystem with Unix primitives.

### Adapter Interface

Define a typed adapter system:

```ts
interface ContextAdapter<TConfig, TContext> {
  id: string;
  name: string;
  description: string;
  generate(config: TConfig, context: TContext): Promise<AdapterResult>;
  validate?(context: TContext): string[] | null;
}
```

Where `AdapterResult` includes:

- `files`: compatible with `just-bash` `InitialFiles`
- `metadata`: generation metadata
- `manifestFragment?`: optional manifest content

Adapters may emit eager files or lazy file providers.

### Default Adapter

- Use a page-context adapter by default.
- It derives injected context from the current route, loaded page data, and current UI time range.
- Large datasets should be lazy by default.
- Small metadata, summaries, and indexes should be eager.

### Additional Adapters

Support additional adapters behind the same interface for developer experimentation:

- GraphQL query adapter: bespoke fresh queries normalized into tables
- Relay store adapter: extract already-loaded Relay cache into the same layout

These adapters should target the same filesystem shape so they can be swapped without changing agent behavior.

## Filesystem Layout

The layout should be stable and relational-style.

```text
/phoenix/
  MANIFEST.md
  _meta/
    context.json
  projects/
    <projectId>/
      project.json
      INDEX.json
      tables/
        traces.jsonl
        spans.jsonl
        sessions.jsonl
        _schema.json
  traces/
    <traceId>/
      trace.json
      INDEX.json
      tree.json
      tables/
        spans.jsonl
        _schema.json
  datasets/
  experiments/
  prompts/
  evaluators/
  time_ranges/
    <label-or-iso>/
      ...
/home/user/workspace/
```

## Data Conventions

- Large tables: `jsonl`
- Small summaries and metadata: `json`
- Every table group should include `tables/_schema.json`
- Every entity root should include `INDEX.json`
- `MANIFEST.md` should explain what exists and suggest common shell commands

## Entity Coverage

The filesystem contract should support everything in scope for the product, even if implementation rolls out incrementally:

- projects
- traces
- spans
- sessions
- datasets
- experiments
- prompts
- evaluators
- other related entities as needed

Implementation order can be incremental, but the top-level layout should be stable from the start.

## Time Range Semantics

- By default, project-level tables should reflect the current UI time range.
- If the agent or user needs a different time range, materialize it under:

```text
/phoenix/time_ranges/<label-or-iso>/...
```

- This should not overwrite the default current-context paths.

## Refresh Behavior

### Automatic Refresh

- Rebuild injected context when route params change.
- Rebuild injected context when the UI time range changes.

### Manual Refresh

- Support a literal `/refresh` chat command.
- This forces reinjection of context into `/phoenix/**`.

### Refresh Metadata

Because refresh overwrites in place, `context.json` and `MANIFEST.md` should include:

- `generatedAt`
- refresh reason (`navigation`, `time-range-change`, `manual`)
- adapter ids/versions

## Safety Model

- Deny writes, deletes, and mutations under `/phoenix/**`.
- Allow writes under `/home/user/workspace/**`.
- Keep network disabled by default.
- Add execution limits and cancellation so commands cannot hang the UI.

## Debuggability and UX

- Render tool invocations in a toggleable panel.
- Show:
  - command
  - stdout
  - stderr
  - exit code
  - duration
- Keep the panel collapsed by default.
- Add manifest visibility so developers can inspect what the agent actually received.
- Add a session list UI that shows each session's short summary and created/updated date.
- Allow switching sessions directly from that list.
- Allow deleting sessions directly from that list.

## Session Metadata

- Generate a short session summary from the first user message when a session transitions from empty to active.
- Store the summary and session timestamps in the persisted agent store.
- Reuse that metadata for any session picker, list, or future recents UX.

## Implementation Phases

### Phase 1: Hybrid Tool Plumbing

- Add client-side tool handling in the agent chat UI.
- Send `bash` tool definitions with chat requests.
- Execute `bash` calls on the client.
- Render tool activity in the transcript/panel.

### Phase 2: Bash Runtime + Safety

- Add per-session `bash-tool` runtime.
- Enforce FS write boundaries.
- Disable network.
- Add command instrumentation and execution limits.

### Phase 3: Adapter Framework

- Define `ContextAdapter` types.
- Define adapter composition rules.
- Implement manifest/index/schema generation helpers.

### Phase 4: Page-Context Injection

- Implement page-context adapter.
- Start with core tracing paths, then expand to all top-level domains.
- Make large tables lazy.

### Phase 5: Alternate Time Ranges

- Support materializing requested alternate time ranges under `/phoenix/time_ranges/...`.

### Phase 6: Refresh Flows

- Auto-refresh on navigation/time-range changes.
- Support `/refresh` command.

### Phase 7: Polish

- Improve tool panel UX.
- Add stronger debugging signals.
- Add future hooks for server-side tools.

## Acceptance Criteria

- The agent can execute `bash` client-side and continue the conversation automatically with tool outputs.
- On a trace page, the agent can explore `/phoenix/traces/<traceId>/` and find meaningful files.
- On project pages, injected tables respect the UI time range by default.
- Alternate time ranges can be materialized without replacing the default current-context directories.
- The agent cannot mutate `/phoenix/**` but can write to `/home/user/workspace/**`.
- Tool execution is visible in a toggleable panel for debugging.
- The adapter system supports multiple injection strategies behind one filesystem contract.
