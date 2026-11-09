/**
 * The token kinds a JSON document is made of, plus `text` for anything that is
 * not JSON, so a preview with a trailing note still renders in one pass.
 */
export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "literal"
  | "punctuation"
  | "text";

export type JsonToken = { kind: JsonTokenKind; text: string };

const LITERAL = /^(true|false|null)\b/;

const NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/;

/**
 * Splits pretty-printed JSON into highlightable tokens without parsing it, so
 * a truncated document or a plain-text line tokenizes too. Whitespace joins
 * the neighbouring `text` token. Much cheaper than an editor for read-only
 * cells that only ever show a screenful.
 */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let index = 0;

  const push = (kind: JsonTokenKind, value: string) => {
    const last = tokens[tokens.length - 1];

    if (
      last &&
      last.kind === kind &&
      (kind === "text" || kind === "punctuation")
    )
      last.text += value;
    else tokens.push({ kind, text: value });
  };

  while (index < text.length) {
    const char = text[index];

    if (char === '"') {
      const end = findStringEnd(text, index);
      const value = text.slice(index, end);
      const isKey = /^\s*:/.test(text.slice(end));
      push(isKey ? "key" : "string", value);
      index = end;
    } else if ("{}[],:".includes(char)) {
      push("punctuation", char);
      index += 1;
    } else if (/\s/.test(char)) {
      push("text", char);
      index += 1;
    } else {
      const rest = text.slice(index);
      const literal = LITERAL.exec(rest);
      const number = literal ? null : NUMBER.exec(rest);
      const match = literal?.[0] ?? number?.[0];

      if (match) {
        push(literal ? "literal" : "number", match);
        index += match.length;
      } else {
        // Anything else (a note appended to a truncated preview, say) runs to
        // the end of its line as plain text.
        const lineEnd = text.indexOf("\n", index);
        const end = lineEnd === -1 ? text.length : lineEnd;
        push("text", text.slice(index, end));
        index = end;
      }
    }
  }

  return tokens;
}

/** The index just past the closing quote, or the end of the text if unclosed. */
function findStringEnd(text: string, start: number): number {
  let index = start + 1;

  while (index < text.length) {
    if (text[index] === "\\") index += 2;
    else if (text[index] === '"') return index + 1;
    else index += 1;
  }

  return text.length;
}
