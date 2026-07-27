/**
 * Utilities for turning model token-detail summaries into stable Recharts
 * data keys, series metadata, labels, colors, and stacked chart data.
 */

import type { useCategoryChartColors } from "@phoenix/components/chart";

const TOKEN_DETAIL_DATA_KEY_PREFIX = "tokenDetail:";
const TOKEN_DETAIL_EPSILON = 1e-9;
const TOKEN_DETAIL_SORT_ORDER: Partial<Record<string, number>> = {
  input: 0,
  output: 0,
  cache_read: 1,
  cache_write: 2,
  reasoning: 3,
  audio: 4,
};

/** Numeric field projected from each token-detail cost breakdown. */
export type TokenDetailMetric = "tokens" | "cost";

/** Minimal GraphQL token-detail shape consumed by the chart transformer. */
interface TokenDetailValue {
  readonly tokenType: string;
  readonly isPrompt: boolean;
  readonly value: {
    readonly tokens?: number | null;
    readonly cost?: number | null;
  };
}

/** Minimal GraphQL model shape consumed by the chart transformer. */
interface ModelWithTokenDetails {
  readonly name: string;
  readonly costSummary: {
    readonly prompt: {
      readonly tokens?: number | null;
      readonly cost?: number | null;
    };
    readonly completion: {
      readonly tokens?: number | null;
      readonly cost?: number | null;
    };
    readonly total: {
      readonly tokens?: number | null;
      readonly cost?: number | null;
    };
  };
  readonly costDetailSummaryEntries: ReadonlyArray<TokenDetailValue>;
}

/** Describes one token-type series rendered in a model breakdown chart. */
export interface ModelTokenDetailSeries {
  /** Collision-safe key used to store and render the series. */
  dataKey: string;
  /** Whether the series belongs to prompt rather than completion usage. */
  isPrompt: boolean;
  /** Raw token type received from the GraphQL API. */
  tokenType: string;
}

/**
 * One model row for a token-detail chart. Token series are stored under
 * dynamically generated data keys alongside the model name and total.
 */
export type ModelTokenDetailChartDatum = {
  model: string;
  total: number;
} & Record<string, string | number>;

/**
 * Builds a collision-safe Recharts data key for a token type.
 *
 * @param tokenType - Raw token type received from the API.
 * @returns An encoded data key for charts that separate prompt and completion data.
 */
export function getTokenDetailDataKey(tokenType: string) {
  return `${TOKEN_DETAIL_DATA_KEY_PREFIX}${encodeURIComponent(tokenType)}`;
}

/**
 * Builds a collision-safe Recharts data key that includes the token kind.
 * Including prompt/completion prevents token types such as audio from being
 * merged when they occur in both groups.
 *
 * @param params - Token series identity.
 * @param params.isPrompt - Whether the series contains prompt tokens.
 * @param params.tokenType - Raw token type received from the API.
 * @returns An encoded data key unique to the token type and kind.
 */
export function getModelTokenDetailDataKey({
  isPrompt,
  tokenType,
}: {
  isPrompt: boolean;
  tokenType: string;
}) {
  const tokenKind = isPrompt ? "prompt" : "completion";
  return `${TOKEN_DETAIL_DATA_KEY_PREFIX}${tokenKind}:${encodeURIComponent(tokenType)}`;
}

/**
 * Converts a snake-case token type into a user-facing chart label.
 *
 * @param tokenType - Raw token type received from the API.
 * @returns A title-cased label with underscores replaced by spaces.
 */
export function getTokenDetailLabel(tokenType: string) {
  return tokenType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Returns an unambiguous label for a model token-detail series. The prompt or
 * completion prefix is added only when the same token type exists in both.
 *
 * @param params - Label context.
 * @param params.allSeries - Every series displayed in the chart.
 * @param params.series - Series being labeled.
 * @returns A human-readable, unique label for the series.
 */
export function getModelTokenDetailLabel({
  allSeries,
  series,
}: {
  allSeries: ReadonlyArray<ModelTokenDetailSeries>;
  series: ModelTokenDetailSeries;
}) {
  const label = getTokenDetailLabel(series.tokenType);
  const isTokenTypeUsedByBothKinds = allSeries.some(
    (candidate) =>
      candidate.tokenType === series.tokenType &&
      candidate.isPrompt !== series.isPrompt
  );
  if (!isTokenTypeUsedByBothKinds) {
    return label;
  }
  return `${series.isPrompt ? "Prompt" : "Completion"} ${label.toLowerCase()}`;
}

/**
 * Compares token types using the canonical chart order, then alphabetically
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
  const fallbackColors = [
    colors.category5,
    colors.category6,
    colors.category8,
    colors.category10,
    colors.category11,
    colors.category12,
  ];
  return fallbackColors[index % fallbackColors.length];
}

/**
 * Rounds the exposed edge of the first and last bars in a horizontal stack.
 *
 * @param params - Position of the bar within the stack.
 * @param params.index - Zero-based position of the bar series.
 * @param params.seriesCount - Number of bar series in the stack.
 * @returns Corner radii for an outer bar, or undefined for an inner bar.
 */
export function getModelTokenDetailBarRadius({
  index,
  seriesCount,
}: {
  index: number;
  seriesCount: number;
}): [number, number, number, number] | undefined {
  const isFirstSeries = index === 0;
  if (isFirstSeries) {
    return [2, 0, 0, 2];
  }

  const isLastSeries = index === seriesCount - 1;
  if (isLastSeries) {
    return [0, 2, 2, 0];
  }

  return undefined;
}

/**
 * Orders model series by token type and prompt/completion kind.
 *
 * @param left - First series descriptor.
 * @param right - Second series descriptor.
 * @returns A standard array-sort comparison value.
 */
function compareTokenDetailSeries(
  left: ModelTokenDetailSeries,
  right: ModelTokenDetailSeries
) {
  const tokenTypeOrder = compareTokenTypes(left.tokenType, right.tokenType);
  if (tokenTypeOrder !== 0) {
    return tokenTypeOrder;
  }
  return Number(right.isPrompt) - Number(left.isPrompt);
}

/**
 * Records a positive token-detail value in a chart row and registers its
 * series metadata for rendering.
 *
 * @param params - Value and destination context.
 * @param params.chartDatum - Mutable chart row receiving the value.
 * @param params.isPrompt - Whether the value belongs to prompt usage.
 * @param params.seriesByDataKey - Mutable collection of chart series.
 * @param params.tokenType - Raw token type received from the API.
 * @param params.value - Token count or cost to add.
 */
function recordTokenDetailValue({
  chartDatum,
  isPrompt,
  seriesByDataKey,
  tokenType,
  value,
}: {
  chartDatum: ModelTokenDetailChartDatum;
  isPrompt: boolean;
  seriesByDataKey: Map<string, ModelTokenDetailSeries>;
  tokenType: string;
  value: number;
}) {
  if (value <= TOKEN_DETAIL_EPSILON) {
    return;
  }
  const dataKey = getModelTokenDetailDataKey({ isPrompt, tokenType });
  const currentValue = chartDatum[dataKey];
  chartDatum[dataKey] =
    (typeof currentValue === "number" ? currentValue : 0) + value;
  seriesByDataKey.set(dataKey, { dataKey, isPrompt, tokenType });
}

/**
 * Builds stacked model chart data for either token counts or costs.
 *
 * Detail rows refine the authoritative prompt and completion summaries but
 * may be incomplete for historical spans. Any positive remainder is assigned
 * to Input or Output so each rendered stack still matches its summary total.
 *
 * @param params - Chart transformation input.
 * @param params.metric - Whether to project token counts or costs.
 * @param params.models - Models and their summary/detail values from GraphQL.
 * @returns Chart rows and the sorted series metadata needed to render them.
 */
export function buildModelTokenDetailChartData({
  metric,
  models,
}: {
  metric: TokenDetailMetric;
  models: ReadonlyArray<ModelWithTokenDetails>;
}) {
  const seriesByDataKey = new Map<string, ModelTokenDetailSeries>();
  const chartData = models.map((model) => {
    const chartDatum: ModelTokenDetailChartDatum = {
      model: model.name,
      total: model.costSummary.total[metric] ?? 0,
    };
    const detailTotals = { prompt: 0, completion: 0 };

    model.costDetailSummaryEntries.forEach((detail) => {
      const value = detail.value[metric] ?? 0;
      const tokenKind = detail.isPrompt ? "prompt" : "completion";
      detailTotals[tokenKind] += value;
      recordTokenDetailValue({
        chartDatum,
        isPrompt: detail.isPrompt,
        seriesByDataKey,
        tokenType: detail.tokenType,
        value,
      });
    });

    const missingInputValue =
      (model.costSummary.prompt[metric] ?? 0) - detailTotals.prompt;
    recordTokenDetailValue({
      chartDatum,
      isPrompt: true,
      seriesByDataKey,
      tokenType: "input",
      value: missingInputValue,
    });

    const missingOutputValue =
      (model.costSummary.completion[metric] ?? 0) - detailTotals.completion;
    recordTokenDetailValue({
      chartDatum,
      isPrompt: false,
      seriesByDataKey,
      tokenType: "output",
      value: missingOutputValue,
    });

    return chartDatum;
  });

  return {
    chartData,
    series: Array.from(seriesByDataKey.values()).sort(compareTokenDetailSeries),
  };
}
