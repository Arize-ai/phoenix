import { css } from "@emotion/react";

import { Flex, Text, truncateSingleCSS } from "@phoenix/components";
import {
  computeMeanPerRun,
  computeOperationalMetricDelta,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  ExperimentMetricDelta,
  ExperimentMetricStat,
  ExperimentMetricStatRow,
} from "@phoenix/components/experiment/ExperimentMetricDelta";
import { ExperimentRunLatency } from "@phoenix/components/experiment/ExperimentRunLatency";
import { ExperimentRunTokenCosts } from "@phoenix/components/experiment/ExperimentRunTokenCosts";
import { ExperimentRunTokenCount } from "@phoenix/components/experiment/ExperimentRunTokenCount";
import type { SelectedTraceDetails } from "@phoenix/pages/experiment/TraceDetailsDrawer";
import {
  costFormatter,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

import {
  buildLaneAnnotationRow,
  computeAnnotationRowDelta,
} from "./experimentCompareAnnotationRows";
import type { ExperimentCompareAnnotationsTableRow } from "./ExperimentCompareAnnotationsTable";
import { ExperimentCompareAnnotationsTable } from "./ExperimentCompareAnnotationsTable";
import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import {
  getCompareLaneRunState,
  getShownRun,
} from "./experimentCompareLaneRuns";
import type {
  AnnotationConfigsByName,
  CompareLane,
} from "./experimentCompareLaneTypes";
import type {
  CompareLaneRun,
  CompareLaneRunGroup,
} from "./useExperimentCompareLaneRunGroup";
import { useExperimentCompareLaneRunGroup } from "./useExperimentCompareLaneRunGroup";

const averagesCSS = css`
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-xs);
  color: var(--global-text-color-500);
  flex: 0 1 auto;
  min-width: 0;
  ${truncateSingleCSS}
`;

/* One line at any width, so the tables below line up across lanes */
const statsRowCSS = css`
  height: var(--global-dimension-size-300);
  overflow: hidden;
  & > .metric-stat-row {
    flex: none;
  }
  padding: 0 var(--global-dimension-size-100);
`;

function RunStatDelta({
  base,
  compare,
  metricLabel,
  formatter,
}: {
  base: number | null;
  compare: number | null;
  metricLabel: string;
  formatter: (value: number | null | undefined) => string;
}) {
  return (
    <ExperimentMetricDelta
      delta={computeOperationalMetricDelta({ base, compare })}
      display="relative"
      metricLabel={metricLabel}
      formatter={formatter}
      compareValueText={formatter(compare)}
      baseValueText={formatter(base)}
    />
  );
}

/**
 * The shown run's latency, tokens and cost, each followed by its change
 * against the base lane's shown run when there is one.
 */
function LaneRunStats({
  run,
  baseRun,
}: {
  run: CompareLaneRun;
  /** The base lane's shown run; null shows no deltas */
  baseRun: CompareLaneRun | null;
}) {
  const { tokens, cost } = run.costSummary.total;
  return (
    <ExperimentMetricStatRow>
      <ExperimentMetricStat>
        <ExperimentRunLatency latencyMs={run.latencyMs} />
        {baseRun != null ? (
          <RunStatDelta
            base={baseRun.latencyMs}
            compare={run.latencyMs}
            metricLabel="Latency"
            formatter={latencyMsFormatter}
          />
        ) : null}
      </ExperimentMetricStat>
      <ExperimentMetricStat>
        <ExperimentRunTokenCount
          tokenCountTotal={tokens}
          experimentRunId={run.id}
          size="S"
        />
        {baseRun != null ? (
          <RunStatDelta
            base={baseRun.costSummary.total.tokens}
            compare={tokens}
            metricLabel="Total tokens"
            formatter={numberFormatter}
          />
        ) : null}
      </ExperimentMetricStat>
      {cost != null ? (
        <ExperimentMetricStat>
          <ExperimentRunTokenCosts
            costTotal={cost}
            experimentRunId={run.id}
            size="S"
          />
          {baseRun != null ? (
            <RunStatDelta
              base={baseRun.costSummary.total.cost}
              compare={cost}
              metricLabel="Total cost"
              formatter={costFormatter}
            />
          ) : null}
        </ExperimentMetricStat>
      ) : null}
    </ExperimentMetricStatRow>
  );
}

function formatRunGroupAverages(runGroup: CompareLaneRunGroup): string {
  const runCount = runGroup.runs.length;
  return [
    latencyMsFormatter(runGroup.averageLatencyMs),
    numberFormatter(
      computeMeanPerRun({ total: runGroup.totalTokens, runCount })
    ),
    costFormatter(computeMeanPerRun({ total: runGroup.totalCost, runCount })),
  ].join(" · ");
}

/**
 * A lane's Annotations cell: the shown run's stats over the annotations
 * table. The compare lane measures both against the base lane's shown run.
 */
export function ExperimentCompareLaneAnnotations({
  exampleId,
  lane,
  baseLane,
  annotationNames,
  annotationConfigsByName,
  onOpenTrace,
}: {
  exampleId: string;
  lane: CompareLane;
  /** The lane deltas are measured against; null on the base lane itself */
  baseLane: CompareLane | null;
  /** The annotations every lane lists, in display order */
  annotationNames: readonly string[];
  annotationConfigsByName: AnnotationConfigsByName;
  onOpenTrace: (details: SelectedTraceDetails) => void;
}) {
  const runGroup = useExperimentCompareLaneRunGroup({
    exampleId,
    experimentId: lane.experiment.id,
  });
  const baseRunGroup = useExperimentCompareLaneRunGroup({
    exampleId,
    experimentId: (baseLane ?? lane).experiment.id,
  });
  const runState = getCompareLaneRunState({
    runs: runGroup.runs,
    shownRepetitionNumber: lane.shownRepetitionNumber,
  });
  if (runState.type === "no-runs") {
    return <ExperimentCompareLaneEmpty message="No run for this example" />;
  }
  const shownRun = getShownRun(runState);
  const baseShownRun =
    baseLane != null
      ? getShownRun(
          getCompareLaneRunState({
            runs: baseRunGroup.runs,
            shownRepetitionNumber: baseLane.shownRepetitionNumber,
          })
        )
      : null;
  const showsDeltas = shownRun != null && baseShownRun != null;

  const rows = annotationNames.map(
    (annotationName): ExperimentCompareAnnotationsTableRow => {
      const summary = lane.experiment.annotationSummaries.find(
        (candidate) => candidate.annotationName === annotationName
      );
      const config = annotationConfigsByName[annotationName];
      const row = buildLaneAnnotationRow({
        annotationName,
        runs: runGroup.runs,
        shownRepetitionNumber: lane.shownRepetitionNumber,
        minScore: summary?.minScore,
        maxScore: summary?.maxScore,
      });
      if (!showsDeltas || baseLane == null) {
        return { row, config, delta: null };
      }
      const baseRow = buildLaneAnnotationRow({
        annotationName,
        runs: baseRunGroup.runs,
        shownRepetitionNumber: baseLane.shownRepetitionNumber,
      });
      return {
        row,
        config,
        delta: computeAnnotationRowDelta({
          baseAnnotation: baseRow.annotation,
          compareAnnotation: row.annotation,
          config,
        }),
        baseValueText: baseRow.valueText,
      };
    }
  );

  return (
    <Flex direction="column" gap="size-100">
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap="size-200"
        css={statsRowCSS}
      >
        {shownRun != null ? (
          <LaneRunStats
            run={shownRun}
            baseRun={showsDeltas ? baseShownRun : null}
          />
        ) : (
          <Text color="text-500" size="S">
            No run for this repetition
          </Text>
        )}
        {runGroup.runs.length > 1 ? (
          <span
            css={averagesCSS}
            title={`Averages over all repetitions: ${formatRunGroupAverages(runGroup)}`}
          >
            avg {formatRunGroupAverages(runGroup)}
          </span>
        ) : null}
      </Flex>
      {rows.length > 0 ? (
        <ExperimentCompareAnnotationsTable
          rows={rows}
          hasRepetitions={lane.experiment.repetitions > 1}
          showsDeltas={showsDeltas}
          onOpenAnnotationTrace={({ traceId, projectId, annotationName }) =>
            onOpenTrace({
              traceId,
              projectId,
              title: `Evaluator Trace: ${annotationName}`,
            })
          }
        />
      ) : (
        <ExperimentCompareLaneEmpty message="No annotations" />
      )}
    </Flex>
  );
}
