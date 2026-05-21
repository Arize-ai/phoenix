import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";

import { isGenerativeUIPart } from "./generativeUI";
import type { ToolPartType } from "./ToolPart";

export type GroupedPart =
  | { kind: "text"; part: UIMessage["parts"][number]; index: number }
  | { kind: "tool-solo"; part: ToolPartType; index: number }
  | { kind: "tool-group"; parts: ToolPartType[]; startIndex: number }
  | { kind: "generative-ui"; part: UIMessage["parts"][number]; index: number };

/**
 * Minimum number of consecutive tool parts before they get collapsed into a
 * pool. Below this threshold they render individually.
 */
const TOOL_GROUP_THRESHOLD = 3;

/**
 * Returns true for parts that should be treated as "invisible" — they don't
 * break a consecutive tool run and are not rendered.
 *
 * - `step-start` parts are AI SDK step boundary markers that appear between
 *   every auto-send cycle. They carry no user-visible content.
 * - Empty text parts (whitespace-only) sometimes appear at step boundaries.
 * - Other assistant parts that this renderer does not display (reasoning,
 *   sources, files, unknown data parts) should not split a visible tool run.
 */
function isTransparentPart(part: UIMessage["parts"][number]): boolean {
  if (part.type === "step-start") return true;
  if (isTextUIPart(part) && part.text.trim() === "") return true;
  return !isTextUIPart(part);
}

/**
 * Partitions a flat `parts` array into grouped segments so that runs of
 * consecutive tool parts (>= {@link TOOL_GROUP_THRESHOLD}) are collapsed into
 * a single `tool-group` entry. Everything else passes through as-is.
 *
 * Hidden parts are treated as transparent: they don't break a tool run and are
 * not rendered. This is critical because the AI SDK inserts invisible parts
 * such as `step-start` between auto-send cycles, so tool calls in an agent loop
 * are often separated by hidden boundaries.
 */
export function groupMessageParts(parts: UIMessage["parts"]): GroupedPart[] {
  const result: GroupedPart[] = [];
  let toolRun: { entries: { part: ToolPartType; index: number }[] } | null =
    null;

  const flushToolRun = () => {
    if (!toolRun) return;
    if (toolRun.entries.length >= TOOL_GROUP_THRESHOLD) {
      result.push({
        kind: "tool-group",
        parts: toolRun.entries.map((entry) => entry.part),
        startIndex: toolRun.entries[0].index,
      });
    } else {
      // Below threshold — render each tool individually
      for (const entry of toolRun.entries) {
        result.push({
          kind: "tool-solo",
          part: entry.part,
          index: entry.index,
        });
      }
    }
    toolRun = null;
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (isGenerativeUIPart(part)) {
      flushToolRun();
      result.push({ kind: "generative-ui", part, index: i });
    } else if (isToolUIPart(part)) {
      if (!toolRun) {
        toolRun = { entries: [] };
      }
      toolRun.entries.push({ part: part as ToolPartType, index: i });
    } else if (isTransparentPart(part)) {
      // Skip invisible parts — they don't break tool runs and aren't rendered
      continue;
    } else {
      flushToolRun();
      if (isTextUIPart(part)) {
        result.push({ kind: "text", part, index: i });
      }
    }
  }
  flushToolRun();

  return result;
}
