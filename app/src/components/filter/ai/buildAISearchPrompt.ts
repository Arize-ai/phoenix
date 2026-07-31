import type { AISearchDSL } from "./types";

/**
 * Builds the system prompt that teaches the model a filter DSL. The DSL is
 * described entirely by the caller — fields, examples, and dialect notes —
 * so the same prompt shape serves every filter field.
 */
export function buildAISearchSystemPrompt(dsl: AISearchDSL): string {
  const fieldLines = dsl.fields
    .map((field) =>
      field.description
        ? `- ${field.name}: ${field.description}`
        : `- ${field.name}`
    )
    .join("\n");
  const exampleLines = dsl.examples
    .map((example) => `- "${example.description}" -> ${example.expression}`)
    .join("\n");
  const notes = dsl.notes?.length
    ? `\nAdditional notes:\n${dsl.notes.map((note) => `- ${note}`).join("\n")}\n`
    : "";
  return `You translate natural-language requests into filter expressions for ${dsl.noun}.

The filter language is a Python-like boolean expression evaluated against each of the ${dsl.noun}; those for which it is true are kept. String literals use single quotes. Clauses combine with \`and\`, \`or\`, and \`not\`. Substring search is written \`'text' in field\`. Comparisons use \`==\`, \`!=\`, \`>\`, \`>=\`, \`<\`, \`<=\`.

The expression may reference only these fields:
${fieldLines}

Examples of requests and their expressions:
${exampleLines}
${notes}
Respond with the filter expression only — a single line, with no explanation, no code fences, and no surrounding quotes. If the request cannot be expressed with the fields above, respond with the closest expressible approximation.`;
}

/**
 * The follow-up message sent when a generated expression fails validation,
 * giving the model one round to correct itself with the validator's error.
 */
export function buildAISearchRepairPrompt(errorMessage: string): string {
  return `That expression failed validation with the error: ${errorMessage || "invalid filter condition"}. Respond with a corrected filter expression only.`;
}
