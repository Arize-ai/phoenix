export type DslStringQuote = '"' | "'";

/** Joins two filter expressions without changing either expression's boolean precedence. */
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

const DSL_STRING_ESCAPES: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
  "\v": "\\v",
};

/** C0 controls plus DEL — none of which may appear raw inside a DSL string literal. */
const DSL_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/gu;

/**
 * Serializes a value as a quoted Python-style DSL string literal.
 *
 * Literals are built from user-authored text such as annotation labels, so a stray newline
 * or control character has to survive as an escape — the parser rejects a literal holding a
 * raw one, and an unterminated literal takes the whole expression down with it.
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
    .replaceAll(quote, `\\${quote}`)
    .replaceAll(DSL_CONTROL_CHARACTERS, (character) => {
      const escape = DSL_STRING_ESCAPES[character];
      if (escape !== undefined) {
        return escape;
      }
      const codePoint = character.codePointAt(0) ?? 0;
      return `\\x${codePoint.toString(16).padStart(2, "0")}`;
    });
  return `${quote}${escapedValue}${quote}`;
}
