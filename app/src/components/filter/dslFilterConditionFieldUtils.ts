import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

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

/**
 * CodeMirror's `validFor` guard for the token returned by
 * `getDSLFilterCompletionTokenBeforeCursor`. If the user keeps typing inside
 * a valid DSL accessor prefix, CodeMirror can filter the existing completion
 * result instead of asking every completion source to recompute.
 */
export const validDSLFilterCompletionTokenPattern = new RegExp(
  String.raw`^(?:${dslFilterTokenPattern.source})?$`
);

/**
 * The editable token range CodeMirror should replace when accepting a DSL
 * completion. `text` is the partial token at the cursor, and `from`/`to` are
 * offsets in the current document.
 */
export type DSLFilterCompletionToken = {
  from: number;
  to: number;
  text: string;
};

/**
 * Returns the DSL accessor token immediately before the cursor.
 *
 * The span filter DSL allows partially typed dotted members and subscripts:
 * `input.`, `annotations['Human Fee`, and
 * `attributes['llm']['input_messages'][0]['message'].` are all valid
 * completion prefixes. Keeping the whole prefix is important because
 * CodeMirror replaces this range when a completion is accepted; if the matcher
 * drops an existing subscript or trailing dot, accepting a suggestion can
 * duplicate the accessor instead of completing it.
 */
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

/**
 * Finds an unmatched quote before the cursor while respecting backslash
 * escapes. This is intentionally lightweight: it only needs enough string
 * awareness to avoid offering field completions while the user is typing a
 * literal value such as `== 'application/js`.
 */
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

/**
 * Determines whether normal field completions should be suppressed because
 * the cursor is inside a string literal value.
 *
 * A quoted subscript such as `annotations['Human Fee` should still complete
 * because the string starts inside the token being replaced. A value literal
 * such as `span_kind == 'LL` should not show field completions because the
 * open quote starts before the current token.
 */
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

/**
 * Builds a CodeMirror completion source over the given DSL vocabulary, with
 * the token and string-literal awareness the filter DSL needs. `getOptions`
 * may be async (e.g. real values fetched from the server); each source
 * resolves independently so slow options don't block the rest of the
 * dropdown.
 */
export function createDSLFilterCompletionSource(
  getOptions: (isBrowsing: boolean) => Completion[] | Promise<Completion[]>
): CompletionSource {
  return async (
    context: CompletionContext
  ): Promise<CompletionResult | null> => {
    const textBeforeCursor = context.state.doc.sliceString(0, context.pos);
    const word = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    if (word.from === word.to && !context.explicit) return null;
    if (
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: word.from,
      })
    ) {
      return null;
    }

    // Browsing: the dropdown is open with nothing typed at the cursor, so
    // there's no query to narrow the options — sources may return a curated
    // subset rather than everything
    const isBrowsing = word.from === word.to;

    let options: Completion[];
    try {
      options = await getOptions(isBrowsing);
    } catch {
      // completions are a progressive enhancement — degrade silently
      return null;
    }
    if (options.length === 0) return null;

    return {
      from: word.from,
      options,
      // A browse result may be a curated subset — force a fresh query on
      // the next keystroke rather than letting CodeMirror filter the subset
      // in place, so typing matches against the full vocabulary
      validFor: isBrowsing ? undefined : validDSLFilterCompletionTokenPattern,
    };
  };
}
