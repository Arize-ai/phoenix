import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";

import type { AgentCapabilityKey } from "../capabilities";
import {
  type AddToolOutput,
  type AgentToolCall,
  type AgentToolDefinition,
  type AgentToolUIBehavior,
  defineTool,
} from "./defineTool";
import { requireToolSession } from "./requireToolSession";

/**
 * Emit a client action's {@link AgentClientActionResult} as tool output.
 *
 * The success branch is skipped when `emitSuccess` is false, which models the
 * approval tools whose success output is deferred to a later accept/reject
 * flow (only their failures surface synchronously).
 *
 * @param params.result - the client action result to translate
 * @param params.toolName - server-advertised tool name
 * @param params.toolCallId - id of the originating tool call
 * @param params.addToolOutput - AI SDK callback used to surface output
 * @param params.defaultSuccessOutput - fallback message when the action omits one
 * @param params.emitSuccess - when `false`, the success branch is skipped (the
 *   approval-tool case: success output is deferred to the accept/reject flow);
 *   failures still surface either way
 */
async function emitClientActionResult({
  result,
  toolName,
  toolCallId,
  addToolOutput,
  defaultSuccessOutput,
  emitSuccess,
}: {
  result: AgentClientActionResult;
  toolName: string;
  toolCallId: string;
  addToolOutput: AddToolOutput;
  defaultSuccessOutput: string;
  emitSuccess: boolean;
}): Promise<void> {
  if (result.ok) {
    if (!emitSuccess) return;
    await addToolOutput({
      state: "output-available",
      tool: toolName,
      toolCallId,
      output: result.output ?? defaultSuccessOutput,
    });
    return;
  }
  await addToolOutput({
    state: "output-error",
    tool: toolName,
    toolCallId,
    errorText: result.error,
  });
}

/**
 * Define a client-action tool: one that delegates to a *client action* looked
 * up by name in `agentStore.registeredClientActions` — the callable a mounted
 * React component registers (via `registerClientAction`) to expose its UI
 * surface to PXI. Tools that own their own execution and delegate to no client
 * action (e.g. `bash`, `render_generative_ui`) use the lower-level `defineTool`
 * instead.
 *
 * The `requireSession` knob composes the shared `requireToolSession` guard —
 * the same guard the session-gated standalone tools use — so the no-session
 * check is not duplicated per tool.
 *
 * This collapses the otherwise-identical "look up action, bail if unmounted,
 * invoke, map result" boilerplate shared by most contextual client-executed
 * tools. The optional `requireSession` / `buildContext` / `emitSuccess` knobs
 * model the approval tools (`edit_prompt_instance`, `save_prompt`,
 * `edit_code_evaluator_draft`) that additionally require a session, pass a
 * typed context as the action's second argument, and defer their success
 * output to an accept/reject flow.
 *
 * @param config.name - server-advertised tool name (also the action key)
 * @param config.parseInput - validates raw input, returning `null` when invalid
 * @param config.invalidInputErrorText - message (or builder) for invalid input
 * @param config.notMountedErrorText - error when no action is registered
 * @param config.defaultSuccessOutput - fallback success message
 * @param config.uiBehavior - chat UI surfacing hints
 * @param config.requiredCapabilities - capability keys gated by the kernel
 * @param config.requireSession - require an active session before dispatching
 * @param config.noSessionErrorText - error when a session is required but absent
 * @param config.buildContext - builds the action's second-argument context
 * @param config.emitSuccess - whether dispatch reports this tool's success
 *   (default `true`). When `true`, a successful action immediately emits
 *   `output-available` and the call resolves in one shot. Set it to `false` for
 *   approval tools, whose action only *stages* a pending change: the real
 *   success output ("accepted"/"rejected") is emitted later by the accept/reject
 *   flow, so emitting here too would produce a duplicate output. Failures always
 *   surface synchronously regardless of this flag.
 */
export function defineClientActionTool<TInput, TContext = undefined>(config: {
  name: string;
  parseInput: (input: unknown) => TInput | null;
  invalidInputErrorText: string | ((input: unknown) => string);
  notMountedErrorText: string;
  defaultSuccessOutput?: string;
  uiBehavior?: AgentToolUIBehavior;
  requiredCapabilities?: AgentCapabilityKey[];
  requireSession?: boolean;
  noSessionErrorText?: string;
  buildContext?: (args: {
    toolCall: AgentToolCall;
    sessionId: string;
    addToolOutput: AddToolOutput;
    agentStore: AgentStore;
  }) => TContext;
  emitSuccess?: boolean;
}): AgentToolDefinition {
  const emitSuccess = config.emitSuccess ?? true;
  const defaultSuccessOutput = config.defaultSuccessOutput ?? "Done.";

  return defineTool<TInput>({
    name: config.name,
    parseInput: config.parseInput,
    invalidInputErrorText: config.invalidInputErrorText,
    requiredCapabilities: config.requiredCapabilities,
    uiBehavior: config.uiBehavior,
    execute: async ({
      toolCall,
      input,
      sessionId,
      addToolOutput,
      agentStore,
    }) => {
      const action = agentStore.getState().registeredClientActions[config.name];
      if (!action) {
        await addToolOutput({
          state: "output-error",
          tool: config.name,
          toolCallId: toolCall.toolCallId,
          errorText: config.notMountedErrorText,
        });
        return;
      }

      if (config.requireSession) {
        const session = await requireToolSession({
          toolName: config.name,
          toolCall,
          sessionId,
          addToolOutput,
          errorText:
            config.noSessionErrorText ??
            "Cannot run this tool without an active session.",
        });
        if (session == null) return;
      }

      // Simple client actions are called with input only; context tools (the
      // approval flows) receive a typed second argument. Preserving the
      // single-argument call keeps the action contract unchanged for the
      // common case.
      const result = config.buildContext
        ? await action(
            input,
            config.buildContext({
              toolCall,
              // Narrowed: requireSession guarantees a non-null session above.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- buildContext tools set requireSession, whose guard already bailed on a null session
              sessionId: sessionId as string,
              addToolOutput,
              agentStore,
            })
          )
        : await action(input);
      await emitClientActionResult({
        result,
        toolName: config.name,
        toolCallId: toolCall.toolCallId,
        addToolOutput,
        defaultSuccessOutput,
        emitSuccess,
      });
    },
  });
}
