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
 * @param params.emitSuccess - whether to emit on success (default true)
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
 * Define a "page-action" tool: one that delegates to a client action looked up
 * by name in `agentStore.registeredClientActions`. A *client action* here is
 * the same thing as a *page action* — the callable a mounted React component
 * registers (via `registerClientAction`) to expose its page surface to PXI; the
 * two terms are interchangeable. Tools that own their own execution and
 * delegate to no page action (e.g. `bash`, `render_generative_ui`) use the
 * lower-level `defineTool` instead.
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
 * @param config.emitSuccess - whether to emit output on success (default true)
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

      if (config.requireSession && sessionId == null) {
        await addToolOutput({
          state: "output-error",
          tool: config.name,
          toolCallId: toolCall.toolCallId,
          errorText:
            config.noSessionErrorText ??
            "Cannot run this tool without an active session.",
        });
        return;
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
