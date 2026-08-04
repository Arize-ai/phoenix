import type { AIQueryDSL } from "./types";

/**
 * Builds the system prompt that teaches the model a filter DSL. The DSL is
 * described entirely by the caller — fields, examples, and dialect notes —
 * so the same prompt shape serves every filter field.
 *
 * Only syntax both dialects share is stated here. Anything one dialect has
 * and the other lacks (span filters take membership lists and chained
 * ranges; experiment run filters take neither) belongs in that DSL's notes,
 * or the prompt teaches half its readers an expression their parser rejects.
 */
export function buildAIQuerySystemPrompt(dsl: AIQueryDSL): string {
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
    ? `\nNotes on this data:\n${dsl.notes.map((note) => `- ${note}`).join("\n")}\n`
    : "";
  return `You translate a natural-language request into one filter expression for ${dsl.noun}.

A filter is a Python-like boolean expression evaluated against each of the ${dsl.noun}; those it is true for are kept.

Syntax:
- Comparisons are ==, !=, >, >=, <, <=, and string literals use single quotes.
- Clauses combine with \`and\`, \`or\`, and \`not\`. Parenthesize when mixing \`and\` with \`or\`.
- Substring search is written \`'text' in field\`, and it is case-sensitive.
- A missing value is tested with \`is None\`, a present one with \`is not None\`. An empty text value is \`== ''\` — never a guessed serialization like \`'[]'\`.

An expression may reference only these fields:
${fieldLines}
${notes}
Examples:
${exampleLines}

Your answer:
- The expression alone — one line, no explanation, no code fences, no surrounding quotes.
- Use the values the request gives you verbatim. A key, name, or label the user typed is what the data holds; do not correct its spelling or casing.
- Verbatim applies to identifiers, not phrasing. A substring search over free text like an error or status message matches on the term's root form: a request about calls that timed out searches for 'timeout'.
- Translate every part of the request. A request that states three facts is three clauses joined with \`and\`.
- Write the narrowest expression that answers the request. Never add an \`or\` over a field the request did not name, an equality a substring test already covers, or an \`is not None\` guard on a field another clause already compares or searches.
- When the request implies a threshold without giving one, choose a sensible default — "slow" is latency over 10 seconds.
- A filter cannot sort, rank, or limit. "the slowest", with or without a count, is the default slow threshold; drop the count.
- When the request cannot be expressed with the fields above, answer with the closest expressible approximation rather than inventing a field.`;
}

/**
 * The follow-up message sent when a generated expression fails validation,
 * giving the model one round to correct itself with the validator's error.
 */
export function buildAIQueryRepairPrompt(errorMessage: string): string {
  return `That expression failed validation with the error: ${errorMessage || "invalid filter condition"}. Respond with a corrected filter expression only.`;
}
