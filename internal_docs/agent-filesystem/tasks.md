# Agent Filesystem and Bash Tasks

This task list turns `internal_docs/specs/agent-filesystem-bash-plan.md` into an implementation sequence with explicit dependencies.

## Dependency Legend

- `Blocks`: this task must complete before the listed task starts
- `Depends on`: this task should not start until the listed task completes

## Milestone 0: Contracts and scaffolding

### T0.1 Define frontend tool contract for hybrid execution [done]

- Decide where tool execution location is represented in frontend code (`client` vs `server`, or equivalent local-only convention).
- Confirm the request payload sent to `/chat` can include the `bash` tool definition on every turn.
- Confirm the UI message stream can represent tool call parts the client can render and respond to.
- Deliverable: short code-level contract note or inline type updates.
- Depends on: none
- Blocks: T1.1, T1.2, T1.3

### T0.2 Create module locations and naming for bash runtime + adapters [done]

- Choose initial file/module placement for:
  - client bash runtime/provider
  - adapter types/helpers
  - page-context adapter
  - manifest/index/schema helpers
- Deliverable: agreed file layout in `app/src/...`
- Depends on: none
- Blocks: T2.1, T3.1, T4.1

## Milestone 1: End-to-end client bash tool

### T1.1 Add `bash-tool` dependency to the frontend app [done]

- Add `bash-tool` and any required peer/runtime dependencies under `app/package.json`.
- Verify the package builds in the current frontend toolchain.
- Deliverable: dependency added and install succeeds.
- Depends on: T0.1
- Blocks: T2.1

### T1.2 Update chat to send a client-side `bash` tool definition [done]

- Extend agent chat request construction so each chat turn includes the `bash` tool schema.
- Keep the schema minimal and stable for v1.
- Deliverable: network payload includes the tool definition.
- Depends on: T0.1
- Blocks: T1.3

### T1.3 Implement client-side tool execution in `Chat.tsx` [done]

- Use AI SDK client hooks:
  - `onToolCall`
  - `addToolOutput`
  - `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`
- Route `bash` tool calls to the local runtime.
- Deliverable: the agent can call `bash` and receive results in the next turn.
- Depends on: T0.1, T1.2, T2.1
- Blocks: T1.4, T7.1

### T1.4 Render tool execution in the UI [done]

- Extend chat message rendering to support tool parts.
- Add a toggleable panel for tool execution details.
- Show command, stdout, stderr, exit code, and loading/error states.
- Deliverable: tool activity is visible but collapsed by default.
- Depends on: T1.3
- Blocks: T7.1

## Milestone 2: Bash runtime and safety boundaries

### T2.1 Create a per-session bash runtime/provider [done]

- Build a client runtime around `bash-tool` / `just-bash`.
- Scope one runtime per agent session so filesystem state persists across turns.
- Expose access through a React provider or equivalent session registry.
- Deliverable: reusable runtime abstraction available to chat components.
- Depends on: T0.2, T1.1
- Blocks: T1.3, T2.2, T2.3, T2.4

### T2.2 Enforce filesystem write policy

- Make `/phoenix/**` read-only.
- Make `/home/user/workspace/**` writable.
- Deny mutation operations outside allowed paths with clear errors.
- Deliverable: policy wrapper around runtime filesystem operations.
- Depends on: T2.1
- Blocks: T7.2

### T2.3 Disable network and configure execution limits

- Ensure network access is disabled by default.
- Set command/loop/time limits to prevent runaway execution.
- Add cancellation support where the runtime allows it.
- Deliverable: safe default runtime configuration.
- Depends on: T2.1
- Blocks: T7.2

### T2.4 Add runtime instrumentation hooks

- Capture command text, duration, exit code, and output sizes.
- Feed instrumentation into the tool execution UI.
- Deliverable: structured runtime telemetry for debugging.
- Depends on: T2.1
- Blocks: T1.4, T7.1

### T2.5 Plan and implement bash session cleanup + persistence

- Define the lifecycle for browser-side bash runtimes after session deletion, session reset, and page reload.
- Decide what should remain in-memory only vs. what should be serialized and rehydrated.
- Add cleanup hooks so unused runtimes do not accumulate indefinitely.
- If persistence is desired, define and implement a filesystem snapshot/restore path keyed by agent session id.
- Deliverable: explicit lifecycle policy plus implementation for cleanup and, if approved by the chosen design, persistence/rehydration.
- Depends on: T2.1
- Blocks: T7.2, T8.1

### T2.6 Surface bash sandbox capabilities to the model

- Define the canonical capability description for the browser-side bash runtime.
- Include limits such as browser execution, disabled network, writable vs read-only paths, and unsupported host/package-manager assumptions.
- Wire that capability description into the `bash` tool definition, the system prompt, or both.
- Deliverable: the model receives accurate sandbox constraints before it plans tool usage.
- Depends on: T1.2, T2.1, T2.3
- Blocks: T7.2

## Milestone 3: Adapter framework

### T3.1 Define adapter types and result contracts

- Add TypeScript types/interfaces for:
  - `ContextAdapter<TConfig, TContext>`
  - `AdapterResult`
  - metadata structures
  - adapter composition rules
- Ensure result `files` are compatible with `just-bash` `InitialFiles`.
- Deliverable: typed adapter contract module.
- Depends on: T0.2
- Blocks: T3.2, T4.1, T5.1, T5.2

### T3.2 Build manifest/index/schema helpers

- Implement reusable helpers to generate:
  - `/phoenix/MANIFEST.md`
  - `/phoenix/_meta/context.json`
  - per-entity `INDEX.json`
  - `tables/_schema.json`
- Deliverable: utility layer used by adapters.
- Depends on: T3.1
- Blocks: T4.1, T5.1, T5.2

### T3.3 Implement adapter composition and overwrite semantics

- Support combining multiple adapters deterministically.
- Default merge rule: later adapters win.
- Match v1 refresh semantics: overwrite in place.
- Deliverable: adapter composition utility.
- Depends on: T3.1
- Blocks: T5.3, T6.2

## Milestone 4: Stable filesystem contract

### T4.1 Define the initial `/phoenix` directory skeleton

- Create a stable top-level layout for all supported domains:
  - projects
  - traces
  - spans/session-adjacent structures as needed
  - datasets
  - experiments
  - prompts
  - evaluators
  - time_ranges
- Deliverable: code-level path constants and skeleton generation helpers.
- Depends on: T0.2, T3.1, T3.2
- Blocks: T5.1, T5.2, T6.1

### T4.2 Standardize file naming and data format conventions

- Lock in `jsonl` for large tables and `json` for summaries.
- Decide naming for common files like `project.json`, `trace.json`, `tree.json`, `INDEX.json`.
- Deliverable: shared conventions used by all adapters.
- Depends on: T3.1
- Blocks: T5.1, T5.2

## Milestone 5: Context adapters

### T5.1 Implement the page-context adapter

- Use current route params and UI time range as primary inputs.
- Materialize the current page's relevant data under stable `/phoenix/...` paths.
- Use eager metadata/index files and lazy large tables.
- Deliverable: default v1 adapter.
- Depends on: T3.1, T3.2, T4.1, T4.2
- Blocks: T6.1, T6.2, T7.2

### T5.2 Implement experimental adapters behind the same contract

- Build at least:
  - GraphQL query adapter
  - Relay store adapter
- Keep output layout compatible with the page-context adapter.
- Deliverable: developer-only experimentation adapters.
- Depends on: T3.1, T3.2, T4.1, T4.2
- Blocks: T8.1

### T5.3 Add adapter selection/composition for developers

- Since adapters are not user-selectable, expose composition/configuration in code or dev flags only.
- Make page-context the default.
- Deliverable: internal mechanism to swap or combine adapters for debugging.
- Depends on: T3.3, T5.1
- Blocks: T8.1

## Milestone 6: Refresh and time-range flows

### T6.1 Auto-refresh on navigation and UI time-range changes

- Re-run default context injection when route params change.
- Re-run default context injection when UI time range changes.
- Overwrite `/phoenix/**` in place.
- Update refresh metadata (`generatedAt`, reason).
- Deliverable: automatic context freshness.
- Depends on: T4.1, T5.1
- Blocks: T7.2

### T6.2 Support literal `/refresh` chat command

- Intercept `/refresh` in the chat flow.
- Re-run injection and overwrite current context.
- Add refresh reason to metadata.
- Deliverable: manual refresh path for users/developers.
- Depends on: T3.3, T5.1
- Blocks: T7.2

### T6.3 Add alternate time-range materialization

- Allow an agent/user-requested alternate time range to be written under:
  - `/phoenix/time_ranges/<label-or-iso>/...`
- Do not overwrite the default current-context directories.
- Update manifest to advertise available alternate time ranges.
- Deliverable: side-by-side alternate time-range context.
- Depends on: T4.1, T5.1
- Blocks: T7.2, T8.1

## Milestone 6.5: Session metadata and navigation

### T6.4 Generate short session summaries from the first user turn

- Create a short summary from the first user message when a session is first used.
- Persist that summary in the agent store.
- Add created/updated timestamps to the agent session metadata.
- Deliverable: sessions have stable summary/date metadata for UI display.
- Depends on: T1.3
- Blocks: T6.5

### T6.5 Add a session list UI with switch + delete controls

- Render all sessions in the agent UI with short summary and date metadata.
- Allow clicking a session to switch the active conversation.
- Allow deleting a session from the list with an explicit affordance.
- Keep the quick new-session affordance.
- Deliverable: multi-session navigation and cleanup is available in the chat UI.
- Depends on: T6.4
- Blocks: T8.1

## Milestone 7: Integrated verification

### T7.1 Verify end-to-end client tool calling

- Confirm the model can call `bash`, the client executes it, tool output renders, and the conversation continues.
- Verify common happy paths and failure states.
- Deliverable: working local manual verification and/or automated coverage.
- Depends on: T1.3, T1.4, T2.4
- Blocks: T8.2

### T7.2 Verify context FS behavior and safety

- Confirm injected context is readable under `/phoenix/**`.
- Confirm writes to `/phoenix/**` fail.
- Confirm writes to workspace succeed.
- Confirm refresh behavior works for navigation, `/refresh`, and alternate time ranges.
- Deliverable: verified FS contract.
- Depends on: T2.2, T2.3, T5.1, T6.1, T6.2, T6.3
- Blocks: T8.2

## Milestone 8: Developer ergonomics and polish

### T8.1 Add dev-facing diagnostics for adapter experimentation

- Surface which adapters were used and when.
- Show generation metadata in manifest/context metadata.
- Optionally expose current adapter config in a dev-only view.
- Deliverable: easier debugging when comparing adapter strategies.
- Depends on: T5.2, T5.3, T6.3
- Blocks: none

### T8.2 Polish the tool execution panel and transcript experience

- Improve truncation/expand behavior.
- Make command history easy to scan.
- Ensure errors are actionable.
- Deliverable: usable debugging UX.
- Depends on: T7.1, T7.2
- Blocks: none

## Suggested execution order

1. T0.1
2. T0.2
3. T1.1
4. T2.1
5. T1.2
6. T1.3
7. T2.2, T2.3, T2.4
8. T1.4
9. T3.1
10. T3.2, T3.3
11. T4.1, T4.2
12. T5.1
13. T6.1, T6.2
14. T6.3
15. T7.1, T7.2
16. T5.2, T5.3
17. T8.1, T8.2

## Notes

- The product-facing default remains page-context + lazy tables.
- Experimental adapters exist to help developers compare context injection quality, not as a user-facing configuration surface.
- The stable filesystem layout matters more than the adapter internals; agent workflows should continue to work as adapters change.
