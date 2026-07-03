const quotedSubscriptPattern = String.raw`(?:"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)`;
const integerSubscriptPattern = String.raw`\d+`;
const subscriptPattern = String.raw`\[(?:${quotedSubscriptPattern}|${integerSubscriptPattern})?\]?`;
const dottedMemberPattern = String.raw`\.(?:[A-Za-z_]\w*)?`;

/**
 * The DSL token under construction directly before the cursor: a dotted
 * identifier optionally followed by string or integer subscripts and a trailing
 * member access — e.g. `annotations['quality'].la`. The subscript must be part
 * of the match: accepting a completion replaces exactly this range, so matching
 * only `[\w.]*` would leave an already-typed `annotations['quality']` in place
 * and double it up.
 */
const dslFilterTokenPattern = new RegExp(
  String.raw`[A-Za-z_]\w*(?:(?:${dottedMemberPattern})|(?:${subscriptPattern}))*`
);
const tokenBeforeCursorPattern = new RegExp(
  String.raw`${dslFilterTokenPattern.source}$`
);

export const validDSLFilterCompletionTokenPattern = new RegExp(
  String.raw`^(?:${dslFilterTokenPattern.source})?$`
);

export type DSLFilterCompletionToken = {
  from: number;
  to: number;
  text: string;
};

export function getDSLFilterCompletionTokenBeforeCursor(
  textBeforeCursor: string
): DSLFilterCompletionToken {
  const tokenMatch = textBeforeCursor.match(tokenBeforeCursorPattern);
  const text = tokenMatch?.[0] ?? "";
  return {
    from: textBeforeCursor.length - text.length,
    to: textBeforeCursor.length,
    text,
  };
}

function getOpenStringStartBeforeCursor(
  textBeforeCursor: string
): number | null {
  let openQuote: "'" | '"' | null = null;
  let openQuoteIndex: number | null = null;
  let isEscaped = false;

  for (let index = 0; index < textBeforeCursor.length; index++) {
    const character = textBeforeCursor[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (character === "\\") {
      isEscaped = true;
      continue;
    }
    if (openQuote) {
      if (character === openQuote) {
        openQuote = null;
        openQuoteIndex = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      openQuote = character;
      openQuoteIndex = index;
    }
  }

  return openQuoteIndex;
}

export function shouldSuppressDSLFilterCompletionsInString({
  textBeforeCursor,
  tokenFrom,
}: {
  textBeforeCursor: string;
  tokenFrom: number;
}): boolean {
  const openStringStart = getOpenStringStartBeforeCursor(textBeforeCursor);
  if (openStringStart === null) {
    return false;
  }
  return openStringStart < tokenFrom;
}
