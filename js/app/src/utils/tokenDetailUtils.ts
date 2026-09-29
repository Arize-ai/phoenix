/**
 * Shared presentation rules for token types (`input`, `cache_read`, ...), so a
 * token type reads and looks the same wherever it is broken out — the model
 * charts, the time series, and the cost/token tooltips.
 */

import type { useCategoryChartColors } from "@phoenix/components/chart";

import { isPositiveNumber } from "./numberUtils";

type CategoryChartColors = ReturnType<typeof useCategoryChartColors>;

/**
 * Costs and token counts are summed from floating point values, so a value
 * this small is noise left over from the arithmetic rather than real usage.
 */
export const TOKEN_DETAIL_EPSILON = 1e-9;

const TOKEN_DETAIL_SORT_ORDER: Partial<Record<string, number>> = {
  input: 0,
  output: 0,
  cache_read: 1,
  cache_write: 2,
  reasoning: 3,
  audio: 4,
};

const TOKEN_DETAIL_COLORS: Partial<Record<string, keyof CategoryChartColors>> =
  {
    input: "category1",
    output: "category2",
    cache_read: "category9",
    cache_write: "category7",
    reasoning: "category4",
    audio: "category3",
  };

/** The colors used for token types with no semantic color of their own. */
const TOKEN_DETAIL_FALLBACK_COLORS = [
  "category5",
  "category6",
  "category8",
  "category10",
  "category11",
  "category12",
] as const satisfies readonly (keyof CategoryChartColors)[];

/**
 * Converts a snake-case token type into a user-facing label.
 *
 * Sentence case rather than title case, so that a label reads the same whether
 * or not it is prefixed with its prompt/completion kind.
 *
 * @param tokenType - Raw token type received from the API.
 * @returns A sentence-cased label with underscores replaced by spaces.
 */
export function getTokenDetailLabel(tokenType: string) {
  return capitalize(tokenType.split("_").join(" "));
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The two sides of an LLM call's usage, as the API keys them. */
export type TokenKind = "prompt" | "completion";

/**
 * The API's key for a side of an LLM call's usage, so the spelling has one
 * home wherever prompt and completion are told apart by name.
 */
export function getTokenKind({ isPrompt }: { isPrompt: boolean }): TokenKind {
  return isPrompt ? "prompt" : "completion";
}

/**
 * The user-facing name of a side, "Prompt" or "Completion": Phoenix's terms
 * for the split wherever it appears.
 */
export function getTokenKindLabel({ isPrompt }: { isPrompt: boolean }) {
  return capitalize(getTokenKind({ isPrompt }));
}

/**
 * A token type's label, qualified by the side it was used on only when the
 * same type occurs on both: "Audio" alone, but "Prompt audio" beside
 * "Completion audio".
 *
 * @param params - Label context.
 * @param params.tokenType - Raw token type received from the API.
 * @param params.isPrompt - Whether the usage is prompt rather than completion.
 * @param params.isUsedByBothKinds - Whether the type also occurs on the other side.
 */
export function getTokenDetailLabelForKind({
  tokenType,
  isPrompt,
  isUsedByBothKinds,
}: {
  tokenType: string;
  isPrompt: boolean;
  isUsedByBothKinds: boolean;
}) {
  const label = getTokenDetailLabel(tokenType);
  if (!isUsedByBothKinds) {
    return label;
  }
  return `${getTokenKindLabel({ isPrompt })} ${label.toLowerCase()}`;
}

/**
 * The token type that absorbs value a side's details do not account for.
 *
 * Details refine the authoritative prompt and completion totals but may be
 * incomplete for spans recorded before a token type was tracked; the leftover
 * is plain input or output usage.
 *
 * @param isPrompt - Whether the side holds prompt rather than completion usage.
 * @returns The token type to attribute the remainder to.
 */
function getRemainderTokenType(isPrompt: boolean) {
  return isPrompt ? "input" : "output";
}

/**
 * One side's positive per-token-type values, with whatever the side's total
 * they do not account for attributed to that side's plain type.
 *
 * Details refine the authoritative prompt and completion totals but may be
 * incomplete for spans recorded before a token type was tracked, so the
 * values always add up to the total they are drawn against. A side with no
 * details at all comes back as one plain segment; a side with no total keeps
 * its details as they are.
 *
 * @param params - Attribution context.
 * @param params.details - Values keyed by token type, if any.
 * @param params.sideTotal - The side's authoritative total, if known.
 * @param params.isPrompt - Whether the side is the prompt rather than the completion.
 * @returns Positive values keyed by token type.
 */
export function getTokenDetailValuesWithRemainder({
  details,
  sideTotal,
  isPrompt,
}: {
  details: Record<string, number | null | undefined> | null | undefined;
  sideTotal: number | null | undefined;
  isPrompt: boolean;
}): Record<string, number> {
  const values: Record<string, number> = {};
  let detailTotal = 0;
  Object.entries(details ?? {}).forEach(([tokenType, value]) => {
    if (isPositiveNumber(value)) {
      values[tokenType] = value;
      detailTotal += value;
    }
  });
  if (sideTotal != null) {
    const remainder = sideTotal - detailTotal;
    if (remainder > TOKEN_DETAIL_EPSILON) {
      const tokenType = getRemainderTokenType(isPrompt);
      values[tokenType] = (values[tokenType] ?? 0) + remainder;
    }
  }
  return values;
}

/**
 * Compares token types using the canonical display order, then alphabetically
 * for provider-specific types that are not in the known order.
 *
 * @param left - First token type.
 * @param right - Second token type.
 * @returns A standard array-sort comparison value.
 */
export function compareTokenTypes(left: string, right: string) {
  const leftOrder = TOKEN_DETAIL_SORT_ORDER[left] ?? 100;
  const rightOrder = TOKEN_DETAIL_SORT_ORDER[right] ?? 100;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.localeCompare(right);
}

/**
 * Selects a stable color for a token type. Known semantic types retain the
 * same color across charts; provider-specific types cycle through fallbacks.
 *
 * @param params - Color selection context.
 * @param params.colors - Theme-aware categorical chart colors.
 * @param params.tokenType - Raw token type received from the API.
 * @param params.index - Position of the series in display order. Only
 *   disambiguates token types that have no semantic color of their own.
 * @returns A theme-aware CSS color value.
 */
export function getTokenDetailColor({
  colors,
  index = 0,
  tokenType,
}: {
  colors: CategoryChartColors;
  index?: number;
  tokenType: string;
}) {
  const semanticColor = TOKEN_DETAIL_COLORS[tokenType];
  if (semanticColor) {
    return colors[semanticColor];
  }
  return colors[
    TOKEN_DETAIL_FALLBACK_COLORS[index % TOKEN_DETAIL_FALLBACK_COLORS.length]
  ];
}

/**
 * Assigns every series in a token-detail chart or legend a distinct color.
 *
 * A token type carries one semantic color, but when its prompt and
 * completion usage are separate series the second has to give up the
 * semantic color; sharing it would draw the two as one continuous block with
 * indistinguishable legend swatches. A series whose preferred color is taken
 * gets the first free fallback color instead.
 *
 * @param params - Color assignment context.
 * @param params.colors - Theme-aware categorical chart colors.
 * @param params.series - Every series, in drawing order, each with a key to
 *   look its color up by and the token type it draws.
 * @returns A color for each series, keyed by the series key.
 */
export function getTokenDetailSeriesColors<Key>({
  colors,
  series,
}: {
  colors: CategoryChartColors;
  series: ReadonlyArray<{ key: Key; tokenType: string }>;
}): Map<Key, string> {
  const fallbackColors = getTokenDetailFallbackColors(colors);
  const takenColors = new Set<string>();
  const claimColor = (preferredColor: string) => {
    const color = takenColors.has(preferredColor)
      ? (fallbackColors.find((candidate) => !takenColors.has(candidate)) ??
        preferredColor)
      : preferredColor;
    takenColors.add(color);
    return color;
  };
  return new Map(
    series.map(({ key, tokenType }, index) => [
      key,
      claimColor(getTokenDetailColor({ colors, index, tokenType })),
    ])
  );
}

/**
 * The colors used for token types with no semantic color of their own.
 *
 * @param colors - Theme-aware categorical chart colors.
 * @returns Fallback colors in assignment order.
 */
export function getTokenDetailFallbackColors(colors: CategoryChartColors) {
  return TOKEN_DETAIL_FALLBACK_COLORS.map((color) => colors[color]);
}
