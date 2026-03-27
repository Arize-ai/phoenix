import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";

import type { ToolPartType } from "./ToolPart";

export type GroupedPart =
  | { kind: "text"; part: UIMessage["parts"][number]; index: number }
  | { kind: "tool-solo"; part: ToolPartType; index: number }
  | { kind: "tool-group"; parts: ToolPartType[]; startIndex: number }
  | { kind: "other"; part: UIMessage["parts"][number]; index: number };

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
 */
function isTransparentPart(part: UIMessage["parts"][number]): boolean {
  if (part.type === "step-start") return true;
  if (isTextUIPart(part) && part.text.trim() === "") return true;
  return false;
}

/**
 * Partitions a flat `parts` array into grouped segments so that runs of
 * consecutive tool parts (>= {@link TOOL_GROUP_THRESHOLD}) are collapsed into
 * a single `tool-group` entry. Everything else passes through as-is.
 *
 * `step-start` parts and empty text parts are treated as transparent: they
 * don't break a tool run and are not rendered. This is critical because the
 * AI SDK inserts a `step-start` between every auto-send cycle, so tool calls
 * in an agent loop are always separated by step boundaries.
 */
export function groupMessageParts(parts: UIMessage["parts"]): GroupedPart[] {
  const result: GroupedPart[] = [];
  let toolRun: { parts: ToolPartType[]; startIndex: number } | null = null;

  const flushToolRun = () => {
    if (!toolRun) return;
    if (toolRun.parts.length >= TOOL_GROUP_THRESHOLD) {
      result.push({
        kind: "tool-group",
        parts: toolRun.parts,
        startIndex: toolRun.startIndex,
      });
    } else {
      // Below threshold — render each tool individually
      for (let j = 0; j < toolRun.parts.length; j++) {
        result.push({
          kind: "tool-solo",
          part: toolRun.parts[j],
          index: toolRun.startIndex + j,
        });
      }
    }
    toolRun = null;
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Skip invisible parts — they don't break tool runs and aren't rendered
    if (isTransparentPart(part)) {
      continue;
    }

    if (isToolUIPart(part)) {
      if (!toolRun) {
        toolRun = { parts: [], startIndex: i };
      }
      toolRun.parts.push(part as ToolPartType);
    } else {
      flushToolRun();
      if (isTextUIPart(part)) {
        result.push({ kind: "text", part, index: i });
      } else {
        result.push({ kind: "other", part, index: i });
      }
    }
  }
  flushToolRun();

  return result;
}
