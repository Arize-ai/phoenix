export type DslStringQuote = '"' | "'";

/**
 * Joins two filter expressions without changing either expression's boolean
 * precedence.
 */
export function joinFilterConditions({
  existingCondition,
  nextCondition,
}: {
  existingCondition: string;
  nextCondition: string;
}): string {
  if (!existingCondition) {
    return nextCondition;
  }
  return `(${existingCondition}) and (${nextCondition})`;
}

/**
 * Serializes a value as a quoted Python-style DSL string literal.
 */
export function getDslStringLiteral({
  value,
  quote,
}: {
  value: string;
  quote: DslStringQuote;
}): string {
  const escapedValue = value
    .replaceAll("\\", "\\\\")
    .replaceAll(quote, `\\${quote}`);
  return `${quote}${escapedValue}${quote}`;
}
