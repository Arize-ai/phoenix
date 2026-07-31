/**
 * A quoted literal, i.e. a quote that opens and closes outside of a word.
 * The word boundaries matter: without them, two apostrophes anywhere in a
 * sentence ("spans that didn't error and weren't retried") read as a string
 * literal, which would misclassify ordinary English as DSL — the direction
 * that actually hurts, since it withholds the AI affordance and asks the
 * validator about prose.
 */
const quotedLiteral =
  /(?<![A-Za-z])'[^']*'(?![A-Za-z])|(?<![A-Za-z])"[^"]*"(?![A-Za-z])/;

const dslSyntax = new RegExp(
  `(==|!=|<=|>=|<|>|${quotedLiteral.source}|\\[|\\bis\\s+(not\\s+)?None\\b)`
);

/**
 * Heuristic for whether typed text reads as a DSL filter expression rather
 * than plain language: comparison operators, quoted literals, subscripts,
 * and `is None` checks are all syntax plain language doesn't produce.
 * Deliberately does NOT key off bare words like "not" or "in", which are
 * as common in English as in the DSL — a miss in that direction merely
 * surfaces the AI affordance on something the user meant as DSL, and
 * Enter still only converts when they ask it to.
 */
export function looksLikeDSLExpression(text: string): boolean {
  return dslSyntax.test(text);
}
