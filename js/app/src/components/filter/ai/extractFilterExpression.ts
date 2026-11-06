/**
 * The answer tag the prompt asks the model to wrap its expression in (see
 * `buildAIQuerySystemPrompt`'s output format). This module is the only
 * parser of that contract — callers never match the tag themselves.
 */
const EXPRESSION_OPEN_PATTERN = /<expression>/i;

/**
 * Extracts the expression a streamed partial has produced so far, or
 * `null` while the answer has not begun. The prompt asks for reasoning
 * before the <expression> tag — possibly as untagged prose — so until the
 * tag opens, any text is (or may be) reasoning that must never surface in
 * the field. A model that skips the format entirely streams no preview;
 * its finished answer still lands through {@link extractFilterExpression}.
 */
export function extractStreamedFilterExpression(text: string): string | null {
  if (!EXPRESSION_OPEN_PATTERN.test(text)) {
    return null;
  }
  return extractFilterExpression(text);
}

/**
 * Normalizes raw model output into a single-line filter expression.
 *
 * Extraction prefers the answer inside <expression> tags and never surfaces
 * the reasoning before it. Models that ignore the format (smaller ones
 * especially) still get their bare answers through: code fences, labels
 * like "Expression:", and wrapping backticks are stripped without touching
 * the expression itself.
 */
export function extractFilterExpression(text: string): string {
  let expression = text.trim();
  const openTag = EXPRESSION_OPEN_PATTERN.exec(expression);
  if (openTag !== null) {
    // Everything before the tag is reasoning; everything after it up to the
    // closing tag (which a streamed partial may not have yet) is the answer
    expression = expression.slice(openTag.index + openTag[0].length);
    const closeIndex = expression.search(/<\/expression/i);
    if (closeIndex !== -1) {
      expression = expression.slice(0, closeIndex);
    }
    expression = expression.trim();
  } else {
    // No answer tag (yet). Drop any completed reasoning block, and while
    // reasoning is still streaming — an unclosed <thinking>, or the first
    // characters of a tag — there is no expression to show.
    expression = expression
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .trim();
    if (/<thinking>/i.test(expression) || expression.startsWith("<")) {
      return "";
    }
  }
  // A streamed partial can end mid-way through a closing tag ("</expres"):
  // strip it so it never flashes in the field. The DSL itself can never
  // contain "</" — `<` is always followed by whitespace or an operand.
  expression = expression.replace(/<\/[a-z]*$/i, "").trim();
  // Unwrap a markdown code fence, with or without a language tag. The
  // closing fence is optional so a streamed partial unwraps too — otherwise
  // the fence would sit visibly in the field until the stream finishes.
  const fenceMatch = expression.match(/^```[^\n`]*\n?([\s\S]*?)(?:```)?$/);
  if (fenceMatch) {
    expression = fenceMatch[1].trim();
  }
  // Drop a leading label like "Expression:" or "Filter:"
  expression = expression.replace(
    /^(?:filter(?: expression)?|expression|condition)\s*:\s*/i,
    ""
  );
  // Unwrap single backticks around the whole expression
  const backtickMatch = expression.match(/^`([^`]*)`$/);
  if (backtickMatch) {
    expression = backtickMatch[1];
  }
  // The DSL is single-line; a multi-line answer is an expression wrapped by
  // the model, not a multi-line expression
  return expression.replace(/\s*\n\s*/g, " ").trim();
}
