import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";

import { dispatchUIOperationCall } from "./dispatch";
import { runUIScript } from "./runtime/UIScriptBridge";

export const EXECUTE_BROWSER_ACTION_TOOL_NAME = "execute_browser_action";

/**
 * Abort callbacks for in-flight script runs, keyed by the `execute_browser_action`
 * tool-call id. Chat interrupt / session teardown uses this to hard-stop a
 * running script (terminating its worker) before clearing pending state.
 */
const activeRunAborts = new Map<string, (reason: string) => void>();

/**
 * Force-fail the script run belonging to an `execute_browser_action` tool call, if one
 * is still active. Safe to call for unknown ids. Returns whether a run was
 * aborted.
 */
export function abortActiveUIScriptRun({
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

type ExecuteUIInput = {
  /**
   * User-facing sentence describing what the script accomplishes, rendered as
   * the tool part's preview. Required by the advertised schema but parsed
   * leniently — the preview falls back to the script when it is missing.
   */
  summary?: string;
  script: string;
};

function parseExecuteUIInput(input: unknown): ExecuteUIInput | null {
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
 * ~500, so twenty execute_browser_action calls stay under ~30k tokens combined. The
 * script itself is the escape hatch — it can slice, project, and count
 * before returning — and the truncation notice says so.
 */
const RETURN_VALUE_CHAR_BUDGET = 4_000;
const LOGS_CHAR_BUDGET = 2_000;
const LOG_LINE_CHAR_BUDGET = 300;

/**
 * Section markers for the plain-text run output. The renderer and
 * {@link parseExecuteUIRunOutput} share these so the chat card can split the
 * model-facing text back into status/logs/return-value for display without a
 * second, structured output channel.
 */
const RUN_STATUS_PREFIX = "Script completed after ";
const CALLS_SECTION_HEADER = "Calls:\n";
const LOGS_SECTION_HEADER = "Logs:\n";
const RETURN_VALUE_SECTION_HEADER = "Return value:\n";
const TRUNCATION_NOTE_PREFIX = "Note: the return value was truncated";
const TRUNCATION_GUIDANCE =
  "Constrain the return value in the script itself — slice arrays, project " +
  "the fields you need, or return counts — and re-run if you are missing data.";
const MAX_CALL_LINES = 30;

/** One dispatched `ui.*` call, recorded main-thread-side for telemetry. */
export type UICallRecord = {
  operation: string;
  ok: boolean;
  durationMs: number;
  /** Serialized size of the call's output (or error text) in characters. */
  outputChars: number;
};

/**
 * One line per call — `playground.prompt.read ok 12ms 842ch` — so the model
 * can see which call failed, which was slow, and which produced the bulk of
 * an oversized return value, without a debugging round trip.
 */
function renderCalls(calls: UICallRecord[]): string {
  const lines = calls
    .slice(0, MAX_CALL_LINES)
    .map(
      (call, index) =>
        `${index + 1}. ${call.operation} ${call.ok ? "ok" : "FAILED"} ${call.durationMs}ms ${call.outputChars}ch`
    );
  if (calls.length > MAX_CALL_LINES) {
    lines.push(`…[${calls.length - MAX_CALL_LINES} more calls]`);
  }
  return lines.join("\n");
}

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
  return [
    `…[${cappedLines.length - kept.length} earlier logs omitted]…`,
    ...kept,
  ].join("\n");
}

/** A path/description pair describing one pruned subtree. */
type PruneOmission = { path: string; note: string };

function serializedSize(value: unknown): number {
  const serialized = JSON.stringify(value);
  return serialized == null ? 4 : serialized.length;
}

/**
 * Prune a parsed JSON value to roughly `budget` serialized characters while
 * preserving its structure — the fix for structure-blind string truncation,
 * where one oversized array in a batched result destroyed every sibling
 * result around it:
 * - objects keep **every key**; oversized values are pruned recursively with
 *   a fair share of the remaining budget, so no sibling is obliterated;
 * - arrays keep leading items whole and replace the rest with a counted
 *   marker string;
 * - long strings clamp with a `…[+N chars]` marker.
 * Every omission is recorded with its path so the truncation note can say
 * exactly what was dropped and where.
 */
function pruneToBudget(
  value: unknown,
  budget: number,
  path: string,
  omissions: PruneOmission[]
): unknown {
  if (serializedSize(value) <= budget) {
    return value;
  }
  if (typeof value === "string") {
    const keep = Math.max(budget - 24, 40);
    omissions.push({ path, note: `${value.length - keep} chars clamped` });
    return `${value.slice(0, keep)}…[+${value.length - keep} chars]`;
  }
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    let remaining = budget - 2;
    for (const item of value) {
      const itemSize = serializedSize(item) + 1;
      if (itemSize > remaining) {
        break;
      }
      kept.push(item);
      remaining -= itemSize;
    }
    // Always show at least one (pruned) item so the element shape survives.
    if (kept.length === 0 && value.length > 0) {
      kept.push(
        pruneToBudget(
          value[0],
          Math.max(remaining, 120),
          `${path}[0]`,
          omissions
        )
      );
    }
    const omitted = value.length - kept.length;
    if (omitted > 0) {
      omissions.push({
        path,
        note: `${omitted} of ${value.length} items omitted`,
      });
      kept.push(`…[${omitted} more items omitted]`);
    }
    return kept;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    const pruned: Record<string, unknown> = {};
    let remaining = budget - 2;
    let entriesLeft = entries.length;
    for (const [key, child] of entries) {
      // Fair share of what's left, so one huge field can't starve the keys
      // after it — every top-level key survives pruning.
      const share = Math.max(Math.floor(remaining / entriesLeft), 200);
      const childSize = serializedSize(child) + key.length + 4;
      if (childSize <= share) {
        pruned[key] = child;
        remaining -= childSize;
      } else {
        const childPath = path === "$" ? `$.${key}` : `${path}.${key}`;
        pruned[key] = pruneToBudget(child, share, childPath, omissions);
        remaining -= Math.min(serializedSize(pruned[key]), share);
      }
      entriesLeft -= 1;
    }
    return pruned;
  }
  return value;
}

/**
 * Cap the serialized return value at the budget. JSON values are pruned
 * structure-aware (see {@link pruneToBudget}); non-JSON return values
 * ("undefined", unserializable markers) fall back to blind middle
 * truncation.
 */
function renderReturnValue(returnValue: string): {
  text: string;
  note: string | null;
} {
  if (returnValue.length <= RETURN_VALUE_CHAR_BUDGET) {
    return { text: returnValue, note: null };
  }
  let omissionSummary = "";
  let text: string;
  try {
    const omissions: PruneOmission[] = [];
    const pruned = pruneToBudget(
      JSON.parse(returnValue),
      RETURN_VALUE_CHAR_BUDGET,
      "$",
      omissions
    );
    text = JSON.stringify(pruned, null, 2);
    if (omissions.length > 0) {
      const shown = omissions.slice(0, 8);
      omissionSummary =
        " — omitted: " +
        shown.map(({ path, note }) => `${path} (${note})`).join("; ") +
        (omissions.length > shown.length
          ? `; …${omissions.length - shown.length} more`
          : "");
    }
    // Pretty-printing pruned structures can still overshoot; hard-stop with
    // the blind fallback rather than blowing the budget.
    if (text.length > RETURN_VALUE_CHAR_BUDGET * 1.5) {
      text = truncateMiddle(text, RETURN_VALUE_CHAR_BUDGET);
    }
  } catch {
    text = truncateMiddle(returnValue, RETURN_VALUE_CHAR_BUDGET);
  }
  return {
    text,
    note: `${TRUNCATION_NOTE_PREFIX} (was ${returnValue.length} chars)${omissionSummary}. ${TRUNCATION_GUIDANCE}`,
  };
}

/**
 * Render a completed run as the model-facing tool output. Exported for
 * tests — the format is a contract with {@link parseExecuteUIRunOutput}.
 */
export function renderRunOutput({
  returnValue,
  callCount,
  calls,
  logs,
}: {
  returnValue: string;
  callCount: number;
  calls: UICallRecord[];
  logs: string[];
}): string {
  const sections = [
    `${RUN_STATUS_PREFIX}${callCount} ui call${callCount === 1 ? "" : "s"}.`,
  ];
  if (calls.length > 0) {
    sections.push(`${CALLS_SECTION_HEADER}${renderCalls(calls)}`);
  }
  if (logs.length > 0) {
    sections.push(`${LOGS_SECTION_HEADER}${renderLogs(logs)}`);
  }
  const rendered = renderReturnValue(returnValue);
  sections.push(`${RETURN_VALUE_SECTION_HEADER}${rendered.text}`);
  if (rendered.note != null) {
    sections.push(rendered.note);
  }
  return sections.join("\n\n");
}

/** A completed run output split back into sections for display. */
export type ExecuteUIRunOutputView = {
  /** "Script completed after N ui calls." — human-readable as-is. */
  status: string;
  /** Per-call telemetry lines, or null (model-facing; hidden from users). */
  calls: string | null;
  /** The log lines the script emitted, or null when it logged nothing. */
  logs: string | null;
  /** The JSON-serialized (possibly truncated) return value. */
  returnValue: string;
  /** The truncation notice, when the return value was cut. */
  note: string | null;
};

/**
 * Split a {@link renderRunOutput} string back into its sections so the chat
 * card can render each appropriately (status as text, the return value
 * behind a collapsible code view) instead of one undifferentiated blob.
 * Returns null when the text is not a run output (e.g. output from an older
 * format), in which case callers should fall back to raw rendering.
 */
export function parseExecuteUIRunOutput(
  output: string
): ExecuteUIRunOutputView | null {
  if (!output.startsWith(RUN_STATUS_PREFIX)) {
    return null;
  }
  const returnValueMarker = `\n\n${RETURN_VALUE_SECTION_HEADER}`;
  const returnValueIndex = output.indexOf(returnValueMarker);
  if (returnValueIndex === -1) {
    return null;
  }
  let head = output.slice(0, returnValueIndex);
  let tail = output.slice(returnValueIndex + returnValueMarker.length);

  const noteMarker = `\n\n${TRUNCATION_NOTE_PREFIX}`;
  let note: string | null = null;
  const noteIndex = tail.lastIndexOf(noteMarker);
  if (noteIndex !== -1) {
    note = tail.slice(noteIndex + 2);
    tail = tail.slice(0, noteIndex);
  }

  const logsMarker = `\n\n${LOGS_SECTION_HEADER}`;
  const logsIndex = head.indexOf(logsMarker);
  let logs: string | null = null;
  if (logsIndex !== -1) {
    logs = head.slice(logsIndex + logsMarker.length);
    head = head.slice(0, logsIndex);
  }

  const callsMarker = `\n\n${CALLS_SECTION_HEADER}`;
  const callsIndex = head.indexOf(callsMarker);
  let calls: string | null = null;
  if (callsIndex !== -1) {
    calls = head.slice(callsIndex + callsMarker.length);
    head = head.slice(0, callsIndex);
  }

  return { status: head, calls, logs, returnValue: tail, note };
}

/**
 * `execute_browser_action`: run an agent-authored script against the UI operation catalog
 * in a sandboxed worker. The counterpart to `search_browser_actions` — together they
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
export const executeUIAgentTool = defineTool<ExecuteUIInput>({
  name: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  parseInput: parseExecuteUIInput,
  invalidInputErrorText:
    "Invalid execute_browser_action input. Expected { script: string } with a non-empty script body.",
  // The card stays collapsed by default — most scripts run and finish
  // without needing the user's attention. When an inner operation stages an
  // Accept/Reject approval, dispatch requests the card open through the
  // store (see `dispatchUIOperationCall`); `scrollIntoViewOnMount` makes
  // that store-driven open also scroll the card into view.
  UIBehavior: { scrollIntoViewOnMount: true },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
    capabilities,
  }) => {
    // Telemetry is recorded here (main-thread side, around dispatch) so the
    // worker protocol stays untouched. Approval calls include the user's
    // decision time in durationMs — informative, not noise.
    const callRecords: UICallRecord[] = [];
    const run = await runUIScript({
      script: input.script,
      dispatchCall: async ({
        operationName,
        input: operationInput,
        callSequence,
      }) => {
        const startedAt = performance.now();
        const result = await dispatchUIOperationCall({
          operationName,
          input: operationInput,
          // Approval handlers key pending entries by this id; interrupt
          // cleanup finds them again by the toolCallId prefix.
          callId: `${toolCall.toolCallId}:${callSequence}`,
          hostToolCallId: toolCall.toolCallId,
          agentStore,
          sessionId,
          capabilities,
        });
        callRecords.push({
          operation: operationName,
          ok: result.ok,
          durationMs: Math.round(performance.now() - startedAt),
          outputChars: result.ok
            ? serializedSize(result.output ?? null)
            : result.error.length,
        });
        return result;
      },
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
        tool: EXECUTE_BROWSER_ACTION_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: `${run.error}${logSuffix}`,
      });
      return;
    }
    await addToolOutput({
      state: "output-available",
      tool: EXECUTE_BROWSER_ACTION_TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: renderRunOutput({ ...run, calls: callRecords }),
    });
  },
});
