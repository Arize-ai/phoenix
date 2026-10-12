import type { ModelMessage } from "ai";

import { formatTemplate } from "../template";
import type { WithPrompt } from "../types/prompts";
import type { PromptTemplate, TemplateVariables } from "../types/templating";

/**
 * What a decision model is asked: `instructions` for the single choice
 * question, and the text it should judge as the shared `state`.
 */
export type DecisionPrompt = {
  instructions: string;
  state: string;
};

/**
 * Used when the prompt can't be split into a rubric and the data it applies to.
 */
export const GENERIC_DECISION_INSTRUCTIONS =
  "Read the prompt in the state and answer it by selecting exactly one of the choices.";

const DATA_OPEN = "<data>";
const DATA_CLOSE = "</data>";

/**
 * Build a decision prompt from an unrendered prompt template.
 *
 * Templates with exactly one `<data>…</data>` block (every built-in
 * evaluator) are split: the rubric around the block becomes the question
 * instructions and the rendered block becomes the state. The split is done
 * before rendering so a `<data>` tag inside a variable can't move it.
 * Other templates, and templates whose Mustache sections span the block's
 * boundary (so the pieces can't be rendered on their own), are rendered
 * and sent as one plain-text state with generic instructions.
 */
export function templateToDecisionPrompt(args: {
  template: PromptTemplate;
  variables: TemplateVariables;
}): DecisionPrompt {
  const { template, variables } = args;
  const text = promptTemplateToText(template);
  const blocks = findDataBlocks(text);
  if (blocks.length === 1) {
    try {
      return splitAtDataBlock({ text, block: blocks[0]!, variables });
    } catch {
      // A section opened on one side of the block and closed on the other
      // makes the pieces invalid Mustache. Fall through to rendering the
      // whole template, which still throws if the template itself is invalid.
    }
  }
  return {
    instructions: GENERIC_DECISION_INSTRUCTIONS,
    state: render(text, variables),
  };
}

type TextSpan = { start: number; end: number };

/**
 * Find each `<data>…</data>` block, pairing every opening tag with the next
 * closing tag. Scans with `indexOf` rather than a lazy regex, which would
 * backtrack quadratically on text with many unclosed `<data>` tags.
 */
function findDataBlocks(text: string): TextSpan[] {
  const blocks: TextSpan[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(DATA_OPEN, from);
    if (start === -1) break;
    const close = text.indexOf(DATA_CLOSE, start + DATA_OPEN.length);
    if (close === -1) break;
    const end = close + DATA_CLOSE.length;
    blocks.push({ start, end });
    from = end;
  }
  return blocks;
}

function splitAtDataBlock(args: {
  text: string;
  block: TextSpan;
  variables: TemplateVariables;
}): DecisionPrompt {
  const { text, block, variables } = args;
  const { start, end } = block;
  const instructions = [text.slice(0, start), text.slice(end)]
    .map((part) => render(part, variables).trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
  return {
    instructions: instructions || GENERIC_DECISION_INSTRUCTIONS,
    state: render(text.slice(start, end), variables),
  };
}

/**
 * Build a decision prompt from an already rendered AI SDK prompt, for
 * callers of `generateClassification` that pass a prompt directly.
 * System text, instructions and messages are joined into one plain-text
 * state, since decision models have no roles.
 */
export function renderedPromptToDecisionPrompt(
  prompt: WithPrompt
): DecisionPrompt {
  const parts: string[] = [];
  const { instructions, system, messages, prompt: promptContent } = prompt;
  for (const value of [instructions, system]) {
    if (value !== undefined) parts.push(instructionsToText(value));
  }
  if (typeof promptContent === "string") {
    parts.push(promptContent);
  } else if (Array.isArray(promptContent)) {
    parts.push(messagesToText(promptContent));
  }
  if (messages !== undefined) parts.push(messagesToText(messages));
  return {
    instructions: GENERIC_DECISION_INSTRUCTIONS,
    state: parts.filter((part) => part.length > 0).join("\n\n"),
  };
}

function render(template: string, variables: TemplateVariables): string {
  return formatTemplate({ template, variables }) as string;
}

function promptTemplateToText(template: PromptTemplate): string {
  return typeof template === "string" ? template : messagesToText(template);
}

function messagesToText(messages: readonly ModelMessage[]): string {
  return messages
    .map((message) => contentToText(message.content))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function instructionsToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "content" in item
          ? contentToText(item.content)
          : ""
      )
      .filter((text) => text.length > 0)
      .join("\n\n");
  }
  if (typeof value === "object" && value !== null && "content" in value) {
    return contentToText(value.content);
  }
  return "";
}

/**
 * Keep only the text of a message. Decision models judge text here; image
 * and file parts are not forwarded.
 */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : ""
    )
    .filter((text) => text.length > 0)
    .join("\n");
}
