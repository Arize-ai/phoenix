import { appendPathSegment } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import type { CodeEvaluatorLanguage } from "@phoenix/types";
import { unescapeQuotedPathKey } from "@phoenix/utils/objectUtils";

/**
 * A JavaScript identifier, which admits `$` where a JSONPath segment does not.
 * These read and write source code, so they must stay the language's rule
 * rather than the path notation's.
 */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const WHOLE_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Everything a member expression can be written with, in either language. */
const EXPRESSION_CHARS = /[A-Za-z0-9_$."'?[\]\\]/;
const COMPLETE_SUBSCRIPT_PATTERN =
  /^\[\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\d+))\s*\]/;
const PARTIAL_SUBSCRIPT_PATTERN =
  /^\[\s*(?:"((?:[^"\\]|\\.)*)|'((?:[^'\\]|\\.)*)|(\d*))$/;

/**
 * The member expression the cursor sits in, read in the editor's own syntax.
 *
 * `containerPath` is canonical path notation — the same notation the mapping
 * source is walked with — so one member walker serves both editors, while
 * `accessorFrom` marks where the language-specific accessor being replaced
 * starts (`.`, `?.` or `[`).
 */
export type CodeEvaluatorMemberCursor = {
  containerPath: string;
  /** The member name typed so far; what the typeahead matches against. */
  partial: string;
  /** Document offset the partial starts at. */
  from: number;
  /** Document offset the whole accessor starts at. */
  accessorFrom: number;
  /** Document offset the member expression starts at. */
  expressionFrom: number;
};

/**
 * Reads the member access being typed to the left of the cursor.
 *
 * Returns null when the text is not a member access — a bare name is the body's
 * root completion, not a drill into something.
 */
export function getCodeEvaluatorMemberCursor(
  textBeforeCursor: string
): CodeEvaluatorMemberCursor | null {
  let start = textBeforeCursor.length;
  while (start > 0 && EXPRESSION_CHARS.test(textBeforeCursor[start - 1])) {
    start -= 1;
  }
  const expression = textBeforeCursor.slice(start);
  const root = IDENTIFIER_PATTERN.exec(expression);
  if (root === null) {
    return null;
  }

  let path = root[0];
  let offset = root[0].length;
  while (offset < expression.length) {
    const rest = expression.slice(offset);

    if (rest.startsWith(".") || rest.startsWith("?.")) {
      const operatorLength = rest.startsWith("?.") ? 2 : 1;
      const name = IDENTIFIER_PATTERN.exec(rest.slice(operatorLength));
      const key = name?.[0] ?? "";
      if (operatorLength + key.length === rest.length) {
        return {
          containerPath: path,
          partial: key,
          from: start + offset + operatorLength,
          accessorFrom: start + offset,
          expressionFrom: start,
        };
      }
      if (name === null) {
        return null;
      }
      path = appendPathSegment(path, key, false);
      offset += operatorLength + key.length;
      continue;
    }

    if (rest.startsWith("[")) {
      const complete = COMPLETE_SUBSCRIPT_PATTERN.exec(rest);
      if (complete) {
        const [matched, doubleQuoted, singleQuoted, index] = complete;
        const key = unescapeQuotedPathKey(doubleQuoted ?? singleQuoted ?? index);
        path = appendPathSegment(path, key, index !== undefined);
        offset += matched.length;
        continue;
      }
      const partial = PARTIAL_SUBSCRIPT_PATTERN.exec(rest);
      if (partial === null) {
        return null;
      }
      const [, doubleQuoted, singleQuoted, index] = partial;
      const quoted = doubleQuoted ?? singleQuoted;
      return {
        containerPath: path,
        partial: unescapeQuotedPathKey(quoted ?? index ?? ""),
        // The typeahead matches the key alone, so it starts inside the quote.
        from: start + offset + (quoted === undefined ? 1 : 2),
        accessorFrom: start + offset,
        expressionFrom: start,
      };
    }

    return null;
  }

  return null;
}

/**
 * The accessor that reads `key`, written the way the editor's language reads
 * it.
 *
 * Python dicts are only subscriptable, so every key is bracketed there; a
 * dotted insert would be code that cannot run. TypeScript reads identifiers
 * with a dot and falls back to a subscript for anything else, and reaches for
 * `?.` wherever the sampled record shows nothing at the key — the one place
 * this side knows the access may not survive another record.
 */
export function toCodeEvaluatorAccessor({
  language,
  key,
  isIndex,
  isAbsent,
}: {
  language: CodeEvaluatorLanguage;
  key: string;
  isIndex: boolean;
  isAbsent: boolean;
}): string {
  if (isIndex) {
    return `[${key}]`;
  }
  if (language === "PYTHON") {
    return `[${JSON.stringify(key)}]`;
  }
  const optional = isAbsent ? "?." : "";
  return WHOLE_IDENTIFIER_PATTERN.test(key)
    ? `${isAbsent ? "?." : "."}${key}`
    : `${optional}[${JSON.stringify(key)}]`;
}

