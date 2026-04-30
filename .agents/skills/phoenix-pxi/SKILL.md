---
name: phoenix-pxi
description: Development guide for the Phoenix PXI agent. Use when modifying PXI-specific frontend or backend behavior, extending PXI tool wiring, updating PXI runtime capabilities, or changing the PXI agent request/dispatch flow. Start here for PXI-specific workflows, then read the relevant resource file for the layer you are changing.
metadata:
  internal: true
---

# Phoenix PXI Development

Phoenix has a built-in AI assistant named **PXI** (pronounced "pixie"). PXI is the user-facing name for the assistant feature — backend configuration (env vars, project names) uses generic `agents`/`assistant` naming, not "PXI".

The model-facing surface (tool definitions, system-prompt assembly, capability guidance) is **server-owned**. The browser is responsible for execution and dispatch only. Adding or editing a PXI tool almost always touches both the server and the frontend; this index spans both layers.

## Architecture At A Glance

- **Server-owned, model-facing**:
  - All tool `ToolDefinition`s sent to the LLM.
  - Capability prompt guidance.
  - System prompt assembly will live here in the next iteration.
- **Browser-owned, execution-only**:
  - Tool runtime handlers and input parsers.
  - UI state, capabilities snapshot, and per-turn UI context payload.
- **Shared contract**: tool **name** is the integration key between server advertisement and browser dispatch.

## Resources

Read the relevant file(s) based on the task:

| Resource file                                        | When to read                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `resources/extending-tool-registry.md`               | Adding, editing, or removing a PXI tool — server advertisement, browser execution, capability gating, request/dispatch flow  |
| `resources/system-prompt-xml-conventions.md`         | Adding to, editing, or reviewing the PXI agent system prompt or any module that contributes lines to it                      |
| `resources/per-turn-context-and-cache-management.md` | Injecting per-turn page or UI state into a chat request; sanitizing user-controlled values; preserving prompt-cache prefixes |

## When To Add Which Tool Type

PXI has three tool execution targets. Pick the type before writing code; converting later means moving the schema and handler.

| Tool type                               | Execution location           | Available when                                                                        | Dispatch path                                                                                                                                              | Server location                                                                                                                                          | Browser location                                                                                                                                            |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **External (static)**                   | Browser                      | Always advertised                                                                     | Server emits `ToolDefinition(kind="external")`; the data-stream protocol forwards the call to the browser; the AI SDK dispatches to the registered handler | `src/phoenix/server/agents/tools/external/<tool>.py` registered via `EXTERNAL_TOOLS` in `registry.py`; surfaced through `resolve_tools`                   | Handler entry in `app/src/agent/extensions/toolRegistry.ts`                                                                                                 |
| **Contextual** (`executes_on="client"`) | Browser, gated on UI context | Only when the user's resolved Phoenix UI context provides every required context name | Same as External; advertised conditionally by `resolve_tools`                                                                                              | `src/phoenix/server/agents/tools/<tool>.py` registered via `CONTEXTUAL_TOOLS` in `registry.py`                                                           | Handler entry in `app/src/agent/extensions/toolRegistry.ts`, plus a `registeredClientActions` entry mounted by the React component that owns the UI surface |
| **Contextual** (`executes_on="server"`) | Server                       | Only when required UI context is present                                              | Server `build_callable` invoked in-process by the data-stream loop; result streamed back as a tool output chunk                                            | `src/phoenix/server/agents/tools/<tool>.py` registered via `CONTEXTUAL_TOOLS`; provides a `build_callable` taking `(ToolExecutionEnv, ResolvedContexts)` | None                                                                                                                                                        |

### Decision Matrix

| Question                                                                                                                                | If yes → tool type                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Does the tool only need to read or compute over Phoenix data the server already has authenticated access to?                            | Contextual, `executes_on="server"`                |
| Does the tool mutate browser state (filters, forms, navigation) or use a browser-only runtime (just-bash sandbox, IndexedDB, page DOM)? | Contextual or External, `executes_on="client"`    |
| Does the tool only make sense on a specific page or against a specific resource (project, trace, span)?                                 | Contextual (server- or client-executed)           |
| Is the tool always relevant to the agent regardless of route or selection?                                                              | External                                          |
| Does the tool require credentials, secrets, or privileged DB writes?                                                                    | Contextual, `executes_on="server"` (never client) |
| Could the tool be invoked from any page and is its output independent of the current selection?                                         | External                                          |

### Anti-Patterns

- **Don't** advertise client-executed tools that depend on UI state without using the contextual registry; always-advertised tools that fail because the page changed produce noisy model errors.
- **Don't** push browser-mutation logic to the server through a contextual server tool. The server has no DOM and cannot honor the user's current view.
- **Don't** duplicate a tool's JSON schema on the frontend. The server is the single source of truth for the model-facing schema; the browser only needs an input parser.
- **Don't** put privileged shell or DB authorization checks inside browser code. Translate capabilities into a trusted runtime policy at the execution boundary.

## Verification

Use layer-appropriate verification for the PXI surface you touched.

Refer to the makefile for verification commands.
