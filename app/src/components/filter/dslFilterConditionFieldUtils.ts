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

/** The reduction and quantifier calls a comprehension can appear as the argument of. */
const comprehensionFunctionNames = ["any", "all", "len", "max", "min", "sum"];

const comprehensionCallPattern = new RegExp(
  String.raw`\b(${comprehensionFunctionNames.join("|")})\s*$`
);

const forClauseSource = String.raw`\bfor\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)`;
// Separate instances: a `g` regex carries `lastIndex` across calls, so the
// scanning one must never be the one used for a single match.
const forClausePattern = new RegExp(forClauseSource);
const forClauseScanPattern = new RegExp(forClauseSource, "g");

/**
 * The comprehension the cursor sits inside: which collection is being looped
 * over and under what name. Element fields are written qualified by the loop
 * variable, so `spans`/`s` means the writable names at the cursor are
 * `s.latency_ms`, `s.span_kind`, and so on.
 */
export type DSLFilterComprehensionScope = {
  iterableName: string;
  loopVariable: string;
};

/**
 * Indexes of the unclosed `(` and `[` to the left of the cursor, outermost
 * first. Brackets inside string literals don't count — `'a(b'` opens nothing.
 */
function getUnclosedBracketIndexes(textBeforeCursor: string): number[] {
  const openIndexes: number[] = [];
  let openQuote: "'" | '"' | null = null;
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
      }
      continue;
    }
    if (character === "'" || character === '"') {
      openQuote = character;
      continue;
    }
    if (character === "(" || character === "[") {
      openIndexes.push(index);
    } else if (character === ")" || character === "]") {
      openIndexes.pop();
    }
  }

  return openIndexes;
}

/**
 * The comprehension call whose argument the bracket at `openIndex` opens, or
 * null when it opens something else. Covers both `any(`…`)` directly and the
 * list form `len([`…`])` — `isListForm` distinguishes them.
 */
function getComprehensionCallAt(
  text: string,
  openIndex: number
): DSLFilterComprehensionCall | null {
  const directMatch = text.slice(0, openIndex).match(comprehensionCallPattern);
  if (directMatch?.[1]) {
    return { functionName: directMatch[1], isListForm: false };
  }
  if (text[openIndex] !== "[") {
    return null;
  }
  const beforeBracket = text.slice(0, openIndex).trimEnd();
  if (!beforeBracket.endsWith("(")) {
    return null;
  }
  const listMatch = beforeBracket.slice(0, -1).match(comprehensionCallPattern);
  return listMatch?.[1]
    ? { functionName: listMatch[1], isListForm: true }
    : null;
}

function opensComprehensionArgument(text: string, openIndex: number): boolean {
  return getComprehensionCallAt(text, openIndex) !== null;
}

/** The text from the cursor up to where the enclosing bracket closes. */
function getTextToEnclosingClose(textAfterCursor: string): string {
  let depth = 0;
  for (let index = 0; index < textAfterCursor.length; index++) {
    const character = textAfterCursor[index];
    if (character === "(" || character === "[") {
      depth++;
    } else if (character === ")" || character === "]") {
      if (depth === 0) {
        return textAfterCursor.slice(0, index);
      }
      depth--;
    }
  }
  return textAfterCursor;
}

function findLastForClause(text: string): RegExpMatchArray | null {
  const matches = [...text.matchAll(forClauseScanPattern)];
  return matches[matches.length - 1] ?? null;
}

function findFirstForClause(text: string): RegExpMatchArray | null {
  return text.match(forClausePattern);
}

/**
 * Classifies the comprehension scope at the cursor, or returns null when the
 * cursor isn't in one — or is in one the heuristic can't read.
 *
 * This is deliberately a regex heuristic rather than a parse: a comprehension
 * mid-edit (`any(s. for s in spans)`) is not valid Python, so there is no tree
 * to walk at exactly the moment completion matters. It reads both sides of the
 * cursor because the `for` clause is commonly to the right — accepting the
 * `any(…)` skeleton leaves the cursor on the predicate with `for s in spans`
 * already after it.
 *
 * `isIterableName` decides which collection names exist, so this stays
 * grain-agnostic; the caller supplies them from the served vocabulary. An
 * unrecognized name yields null, which degrades to ordinary completion.
 */
export function detectDSLFilterComprehensionScope({
  textBeforeCursor,
  textAfterCursor,
  isIterableName,
}: {
  textBeforeCursor: string;
  textAfterCursor: string;
  isIterableName: (name: string) => boolean;
}): DSLFilterComprehensionScope | null {
  const openIndexes = getUnclosedBracketIndexes(textBeforeCursor);

  for (let position = openIndexes.length - 1; position >= 0; position--) {
    const openIndex = openIndexes[position];
    if (
      openIndex === undefined ||
      !opensComprehensionArgument(textBeforeCursor, openIndex)
    ) {
      continue;
    }

    // The clause binding this comprehension's loop variable: nearest one to the
    // left when the user has typed past it, otherwise the first one to the
    // right, both bounded by this comprehension's own brackets.
    const bodyBeforeCursor = textBeforeCursor.slice(openIndex + 1);
    const forClause =
      findLastForClause(bodyBeforeCursor) ??
      findFirstForClause(getTextToEnclosingClose(textAfterCursor));
    if (!forClause) {
      return null;
    }

    const loopVariable = forClause[1];
    const iterableExpression = forClause[2]?.replace(/\s+/g, "");
    if (!loopVariable || !iterableExpression) {
      return null;
    }
    // `t.spans` inside a trace comprehension names the same `spans` collection
    // as a top-level `for s in spans` does.
    const iterableName = iterableExpression.slice(
      iterableExpression.lastIndexOf(".") + 1
    );
    return isIterableName(iterableName) ? { iterableName, loopVariable } : null;
  }

  return null;
}

/**
 * The comprehension call enclosing the cursor: which quantifier/reduction it
 * is, and whether its argument was opened in list form (`len([`) rather than
 * as a bare generator (`sum(`).
 */
export type DSLFilterComprehensionCall = {
  functionName: string;
  isListForm: boolean;
};

/**
 * A `for` clause whose iterable position the cursor sits in — the loop
 * variable is already written, the collection name is absent or mid-typed:
 * `any(s.latency_ms > 100 for s in spa`. The only names that can go here are
 * collections, so completion should offer exactly those (as plain names — a
 * scaffold would nest a second comprehension into this one).
 */
const forClauseTargetPattern = new RegExp(
  String.raw`\bfor\s+([A-Za-z_]\w*)\s+in(?:\s+(?:[A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]?\w*)*)?)?$`
);

/**
 * Detects whether the cursor sits in the iterable position of a comprehension
 * `for` clause, and under which loop variable. Returns null anywhere else —
 * including inside the same comprehension's predicate or `if` clause.
 */
export function detectDSLFilterForClauseTarget({
  textBeforeCursor,
}: {
  textBeforeCursor: string;
}): { loopVariable: string } | null {
  const openIndexes = getUnclosedBracketIndexes(textBeforeCursor);

  for (let position = openIndexes.length - 1; position >= 0; position--) {
    const openIndex = openIndexes[position];
    if (
      openIndex === undefined ||
      !opensComprehensionArgument(textBeforeCursor, openIndex)
    ) {
      continue;
    }
    const match = textBeforeCursor
      .slice(openIndex + 1)
      .match(forClauseTargetPattern);
    const loopVariable = match?.[1];
    return loopVariable ? { loopVariable } : null;
  }

  return null;
}

/**
 * The innermost comprehension call enclosing the cursor, or null when the
 * cursor isn't inside one. Detects the moment a user has typed `any(` or
 * `sum(` by hand and has yet to write the comprehension — the window where
 * completion can offer whole comprehension bodies.
 */
export function detectDSLFilterComprehensionCall({
  textBeforeCursor,
}: {
  textBeforeCursor: string;
}): DSLFilterComprehensionCall | null {
  const openIndexes = getUnclosedBracketIndexes(textBeforeCursor);

  for (let position = openIndexes.length - 1; position >= 0; position--) {
    const openIndex = openIndexes[position];
    if (openIndex === undefined) {
      continue;
    }
    const call = getComprehensionCallAt(textBeforeCursor, openIndex);
    if (call) {
      return call;
    }
  }

  return null;
}

/**
 * The span of the first comprehension in `condition`, used to anchor an error
 * to the region it most likely came from. Best-effort: the server's syntax
 * errors carry no offsets, so this points at the construct rather than at the
 * character.
 */
export function findDSLFilterComprehensionRange(
  condition: string
): { from: number; to: number } | null {
  const callMatch = condition.match(
    new RegExp(String.raw`\b(?:${comprehensionFunctionNames.join("|")})\s*\(`)
  );
  if (callMatch?.index === undefined) {
    return null;
  }
  const from = callMatch.index;
  const afterOpen = callMatch.index + callMatch[0].length;
  const closeOffset = getTextToEnclosingClose(
    condition.slice(afterOpen)
  ).length;
  const to = Math.min(afterOpen + closeOffset + 1, condition.length);
  return { from, to };
}

/**
 * The cursor context a completion source is answering for. `textAfterCursor`
 * matters for comprehensions, whose `for` clause commonly sits to the right of
 * the predicate being typed.
 */
export type DSLFilterCompletionRequest = {
  /**
   * The dropdown is open with nothing typed at the cursor, so there's no query
   * to narrow the options — sources may return a curated subset.
   */
  isBrowsing: boolean;
  textBeforeCursor: string;
  textAfterCursor: string;
};

/**
 * Builds a CodeMirror completion source over the given DSL vocabulary, with
 * the token and string-literal awareness the filter DSL needs. `getOptions`
 * may be async (e.g. real values fetched from the server); each source
 * resolves independently so slow options don't block the rest of the
 * dropdown.
 */
export function createDSLFilterCompletionSource(
  getOptions: (
    request: DSLFilterCompletionRequest
  ) => Completion[] | Promise<Completion[]>
): CompletionSource {
  return async (
    context: CompletionContext
  ): Promise<CompletionResult | null> => {
    const textBeforeCursor = context.state.doc.sliceString(0, context.pos);
    const textAfterCursor = context.state.doc.sliceString(context.pos);
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

    const isBrowsing = word.from === word.to;

    let options: Completion[];
    try {
      options = await getOptions({
        isBrowsing,
        textBeforeCursor,
        textAfterCursor,
      });
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
