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

/**
 * Context-pressure budgets for the model-facing output. Tool outputs are
 * replayed into the prompt on every subsequent turn of the session, so one
 * unbounded return value (a dataset dump easily exceeds 100k characters)
 * can crowd out everything else for the rest of the conversation. Budgets
 * are sized so even a script-heavy session stays cheap: at ~4 chars/token,
 * a maxed-out return value costs ~1k tokens and a maxed-out log section
 * ~500, so twenty execute_ui calls stay under ~30k tokens combined. The
 * script itself is the escape hatch — it can slice, project, and count
 * before returning — and the truncation notice says so.
 */
const RETURN_VALUE_CHAR_BUDGET = 4_000;
const LOGS_CHAR_BUDGET = 2_000;
const LOG_LINE_CHAR_BUDGET = 300;

/**
 * Cap `text` at `budget` characters, keeping the head and tail. The head
 * usually carries a JSON payload's shape and scalar fields; the tail keeps
 * closing context (totals, the last array items). The marker states how
 * much was dropped so the model knows the omission is real, and the exact
 * character count signals mechanical truncation rather than elision.
 */
function truncateMiddle(text: string, budget: number): string {
  if (text.length <= budget) {
    return text;
  }
  const headLength = Math.floor(budget * 0.75);
  const tailLength = budget - headLength;
  const omitted = text.length - headLength - tailLength;
  return `${text.slice(0, headLength)}\n…[truncated ${omitted} chars]…\n${text.slice(text.length - tailLength)}`;
}

/** Cap each log line, then the log section as a whole (newest lines win). */
function renderLogs(logs: string[]): string {
  const cappedLines = logs.map((line) =>
    line.length > LOG_LINE_CHAR_BUDGET
      ? `${line.slice(0, LOG_LINE_CHAR_BUDGET)}…`
      : line
  );
  const joined = cappedLines.join("\n");
  if (joined.length <= LOGS_CHAR_BUDGET) {
    return joined;
  }
  // Keep the most recent lines: late logs describe where the script ended
  // up, which is what the model needs next.
  const kept: string[] = [];
  let total = 0;
  for (let i = cappedLines.length - 1; i >= 0; i--) {
    total += cappedLines[i].length + 1;
    if (total > LOGS_CHAR_BUDGET) {
      break;
    }
    kept.unshift(cappedLines[i]);
  }
  return [`…[${cappedLines.length - kept.length} earlier logs omitted]…`, ...kept].join(
    "\n"
  );
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
    sections.push(`Logs:\n${renderLogs(logs)}`);
  }
  const truncated = returnValue.length > RETURN_VALUE_CHAR_BUDGET;
  sections.push(
    `Return value:\n${truncateMiddle(returnValue, RETURN_VALUE_CHAR_BUDGET)}`
  );
  if (truncated) {
    sections.push(
      "Note: the return value was truncated. Constrain the return value in " +
        "the script itself — slice arrays, project the fields you need, or " +
        "return counts — and re-run if you are missing data."
    );
  }
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
          ? `\n\nLogs before failure:\n${renderLogs(run.logs)}`
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
