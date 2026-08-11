import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { dispatchUiOperationCall } from "./dispatch";
import { runUiScript } from "./runtime/uiScriptBridge";

export const EXECUTE_UI_TOOL_NAME = "execute_ui";

/**
 * Abort callbacks for in-flight script runs, keyed by the `execute_ui`
 * tool-call id. Chat interrupt / session teardown uses this to hard-stop a
 * running script (terminating its worker) before clearing pending state.
 */
const activeRunAborts = new Map<string, (reason: string) => void>();

/**
 * Force-fail the script run belonging to an `execute_ui` tool call, if one
 * is still active. Safe to call for unknown ids. Returns whether a run was
 * aborted.
 */
export function abortActiveUiScriptRun({
  toolCallId,
  reason,
}: {
  toolCallId: string;
  reason: string;
}): boolean {
  const abort = activeRunAborts.get(toolCallId);
  if (abort == null) {
    return false;
  }
  abort(reason);
  return true;
}

type ExecuteUiInput = {
  /**
   * User-facing sentence describing what the script accomplishes, rendered as
   * the tool part's preview. Required by the advertised schema but parsed
   * leniently — the preview falls back to the script when it is missing.
   */
  summary?: string;
  script: string;
};

function parseExecuteUiInput(input: unknown): ExecuteUiInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { summary?: unknown; script?: unknown };
  if (typeof candidate.script !== "string" || candidate.script.trim() === "") {
    return null;
  }
  return {
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim() !== ""
        ? candidate.summary
        : undefined,
    script: candidate.script,
  };
}

/** Render a completed run as the model-facing tool output. */
function renderRunOutput({
  returnValue,
  callCount,
  logs,
}: {
  returnValue: string;
  callCount: number;
  logs: string[];
}): string {
  const sections = [
    `Script completed after ${callCount} ui call${callCount === 1 ? "" : "s"}.`,
  ];
  if (logs.length > 0) {
    sections.push(`Logs:\n${logs.join("\n")}`);
  }
  sections.push(`Return value:\n${returnValue}`);
  return sections.join("\n\n");
}

/**
 * `execute_ui`: run an agent-authored script against the UI operation catalog
 * in a sandboxed worker. The counterpart to `search_ui` — together they
 * replace the per-operation client-action tools.
 *
 * The script receives two bindings:
 * - `ui` — the operation proxy (`await ui.timeRange.set({...})`), every call
 *   validated and dispatched on the main thread;
 * - `log(message)` — progress lines surfaced in the tool output.
 * Its `return` value (JSON-serialized) becomes the tool output.
 *
 * RFC note: not yet listed in `toolRegistry.ts` — inert until the rollout
 * capability lands.
 */
export const executeUiAgentTool = defineTool<ExecuteUiInput>({
  name: EXECUTE_UI_TOOL_NAME,
  parseInput: parseExecuteUiInput,
  invalidInputErrorText:
    "Invalid execute_ui input. Expected { script: string } with a non-empty script body.",
  // Scripts can stage Accept/Reject approvals inside their card; auto-open
  // so a pending approval is never hidden behind a collapsed details element.
  uiBehavior: { autoOpen: true, scrollIntoViewOnMount: true },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
    capabilities,
  }) => {
    const run = await runUiScript({
      script: input.script,
      dispatchCall: ({ operationName, input: operationInput, callSequence }) =>
        dispatchUiOperationCall({
          operationName,
          input: operationInput,
          // Approval handlers key pending entries by this id; interrupt
          // cleanup finds them again by the toolCallId prefix.
          callId: `${toolCall.toolCallId}:${callSequence}`,
          agentStore,
          sessionId,
          capabilities,
        }),
      registerAbort: (abort) => {
        activeRunAborts.set(toolCall.toolCallId, abort);
      },
    });
    activeRunAborts.delete(toolCall.toolCallId);
    if (!run.ok) {
      const logSuffix =
        run.logs.length > 0
          ? `\n\nLogs before failure:\n${run.logs.join("\n")}`
          : "";
      await addToolOutput({
        state: "output-error",
        tool: EXECUTE_UI_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: `${run.error}${logSuffix}`,
      });
      return;
    }
    await addToolOutput({
      state: "output-available",
      tool: EXECUTE_UI_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: renderRunOutput(run),
    });
  },
});
