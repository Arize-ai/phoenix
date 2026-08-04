/**
 * Normalizes raw model output into a single-line filter expression. Models
 * are instructed to answer with the bare expression, but smaller ones (the
 * on-device browser model in particular) still wrap answers in code fences
 * or prefix them with a label — strip the framing without touching the
 * expression itself.
 */
export function extractFilterExpression(text: string): string {
  let expression = text.trim();
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
