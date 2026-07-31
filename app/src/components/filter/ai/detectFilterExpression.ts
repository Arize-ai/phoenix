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
  return /(==|!=|<=|>=|<|>|'[^']*'|"[^"]*"|\[|\bis\s+(not\s+)?None\b)/.test(
    text
  );
}
