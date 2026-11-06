/**
 * Normalizes a filter expression for comparison: cosmetic differences a
 * model may legitimately produce (double quotes, numeric underscores,
 * whitespace, a trailing terminator) are erased; anything semantic is left
 * alone so a real mismatch still misses.
 */
export function normalizeFilterExpression(expression: string): string {
  return expression
    .replace(/"((?:[^"\\]|\\.)*)"/g, "'$1'")
    .replace(/(\d)_(?=\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;.]+$/, "");
}

/**
 * Whether the expression, after normalization, is one of the accepted
 * reference expressions for a case.
 */
export function matchesAcceptedExpression(
  expression: string,
  accepted: readonly string[]
): boolean {
  const normalized = normalizeFilterExpression(expression);
  return accepted.some(
    (candidate) => normalizeFilterExpression(candidate) === normalized
  );
}
