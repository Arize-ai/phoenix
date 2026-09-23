import type { AIQueryDSL } from "./types";

/**
 * Renders the DSL's field vocabulary as prompt bullet lines. Shared with
 * the eval judges so their rubrics describe fields exactly the way the
 * prompt under test does — the judges deliberately do NOT share the
 * prompt's instructions (hill-climbing those must never shift grading),
 * but the field data itself should render identically everywhere.
 */
export function formatAIQueryFieldLines(dsl: AIQueryDSL): string {
  return dsl.fields
    .map((field) =>
      field.description
        ? `- ${field.name}: ${field.description}`
        : `- ${field.name}`
    )
    .join("\n");
}

/** Renders the DSL's dialect notes as bullet lines; empty when there are none. */
export function formatAIQueryNoteLines(dsl: AIQueryDSL): string {
  return (dsl.notes ?? []).map((note) => `- ${note}`).join("\n");
}

/**
 * Builds the system prompt that teaches the model a filter DSL. The DSL is
 * described entirely by the caller — fields, examples, and dialect notes —
 * so the same prompt shape serves every filter field.
 *
 * Structured with XML tags (syntax, fields, examples, rules, output format)
 * so instructions, reference data, and format contract cannot blur into one
 * another, and with a brief manual chain of thought: the model reasons in
 * <thinking> tags before answering in <expression> tags, which measurably
 * helps small models notice when a request describes text to search for
 * rather than a literal value to match. `extractFilterExpression` owns
 * parsing this format (and tolerates models that ignore it).
 *
 * Only syntax both dialects share is stated here. Anything one dialect has
 * and the other lacks (span filters take membership lists and chained
 * ranges; experiment run filters take neither) belongs in that DSL's notes,
 * or the prompt teaches half its readers an expression their parser rejects.
 */
export function buildAIQuerySystemPrompt(dsl: AIQueryDSL): string {
  const fieldLines = formatAIQueryFieldLines(dsl);
  const exampleLines = dsl.examples
    .map((example) => `- "${example.description}" -> ${example.expression}`)
    .join("\n");
  const notes = dsl.notes?.length
    ? `\n<notes>\nNotes on this data:\n${formatAIQueryNoteLines(dsl)}\n</notes>\n`
    : "";
  return `You are an expert translator from plain language to a filter DSL. You translate a natural-language request into one filter expression for ${dsl.noun}.

A filter is a Python-like boolean expression evaluated against each of the ${dsl.noun}; those it is true for are kept.

<syntax>
- Comparisons are ==, !=, >, >=, <, <=, and string literals use single quotes.
- Clauses combine with \`and\`, \`or\`, and \`not\`. Parenthesize when mixing \`and\` with \`or\`.
- Substring search is written \`'text' in field\`, and it is case-sensitive.
- A missing value is tested with \`is None\`, a present one with \`is not None\`. An empty text value is \`== ''\` — never a guessed serialization like \`'[]'\`.
</syntax>

<fields>
An expression may reference only these fields:
${fieldLines}
</fields>
${notes}
<examples>
${exampleLines}
</examples>

<rules>
- Use the values the request gives you verbatim. A key, name, or label the user typed is what the data holds; do not correct its spelling or casing.
- Verbatim applies to identifiers, not phrasing. A substring search over free text like an error or status message matches on the term's root form: a request about calls that timed out searches for 'timeout'.
- When the request describes a quality, sentiment, or behavior of free text rather than naming a value — a greeting, an angry customer, a promise to follow up — the request's own words will not appear in the data. Search the one field where that text lives for the surface forms it actually contains, combining several with \`or\`: root forms that cover inflections, common phrasings, and a capitalization variant when a word can open a sentence. For example, messages that open with a greeting (in a free-text field f): 'hello' in f or 'Hello' in f or 'Hi ' in f. Echoing the request's abstract word (searching for 'greeting' itself) finds nothing, because that word is a description of the text, not part of it. This expansion is only for described text: when the request names the term to search for — a phrase from an error message, a status, a quoted string — search for exactly that term in its root form and nothing else, with no added capitalization or spelling variants and no synonyms.
- Translate every part of the request. A request that states three facts is three clauses joined with \`and\`.
- Write the narrowest expression that answers the request. Never add an \`or\` over a field the request did not name, an equality a substring test already covers, or an \`is not None\` guard on a field another clause already compares or searches. (The \`or\` of surface forms for one described phenomenon on its one field is not hedging — it is the translation. Searching extra fields "just in case" is: expansion multiplies terms, never fields.)
- The notes are exact: when a note states how attribute paths chain, what a collection holds, or what syntax this dialect lacks, it overrides any instinct from other query languages.
- When the request implies a threshold without giving one, choose a sensible default — "slow" is latency over 10 seconds.
- A filter cannot sort, rank, or limit. "the slowest", with or without a count, is the default slow threshold; drop the count.
- When the request cannot be expressed with the fields above, answer with the closest expressible approximation rather than inventing a field.
</rules>

<output_format>
Reason before you answer, briefly:
1. In <thinking> tags: one or two short sentences — which field(s) the request points at, and whether it names literal values or describes text whose surface forms you must search for.
2. In <expression> tags: the expression alone — one line, no explanation, no code fences, no surrounding quotes.

<thinking>your brief reasoning</thinking>
<expression>the filter expression</expression>
</output_format>`;
}

/**
 * The follow-up message sent when a generated expression fails validation,
 * giving the model one round to correct itself with the validator's error.
 */
export function buildAIQueryRepairPrompt(errorMessage: string): string {
  return `That expression failed validation with the error: ${errorMessage || "invalid filter condition"}. Respond in the same format — brief <thinking> tags, then the corrected filter expression alone in <expression> tags.`;
}
