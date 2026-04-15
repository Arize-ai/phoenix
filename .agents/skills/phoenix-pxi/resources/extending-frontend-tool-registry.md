# Extending The Frontend Tool Registry

Use this guide when working on frontend-executed PXI tools in `app/src/agent/`.

## Mental Model

One frontend tool has four moving parts:

1. A tool definition advertised to the model.
2. A parser that validates raw tool input.
3. A runtime handler that executes the tool or updates client state.
4. A registry entry that wires the definition and handler together.

The request body includes `agentToolDefinitions`, and tool calls returning from the AI SDK are dispatched through `handleRegisteredAgentToolCall`.

## Files To Know

- `app/src/agent/extensions/toolRegistry.ts`
- `app/src/agent/extensions/capabilities.ts`
- `app/src/agent/chat/buildAgentChatRequestBody.ts`
- `app/src/agent/chat/handleAgentToolCall.ts`
- `app/src/agent/tools/<tool-name>/...`

## Add A Frontend Tool

1. Create or update the tool module under `app/src/agent/tools/<tool-name>/`.
2. Export a `FrontendToolDefinition` and a parser from that module.
3. Implement a runtime handler for the tool's browser-side behavior.
4. Register the tool in `app/src/agent/extensions/toolRegistry.ts`.
5. If the tool depends on runtime policy or user-controlled permissions, add or update capability metadata in `app/src/agent/extensions/capabilities.ts`.
6. If privileged behavior must reach a browser runtime or custom shell command, translate capabilities into a trusted runtime policy object at the execution boundary instead of reading authorization from mutable shell state such as environment variables.
7. If the model needs to understand that capability state, ensure the system-prompt summary remains accurate in `buildAgentChatRequestBody.ts`.

## Edit A Frontend Tool

1. Start in the tool module itself for schema, parsing, or runtime behavior changes.
2. Update `toolRegistry.ts` only if registration, gating, or dispatch behavior changes.
3. Update `capabilities.ts` if the tool's permissions, labels, or control surfaces change.
4. If runtime permissions are involved, verify the execution path consumes trusted runtime policy rather than shell-controlled values.
5. Check `buildAgentChatRequestBody.ts` if the model-facing runtime context should change.

## Remove A Frontend Tool

1. Delete the tool's registry entry from `toolRegistry.ts`.
2. Remove any unused imports or request-path references.
3. Delete the tool module and any no-longer-needed capability metadata.
4. Run `pnpm typecheck` and lint to catch stale references.

## Design Rules

- Keep tool-specific behavior in the tool module or registry entry, not in React components.
- Prefer capability metadata over hardcoded UI toggles when a tool needs runtime policy.
- Keep capability metadata declarative. Translate capabilities into trusted runtime policy near the execution boundary rather than embedding authorization checks in mutable shell state.
- Keep `handleAgentToolCall.ts` thin; registry-backed dispatch should stay the main extension seam.
- When adding a new concept, make the story readable top-to-bottom: metadata, helpers, then exported entry points.
