# Extending The PXI Tool Registry

PXI ("pixie") is Phoenix's built-in AI assistant. The model-facing surface (tool `ToolDefinition`s, capability prompt) is **server-owned**; the browser is responsible for execution and dispatch only. Use this guide when adding, editing, or removing any PXI tool.

Before writing code, decide which tool type you need; see the decision matrix in `SKILL.md`. The mechanics for each type differ, but the contract between server advertisement and browser dispatch is always the tool **name**.

## Mental Model

A PXI tool has up to four moving parts; which apply depends on the tool type:

1. **Server `ToolDefinition`** — what the model sees: name, description, JSON Schema, and `kind` (`external` for browser-executed, `function` for server-executed).
2. **Server registration** — how the definition reaches `/chat`: explicit registry entries in `EXTERNAL_TOOLS` or `CONTEXTUAL_TOOLS`, surfaced by `resolve_tools`.
3. **Browser handler** — runtime that executes the call and returns output via the AI SDK `addToolOutput` callback. Required only for client-executed tools.
4. **UI action** — for contextual client-executed tools that mutate page-local state, a React component registers a callable in `registeredClientActions` keyed by the tool name.

## Files To Know

### Server

- `src/phoenix/server/agents/tools/registry.py` — `ContextualTool` dataclass, `resolve_tools`, `resolve_contextual_tools`, and the explicit `CONTEXTUAL_TOOLS` / `EXTERNAL_TOOLS` registries.
- `src/phoenix/server/agents/tools/external/<tool>.py` — one external tool per file.
- `src/phoenix/server/agents/tools/<tool>.py` — one contextual tool per file; exposes a builder that returns `ContextualTool`.
- `src/phoenix/server/agents/context.py` — `ResolvedContexts`, `ToolExecutionEnv`, the `_available_context_types` set used to gate contextual tools.
- `src/phoenix/server/agents/capabilities.py` — `AgentCapabilities` schema and `_CAPABILITY_PROMPT_RULES`. Add a rule whenever you add a capability.
- `src/phoenix/server/api/routers/data_stream_protocol.py` — the streaming dispatcher; receives resolved PXI tools from `resolve_tools`, forwards external/contextual-client calls to the browser, and runs contextual-server tools in-process.

### Browser

- `app/src/agent/extensions/toolRegistry.ts` — the dispatch table. Each entry has a `name` (must match the server name), a `parseInput`, optional `requiredCapabilities`, and an `execute` function.
- `app/src/agent/extensions/capabilities.ts` — the runtime capability catalog used by the UI and the dispatcher gate.
- `app/src/agent/chat/buildAgentChatRequestBody.ts` — assembles the chat request body, including the `capabilities` payload sent on every turn.
- `app/src/agent/chat/handleAgentToolCall.ts` — thin AI SDK adapter over `handleRegisteredAgentToolCall`.
- `app/src/agent/tools/<tool-name>/...` — tool-specific browser modules: input parsers, runtime, and (for contextual UI actions) the React component that registers the action.

## Add A Tool

### External (always advertised, browser-executed)

1. **Server**: add `src/phoenix/server/agents/tools/external/<tool>.py` exporting a top-level `<TOOL_NAME>_TOOL_DEFINITION = ToolDefinition(..., kind="external")`. Import it in `src/phoenix/server/agents/tools/registry.py` and append it to `EXTERNAL_TOOLS`.
2. **Browser**: add a registry entry in `app/src/agent/extensions/toolRegistry.ts` matching the server `name`, with a `parseInput` and an `execute` that calls the runtime handler. Place runtime, types, and parser under `app/src/agent/tools/<tool-name>/`.
3. **Capabilities** (only if the tool depends on runtime policy): add the capability key to `AgentCapabilityKey` and `AGENT_CAPABILITY_DEFINITIONS` on the frontend, mirror the field in `AgentCapabilities` on the server, and add a `_CAPABILITY_PROMPT_RULE` (use a no-op `lambda _: None` if it should not affect the model). The server enforces exhaustiveness.
4. **System prompt** (if the model needs guidance): add a `<tool name="...">` block per the system-prompt XML conventions resource. (This will move server-side soon; until then, it is fine to update `app/src/agent/chat/systemPrompt.ts`.)

### Contextual, client-executed (browser handler, advertised only with required UI context)

1. **Server**: add `src/phoenix/server/agents/tools/<tool>.py` with a builder that returns `ContextualTool(executes_on="client", build_callable=None)`. Set `required_contexts` to the names recognised by `_available_context_types`; if you need a new name, add it there. Append the builder result to `CONTEXTUAL_TOOLS` in `registry.py`.
2. **Browser**:
   - Add a registry entry in `toolRegistry.ts` whose `execute` looks up a callable from `agentStore.registeredClientActions[<tool-name>]`. If no action is registered, return a clear `output-error` so the model knows the page surface is unavailable.
   - In the React component that owns the relevant UI surface, register the action via `useAdvertiseAgentContext` (for context advertisement) and the agent store's `registerClientAction` / `unregisterClientAction` (for the dispatch callable). Keep the registration scoped to the component's mount lifecycle.
3. **System prompt**: usually no extra prompt block is needed because the tool is already gated by context; add one only if the model needs orientation when the tool appears.

### Contextual, server-executed (no browser handler)

1. **Server**: add `src/phoenix/server/agents/tools/<tool>.py` with a builder that returns `ContextualTool(executes_on="server", build_callable=...)`. The callable receives `(ToolExecutionEnv, ResolvedContexts)` and returns an async function the dispatcher invokes per call. Append to `CONTEXTUAL_TOOLS`.
2. **Browser**: nothing. The tool is invisible to browser code.
3. Authorization: rely on `ToolExecutionEnv` (`user`, `db`) — never re-derive identity from request headers inside the tool.

## Edit A Tool

- Schema, description, or default behavior changes go in the server tool module.
- Browser-only changes (parsing, runtime UI behavior, error messages) go in the browser tool module or its registry entry.
- Capability changes touch both server and frontend; remember the prompt rule and the exhaustiveness assertion.
- For contextual client-executed tools, the React component that registers the action is the source of truth for how the action behaves on the page.

## Remove A Tool

1. **Server**: delete the tool file and remove it from `EXTERNAL_TOOLS` or `CONTEXTUAL_TOOLS` in `registry.py`.
2. **Browser**: remove the entry from `toolRegistry.ts`. Delete the tool module under `app/src/agent/tools/` if it is no longer used. Remove any `registerClientAction` calls.
3. **Capabilities**: if the tool was the only consumer of a capability, remove the field from `AgentCapabilities` and `AgentCapabilityKey`, and remove the corresponding `_CAPABILITY_PROMPT_RULE`.
4. Run typecheck and lint to catch stale references on both sides.

## Design Rules

- **Tool name is the contract.** Server advertisement and browser dispatch agree on a single string. Don't duplicate the JSON Schema on the frontend.
- **Server owns model-facing surface.** Tool definitions, capability prompt guidance, and (soon) system prompt all live server-side. The browser sends state, not schema.
- **Capabilities are typed.** Update the catalog on both sides and add a prompt rule (or explicit no-op rule) so model-visible behavior stays explicit.
- **Translate capabilities into trusted runtime policy** at the execution boundary instead of reading authorization from mutable shell state such as environment variables.
- **Keep `handleAgentToolCall.ts` thin.** Registry-backed dispatch is the only extension seam on the browser; tool-specific behavior belongs in the tool module or registry entry.
- **Prefer contextual gating over conditional tool descriptions.** If a tool only makes sense on a page, gate it via `required_contexts` so the model never sees it elsewhere.

## Verification

Use layer-appropriate verification for the PXI surface you touched.

Refer to the makefile for verification commands.

Additionally, smoke-test PXI locally via npx -y agent-browser : confirm the model receives the new tool, the dispatch reaches the intended runtime, and tool errors surface as readable output chunks rather than silent stalls.
