import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Loading } from "@phoenix/components";
import {
  AnnotationMetricsChart,
  type AnnotationMetricsInputPoint,
  type AnnotationMetricsSeries,
  AnnotationScoreLabelToggle,
  ChartPanel,
  getDefaultAnnotationMetricsView,
  getEmptyAnnotationMetricsSeries,
  normalizeAnnotationMetrics,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  ExperimentBaselineDistributionSeparator,
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import {
  useExperimentAnnotationMetricNames,
  useExperimentAnnotationMetricData,
  type ExperimentAnnotationMetricDatum,
} from "./useExperimentAnnotationMetricsData";

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
          annotationName={annotationName}
        />
      ))}
    </>
  );
}

export function useExperimentAnnotationMetricSeries({
  datasetId,
  annotationName,
  fetchKey,
}: {
  datasetId: string;
  annotationName: string;
  fetchKey?: number;
}) {
  const { experiments, baselineExperiment } = useExperimentAnnotationMetricData(
    { datasetId, annotationName, fetchKey }
  );
  const annotationSeries = normalizeAnnotationMetrics({
    points: experiments.map(toAnnotationMetricsInputPoint),
    referencePoint:
      baselineExperiment == null
        ? undefined
        : toAnnotationMetricsInputPoint(baselineExperiment),
  });

  return {
    series:
      annotationSeries[0] ?? getEmptyAnnotationMetricsSeries(annotationName),
    baselineSequenceNumber: baselineExperiment?.sequenceNumber,
  };
}

export function ExperimentAnnotationMetricPanel({
  datasetId,
  annotationName,
  fillHeight = false,
}: {
  datasetId: string;
  annotationName: string;
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
          fillHeight={fillHeight}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

function ExperimentAnnotationMetricPanelContent({
  datasetId,
  annotationName,
  fillHeight,
}: {
  datasetId: string;
  annotationName: string;
  fillHeight: boolean;
}) {
  const fetchKey = useDatasetContext(
    (state) => state.experimentAnnotationMetricsFetchKey
  );
  const { series, baselineSequenceNumber } =
    useExperimentAnnotationMetricSeries({
      datasetId,
      annotationName,
      fetchKey,
    });
  return (
    <ExperimentAnnotationMetricsPanel
      series={series}
      baselineSequenceNumber={baselineSequenceNumber}
      fillHeight={fillHeight}
    />
  );
}

export function ExperimentAnnotationMetricsPanel({
  series,
  baselineSequenceNumber,
  fillHeight = false,
}: {
  series: AnnotationMetricsSeries;
  baselineSequenceNumber?: number;
  fillHeight?: boolean;
}) {
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
          <AnnotationScoreLabelToggle view={activeView} onChange={setView} />
        ) : undefined
      }
    >
      <AnnotationMetricsChart
        series={series}
        view={activeView}
        xAxisProps={{
          ...getExperimentXAxisProps(baselineSequenceNumber),
          dataKey: "x",
          // Recharts otherwise thins category ticks when panels get narrow.
          interval: 0,
        }}
        yAxisProps={experimentMetricsYAxisProps}
        syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        emptyStateMessage={`No chartable evaluation data within the last ${EXPERIMENT_METRICS_EXPERIMENT_COUNT} experiments`}
        additionalLegendItems={getExperimentBaselineLegendItems(
          activeView === "scores" ? reference?.meanScore : null
        )}
        renderTooltipHeader={(point) => (
          <ExperimentMetricsTooltipHeader
            sequenceNumber={point.x}
            name={String(point.metadata.experimentName ?? "")}
            isBaseline={point.metadata.isBaseline === true}
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
      isBaseline: experiment.isBaseline,
    },
    summaries: experiment.annotationSummaries.map((summary) => ({
      name: summary.annotationName,
      meanScore: summary.meanScore,
      labelFractions: summary.labelFractions,
    })),
  };
}
