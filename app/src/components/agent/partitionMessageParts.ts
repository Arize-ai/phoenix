import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";

import { isGenerativeUIPart } from "./generativeUI";
import type { ToolPartType } from "./ToolPart";

export type MessagePart =
  | { kind: "text"; part: UIMessage["parts"][number]; index: number }
  | { kind: "tool-solo"; part: ToolPartType; index: number }
  | { kind: "generative-ui"; part: UIMessage["parts"][number]; index: number };

/**
 * Returns true for parts that should be treated as "invisible" — they carry no
 * user-visible content and are not rendered.
 *
 * - `step-start` parts are AI SDK step boundary markers that appear between
 *   every auto-send cycle.
 * - Empty text parts (whitespace-only) sometimes appear at step boundaries.
 * - Other assistant parts that this renderer does not display (reasoning,
 *   sources, files, unknown data parts).
 */
function isTransparentPart(part: UIMessage["parts"][number]): boolean {
  if (part.type === "step-start") return true;
  if (isTextUIPart(part) && part.text.trim() === "") return true;
  return !isTextUIPart(part);
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

    if (isTransparentPart(part)) {
      // Skip invisible parts — they carry no user-visible content.
      continue;
    }

    if (isTextUIPart(part)) {
      result.push({ kind: "text", part, index: i });
    }
  }

  return result;
}
