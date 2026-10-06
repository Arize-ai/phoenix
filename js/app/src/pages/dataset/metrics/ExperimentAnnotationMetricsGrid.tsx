import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Loading } from "@phoenix/components";
import {
  AnnotationMetricsChart,
  type AnnotationMetricsInputPoint,
  AnnotationMetricsViewMenu,
  ChartPanel,
  getDefaultAnnotationMetricsView,
  normalizeAnnotationMetrics,
  type TimeSeriesChartType,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  ExperimentBaselineDistributionSeparator,
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
  getExperimentReferenceLabel,
} from "./ExperimentBaselineReference";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import { useExperimentSelectionColor } from "./experimentSelection";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import type { ExperimentSelection } from "./types";
import {
  EXPERIMENT_METRICS_CHART_SYNC_ID,
  RECENT_EXPERIMENT_SELECTION,
} from "./types";
import {
  useExperimentAnnotationMetricData,
  type ExperimentAnnotationMetricDatum,
} from "./useExperimentAnnotationMetricData";
import { useExperimentAnnotationMetricNames } from "./useExperimentAnnotationMetricNames";

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export function ExperimentAnnotationMetricsGrid({
  datasetId,
  children,
}: {
  datasetId: string;
  children: ReactNode;
}) {
  return (
    <div css={annotationGridCSS} data-testid="experiment-annotation-grid">
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <ExperimentAnnotationMetricsPanels datasetId={datasetId} />
        </Suspense>
      </ErrorBoundary>
      {/* Share this grid so trailing half-width charts fill an odd final row. */}
      {children}
    </div>
  );
}

function ExperimentAnnotationMetricsPanels({
  datasetId,
}: {
  datasetId: string;
}) {
  const annotationNames = useExperimentAnnotationMetricNames(datasetId);

  return (
    <>
      {annotationNames.map((annotationName) => (
        <ExperimentAnnotationMetricPanel
          key={annotationName}
          datasetId={datasetId}
          experimentSelection={RECENT_EXPERIMENT_SELECTION}
          annotationName={annotationName}
        />
      ))}
    </>
  );
}

/**
 * How mean scores are drawn for each kind of experiment selection. Compared
 * experiments have no inherent
 * order, so a line between them would imply a trend.
 */
const CHART_TYPE_BY_SELECTION_TYPE: Record<
  ExperimentSelection["type"],
  TimeSeriesChartType
> = {
  recent: "lineTimeSeries",
  compared: "barTimeSeries",
};

const EMPTY_STATE_MESSAGE_BY_SELECTION_TYPE: Record<
  ExperimentSelection["type"],
  string
> = {
  recent: `No chartable evaluation data within the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`,
  compared: "No chartable evaluation data for the selected experiments",
};

function useExperimentAnnotationMetricSeries({
  datasetId,
  annotationName,
  experimentSelection,
}: {
  datasetId: string;
  annotationName: string;
  experimentSelection: ExperimentSelection;
}) {
  const { experiments, baselineExperiment } = useExperimentAnnotationMetricData(
    { datasetId, annotationName, experimentSelection }
  );
  const annotationSeries = normalizeAnnotationMetrics({
    points: experiments.map(toAnnotationMetricsInputPoint),
    referencePoint:
      baselineExperiment == null
        ? undefined
        : toAnnotationMetricsInputPoint(baselineExperiment),
  });

  return {
    series: annotationSeries[0] ?? {
      name: annotationName,
      views: [],
      labels: [],
      data: [],
    },
    baselineSequenceNumber: baselineExperiment?.sequenceNumber,
    experiments,
  };
}

export function ExperimentAnnotationMetricPanel({
  datasetId,
  annotationName,
  experimentSelection,
  fillHeight = false,
}: {
  datasetId: string;
  annotationName: string;
  /**
   * Which experiments to chart
   */
  experimentSelection: ExperimentSelection;
  fillHeight?: boolean;
}) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <ChartPanel title={annotationName} fillHeight={fillHeight}>
            <Loading />
          </ChartPanel>
        }
      >
        <ExperimentAnnotationMetricPanelContent
          datasetId={datasetId}
          annotationName={annotationName}
          experimentSelection={experimentSelection}
          fillHeight={fillHeight}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

function ExperimentAnnotationMetricPanelContent({
  datasetId,
  annotationName,
  experimentSelection,
  fillHeight,
}: {
  datasetId: string;
  annotationName: string;
  experimentSelection: ExperimentSelection;
  fillHeight: boolean;
}) {
  const { series, baselineSequenceNumber, experiments } =
    useExperimentAnnotationMetricSeries({
      datasetId,
      annotationName,
      experimentSelection,
    });
  const referenceLabel = getExperimentReferenceLabel(experimentSelection);
  const getExperimentColor = useExperimentSelectionColor(experimentSelection);
  const [view, setView] = useState(() =>
    getDefaultAnnotationMetricsView(series)
  );
  // A refetch can change the visible annotation shape while preserving this
  // keyed panel, so fall back when its previous view is no longer available.
  const activeView = series.views.includes(view)
    ? view
    : getDefaultAnnotationMetricsView(series);
  const { reference } = series;
  const showViewToggle = series.views.length > 1;
  return (
    <ChartPanel
      title={series.name}
      fillHeight={fillHeight}
      actions={
        showViewToggle ? (
          <AnnotationMetricsViewMenu view={activeView} onChange={setView} />
        ) : undefined
      }
    >
      <AnnotationMetricsChart
        series={series}
        view={activeView}
        xAxisProps={{
          ...getExperimentXAxisProps({
            baselineSequenceNumber,
            experiments: experiments.map((experiment) => ({
              sequenceNumber: experiment.sequenceNumber,
              experimentColor: getExperimentColor(experiment.id),
            })),
          }),
          dataKey: "x",
          // Recharts otherwise thins category ticks when panels get narrow.
          interval: 0,
        }}
        yAxisProps={experimentMetricsYAxisProps}
        syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        chartType={CHART_TYPE_BY_SELECTION_TYPE[experimentSelection.type]}
        emptyStateMessage={
          EMPTY_STATE_MESSAGE_BY_SELECTION_TYPE[experimentSelection.type]
        }
        additionalLegendItems={getExperimentBaselineLegendItems({
          value: activeView === "scores" ? reference?.meanScore : null,
          label: referenceLabel,
        })}
        renderTooltipHeader={(point) => (
          <ExperimentMetricsTooltipHeader
            sequenceNumber={point.x}
            name={String(point.metadata.experimentName ?? "")}
            isBaseline={point.metadata.isBaseline === true}
            color={getExperimentColor(String(point.metadata.experimentId))}
            referenceLabel={referenceLabel}
          />
        )}
        renderReference={({ isMeanScoreHidden, isReferencePrepended }) => (
          <>
            <ExperimentBaselineDistributionSeparator
              value={
                activeView === "labels" && isReferencePrepended
                  ? reference?.x
                  : null
              }
            />
            {activeView === "scores" && (
              <ExperimentBaselineValueLine
                value={isMeanScoreHidden ? null : reference?.meanScore}
              />
            )}
          </>
        )}
      />
    </ChartPanel>
  );
}

function toAnnotationMetricsInputPoint(
  experiment: ExperimentAnnotationMetricDatum
): AnnotationMetricsInputPoint {
  return {
    x: experiment.sequenceNumber,
    metadata: {
      experimentName: experiment.name,
      experimentId: experiment.id,
      isBaseline: experiment.isBaseline,
    },
    summaries: experiment.annotationSummaries.map((summary) => ({
      name: summary.annotationName,
      meanScore: summary.meanScore,
      labelFractions: summary.labelFractions,
    })),
  };
}
