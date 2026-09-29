import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  compactChartMargin,
  compactLegendProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  useCategoryChartColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import {
  intFormatter,
  intShortFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";
import type { TokenKind } from "@phoenix/utils/tokenDetailUtils";
import {
  compareTokenTypes,
  getTokenDetailColor,
  getTokenDetailLabel,
  getTokenDetailValuesWithRemainder,
} from "@phoenix/utils/tokenDetailUtils";

import {
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentMetricViewProps } from "./types";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import type { ExperimentMetricsDatum } from "./useExperimentMetricsData";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const TOKEN_DETAIL_DATA_KEY_PREFIX = "tokenDetail:";

type ExperimentTokenDetailsChartDatum = {
  sequenceNumber: number;
  experimentName: string;
  isBaseline: boolean;
  total: number | null;
} & Record<string, boolean | number | string | null>;

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const datum = payload[0]?.payload as {
    experimentName?: string;
    isBaseline?: boolean;
    total?: number | null;
  };
  return (
    <ChartTooltip>
      <ExperimentMetricsTooltipHeader
        sequenceNumber={Number(label)}
        name={datum?.experimentName}
        isBaseline={datum?.isBaseline}
      />
      {payload.map((entry) => {
        const name = String(entry.name ?? entry.dataKey ?? "unknown");
        const value = typeof entry.value === "number" ? entry.value : undefined;
        const share =
          value != null && typeof datum.total === "number" && datum.total > 0
            ? ` (${percentFormatter((value / datum.total) * 100)})`
            : "";
        return (
          <ChartTooltipItem
            color={entry.color ?? "transparent"}
            key={String(entry.dataKey ?? entry.name)}
            shape="circle"
            name={name}
            value={value != null ? `${intFormatter(value)}${share}` : "--"}
          />
        );
      })}
    </ChartTooltip>
  );
}

function getTokenDetailDataKey(tokenType: string) {
  return `${TOKEN_DETAIL_DATA_KEY_PREFIX}${encodeURIComponent(tokenType)}`;
}

function getTokenTotal({
  experiment,
  tokenKind,
}: {
  experiment: ExperimentMetricsDatum;
  tokenKind: TokenKind;
}) {
  return tokenKind === "prompt"
    ? experiment.promptTokens
    : experiment.completionTokens;
}

function getTokenDetails({
  experiment,
  tokenKind,
}: {
  experiment: ExperimentMetricsDatum;
  tokenKind: TokenKind;
}) {
  return tokenKind === "prompt"
    ? experiment.promptTokenDetails
    : experiment.completionTokenDetails;
}

function getExperimentTokenDetailValues({
  experiment,
  tokenKind,
}: {
  experiment: ExperimentMetricsDatum;
  tokenKind: TokenKind;
}): Record<string, number> {
  return getTokenDetailValuesWithRemainder({
    details: Object.fromEntries(
      getTokenDetails({ experiment, tokenKind }).map((detail) => [
        detail.tokenType,
        detail.tokenCount,
      ])
    ),
    sideTotal: getTokenTotal({ experiment, tokenKind }),
    isPrompt: tokenKind === "prompt",
  });
}

function getTokenTypes({
  baselineExperiment,
  experiments,
  tokenKind,
}: {
  baselineExperiment: ExperimentMetricsDatum | null;
  experiments: ExperimentMetricsDatum[];
  tokenKind: TokenKind;
}) {
  const experimentsForSeries =
    baselineExperiment == null
      ? experiments
      : [...experiments, baselineExperiment];
  return Array.from(
    experimentsForSeries.reduce((tokenTypes, experiment) => {
      Object.keys(
        getExperimentTokenDetailValues({ experiment, tokenKind })
      ).forEach((tokenType) => tokenTypes.add(tokenType));
      return tokenTypes;
    }, new Set<string>())
  ).sort(compareTokenTypes);
}

function getBaselineTokenDetailsTotal({
  baselineExperiment,
  isDataKeyHidden,
  tokenKind,
  tokenTypes,
}: {
  baselineExperiment: ExperimentMetricsDatum | null;
  isDataKeyHidden: (key: string) => boolean;
  tokenKind: TokenKind;
  tokenTypes: string[];
}) {
  if (
    baselineExperiment == null ||
    getTokenTotal({ experiment: baselineExperiment, tokenKind }) == null ||
    tokenTypes.length === 0 ||
    tokenTypes.every((tokenType) =>
      isDataKeyHidden(getTokenDetailDataKey(tokenType))
    )
  ) {
    return null;
  }
  const tokenDetails = getExperimentTokenDetailValues({
    experiment: baselineExperiment,
    tokenKind,
  });
  return tokenTypes.reduce((total, tokenType) => {
    if (isDataKeyHidden(getTokenDetailDataKey(tokenType))) {
      return total;
    }
    return total + (tokenDetails[tokenType] ?? 0);
  }, 0);
}

function ExperimentTokenDetailsChart({
  datasetId,
  tokenKind,
}: ExperimentMetricViewProps & { tokenKind: TokenKind }) {
  const { experiments, baselineExperiment } =
    useExperimentMetricsData(datasetId);
  const tokenTypes = getTokenTypes({
    baselineExperiment,
    experiments,
    tokenKind,
  });
  const chartData: ExperimentTokenDetailsChartDatum[] = experiments.map(
    (experiment) => {
      const chartDatum: ExperimentTokenDetailsChartDatum = {
        sequenceNumber: experiment.sequenceNumber,
        experimentName: experiment.name,
        isBaseline: experiment.isBaseline,
        total: getTokenTotal({ experiment, tokenKind }),
      };
      const tokenDetails = getExperimentTokenDetailValues({
        experiment,
        tokenKind,
      });
      tokenTypes.forEach((tokenType) => {
        chartDatum[getTokenDetailDataKey(tokenType)] =
          tokenDetails[tokenType] ?? 0;
      });
      return chartDatum;
    }
  );
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const baselineTokens = getBaselineTokenDetailsTotal({
    baselineExperiment,
    isDataKeyHidden,
    tokenKind,
    tokenTypes,
  });
  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No token data"
      chartType="bar"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          barSize={10}
          syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
          syncMethod="value"
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <XAxis
            {...getExperimentXAxisProps(baselineExperiment?.sequenceNumber)}
          />
          <YAxis
            {...experimentMetricsYAxisProps}
            allowDecimals={false}
            tickFormatter={(x) => intShortFormatter(x)}
          />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <ExperimentBaselineValueLine value={baselineTokens} />
          {tokenTypes.map((tokenType, index) => {
            const dataKey = getTokenDetailDataKey(tokenType);
            return (
              <Bar
                dataKey={dataKey}
                fill={getTokenDetailColor({ colors, index, tokenType })}
                hide={isDataKeyHidden(dataKey)}
                key={dataKey}
                legendType="circle"
                name={getTokenDetailLabel(tokenType)}
                radius={
                  index === tokenTypes.length - 1 ? [2, 2, 0, 0] : undefined
                }
                stackId="a"
              />
            );
          })}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconSize={8}
            onToggleDataKey={toggleDataKey}
            additionalLegendItems={getExperimentBaselineLegendItems(
              baselineTokens
            )}
          />
        </BarChart>
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}

export function ExperimentPromptTokenDetailsChart(
  props: ExperimentMetricViewProps
) {
  return <ExperimentTokenDetailsChart {...props} tokenKind="prompt" />;
}

export function ExperimentCompletionTokenDetailsChart(
  props: ExperimentMetricViewProps
) {
  return <ExperimentTokenDetailsChart {...props} tokenKind="completion" />;
}
