/**
 * Shared presentation rules for token types (`input`, `cache_read`, ...), so a
 * token type reads and looks the same wherever it is broken out — the model
 * charts, the time series, and the cost/token tooltips.
 */

import type { useCategoryChartColors } from "@phoenix/components/chart";

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
  const words = tokenType.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The token type that absorbs value a group's details do not account for.
 *
 * Details refine the authoritative prompt and completion totals but may be
 * incomplete for spans recorded before a token type was tracked; the leftover
 * is plain input or output usage.
 *
 * @param isPrompt - Whether the group holds prompt rather than completion usage.
 * @returns The token type to attribute the remainder to.
 */
export function getRemainderTokenType(isPrompt: boolean) {
  return isPrompt ? "input" : "output";
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
 * The colors used for token types with no semantic color of their own.
 *
 * @param colors - Theme-aware categorical chart colors.
 * @returns Fallback colors in assignment order.
 */
export function getTokenDetailFallbackColors(colors: CategoryChartColors) {
  return TOKEN_DETAIL_FALLBACK_COLORS.map((color) => colors[color]);
}
