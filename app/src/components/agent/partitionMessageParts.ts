import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";

import { isGenerativeUIPart } from "./generativeUI";
import type { ToolPartType } from "./ToolPart";

export type MessagePart =
  | { kind: "text"; part: UIMessage["parts"][number]; index: number }
  | { kind: "tool-solo"; part: ToolPartType; index: number }
  | { kind: "generative-ui"; part: UIMessage["parts"][number]; index: number };

/**
 * Returns true for parts the transcript actually renders: tool calls
 * (including generative UI slots, which are tool parts) and non-empty text.
 * Everything else is invisible —
 *
 * - `step-start` parts are AI SDK step boundary markers that appear between
 *   every auto-send cycle.
 * - Empty text parts (whitespace-only) sometimes appear at step boundaries.
 * - Other assistant parts that this renderer does not display (reasoning,
 *   sources, files, unknown data parts).
 *
 * Shared with the chat's Thinking indicator so "has anything visible streamed
 * yet" stays in lockstep with what this partitioner draws.
 */
export function isVisibleMessagePart(
  part: UIMessage["parts"][number]
): boolean {
  return isToolUIPart(part) || (isTextUIPart(part) && part.text.trim() !== "");
}

/**
 * Classifies a flat `parts` array into the renderable segments an assistant
 * message draws: text blocks, individual tool calls, and generative UI slots.
 * Every tool call is surfaced on its own — there is no grouping or pooling, so
 * each call stays visible rather than hidden behind a collapsed summary.
 *
 * Generative UI parts are split out first because they are themselves tool
 * parts but own a dedicated render slot upstream. Hidden parts are skipped: the
 * AI SDK inserts invisible parts such as `step-start` between auto-send cycles,
 * and they carry nothing to render.
 */
export function partitionMessageParts(
  parts: UIMessage["parts"]
): MessagePart[] {
  const result: MessagePart[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (isGenerativeUIPart(part)) {
      result.push({ kind: "generative-ui", part, index: i });
      continue;
    }

    if (isToolUIPart(part)) {
      result.push({ kind: "tool-solo", part: part as ToolPartType, index: i });
      continue;
    }

    if (!isVisibleMessagePart(part)) {
      // Skip invisible parts — they carry no user-visible content.
      continue;
    }

    if (isTextUIPart(part)) {
      result.push({ kind: "text", part, index: i });
    }
  }

  return result;
}
