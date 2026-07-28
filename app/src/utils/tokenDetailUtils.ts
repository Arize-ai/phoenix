/**
 * Shared presentation rules for token types (`input`, `cache_read`, ...), so a
 * token type reads and looks the same wherever it is broken out — the model
 * charts, the time series, and the cost/token tooltips.
 */

import type { useCategoryChartColors } from "@phoenix/components/chart";

const TOKEN_DETAIL_SORT_ORDER: Partial<Record<string, number>> = {
  input: 0,
  output: 0,
  cache_read: 1,
  cache_write: 2,
  reasoning: 3,
  audio: 4,
};

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
 * @param params.index - Position of the series in display order.
 * @param params.tokenType - Raw token type received from the API.
 * @returns A theme-aware CSS color value.
 */
export function getTokenDetailColor({
  colors,
  index,
  tokenType,
}: {
  colors: ReturnType<typeof useCategoryChartColors>;
  index: number;
  tokenType: string;
}) {
  if (tokenType === "input") {
    return colors.category1;
  }
  if (tokenType === "output") {
    return colors.category2;
  }
  if (tokenType === "cache_read") {
    return colors.category9;
  }
  if (tokenType === "cache_write") {
    return colors.category7;
  }
  if (tokenType === "reasoning") {
    return colors.category4;
  }
  if (tokenType === "audio") {
    return colors.category3;
  }
  const fallbackColors = getTokenDetailFallbackColors(colors);
  return fallbackColors[index % fallbackColors.length];
}

/**
 * The colors used for token types with no semantic color of their own.
 *
 * @param colors - Theme-aware categorical chart colors.
 * @returns Fallback colors in assignment order.
 */
export function getTokenDetailFallbackColors(
  colors: ReturnType<typeof useCategoryChartColors>
) {
  return [
    colors.category5,
    colors.category6,
    colors.category8,
    colors.category10,
    colors.category11,
    colors.category12,
  ];
}
