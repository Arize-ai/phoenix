import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { runUiScript } from "./runtime/uiScriptBridge";

export const EXECUTE_UI_TOOL_NAME = "execute_ui";

type ExecuteUiInput = {
  script: string;
};

function parseExecuteUiInput(input: unknown): ExecuteUiInput | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { script?: unknown };
  if (typeof candidate.script !== "string" || candidate.script.trim() === "") {
    return null;
  }
  return { script: candidate.script };
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
  execute: async ({ toolCall, input, addToolOutput }) => {
    const run = await runUiScript({ script: input.script });
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
