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

export type TokenDetailMetric = "tokens" | "cost";

interface TokenDetailValue {
  readonly tokenType: string;
  readonly isPrompt: boolean;
  readonly value: {
    readonly tokens?: number | null;
    readonly cost?: number | null;
  };
}

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

export interface ModelTokenDetailSeries {
  dataKey: string;
  isPrompt: boolean;
  tokenType: string;
}

export type ModelTokenDetailChartDatum = {
  model: string;
  total: number;
} & Record<string, string | number>;

export function getTokenDetailDataKey(tokenType: string) {
  return `${TOKEN_DETAIL_DATA_KEY_PREFIX}${encodeURIComponent(tokenType)}`;
}

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

export function getTokenDetailLabel(tokenType: string) {
  return tokenType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

export function compareTokenTypes(left: string, right: string) {
  const leftOrder = TOKEN_DETAIL_SORT_ORDER[left] ?? 100;
  const rightOrder = TOKEN_DETAIL_SORT_ORDER[right] ?? 100;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.localeCompare(right);
}

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

function addTokenDetailValue({
  chartDatum,
  isPrompt,
  tokenType,
  value,
}: {
  chartDatum: ModelTokenDetailChartDatum;
  isPrompt: boolean;
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
}

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
      addTokenDetailValue({
        chartDatum,
        isPrompt: detail.isPrompt,
        tokenType: detail.tokenType,
        value,
      });
      if (value > TOKEN_DETAIL_EPSILON) {
        const dataKey = getModelTokenDetailDataKey(detail);
        seriesByDataKey.set(dataKey, {
          dataKey,
          isPrompt: detail.isPrompt,
          tokenType: detail.tokenType,
        });
      }
    });

    (
      [
        { isPrompt: true, tokenKind: "prompt", tokenType: "input" },
        { isPrompt: false, tokenKind: "completion", tokenType: "output" },
      ] as const
    ).forEach(({ isPrompt, tokenKind, tokenType }) => {
      const remainder =
        (model.costSummary[tokenKind][metric] ?? 0) - detailTotals[tokenKind];
      if (remainder > TOKEN_DETAIL_EPSILON) {
        const dataKey = getModelTokenDetailDataKey({ isPrompt, tokenType });
        addTokenDetailValue({
          chartDatum,
          isPrompt,
          tokenType,
          value: remainder,
        });
        seriesByDataKey.set(dataKey, { dataKey, isPrompt, tokenType });
      }
    });

    return chartDatum;
  });

  return {
    chartData,
    series: Array.from(seriesByDataKey.values()).sort(compareTokenDetailSeries),
  };
}
