import { graphql, useFragment } from "react-relay";

import {
  computeMeanPerRun,
  computeOperationalMetricDelta,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  ExperimentMetricDelta,
  ExperimentMetricStat,
  ExperimentMetricStatRow,
} from "@phoenix/components/experiment/ExperimentMetricDelta";
import { ExperimentRepeatedRunGroupTokenCosts } from "@phoenix/components/experiment/ExperimentRepeatedRunGroupTokenCosts";
import { ExperimentRepeatedRunGroupTokenCount } from "@phoenix/components/experiment/ExperimentRepeatedRunGroupTokenCount";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import {
  costFormatter,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  ExperimentRepeatedRunGroupMetadataFragment$data,
  ExperimentRepeatedRunGroupMetadataFragment$key,
} from "./__generated__/ExperimentRepeatedRunGroupMetadataFragment.graphql";

const metadataFragment = graphql`
  fragment ExperimentRepeatedRunGroupMetadataFragment on ExperimentRepeatedRunGroup {
    id
    averageLatencyMs
    costSummary {
      total {
        tokens
        cost
      }
    }
  }
`;

/**
 * A run group's per-run latency, tokens and cost.
 */
function getPerRunMetrics({
  group,
  runCount,
}: {
  group: ExperimentRepeatedRunGroupMetadataFragment$data | null;
  runCount: number;
}) {
  return {
    latencyMs: group?.averageLatencyMs ?? null,
    tokens: computeMeanPerRun({
      total: group?.costSummary.total.tokens,
      runCount,
    }),
    cost: computeMeanPerRun({ total: group?.costSummary.total.cost, runCount }),
  };
}

/**
 * The tooltip note shared by a run group's deltas: why there is no
 * comparison, or that the values are per-run means.
 */
function getRunGroupDeltaNote({
  hasBaseRuns,
  isPerRun,
  runCount,
  baseRunCount,
}: {
  hasBaseRuns: boolean;
  isPerRun: boolean;
  runCount: number;
  baseRunCount: number;
}): string | undefined {
  if (!hasBaseRuns) {
    return "The base has no run for this example";
  }
  return isPerRun
    ? `Mean per run across ${runCount} runs (base: ${baseRunCount})`
    : undefined;
}

/**
 * A compare group's change in one operational stat against the base group,
 * on per-run values.
 */
function RunGroupStatDelta({
  base,
  compare,
  metricLabel,
  formatter,
  note,
}: {
  base: number | null;
  compare: number;
  metricLabel: string;
  formatter: (value: number | null | undefined) => string;
  note: string | undefined;
}) {
  return (
    <ExperimentMetricDelta
      delta={computeOperationalMetricDelta({ base, compare })}
      display="relative"
      metricLabel={metricLabel}
      formatter={formatter}
      compareValueText={formatter(compare)}
      baseValueText={formatter(base)}
      note={note}
    />
  );
}

export function ExperimentRepeatedRunGroupMetadata(props: {
  fragmentRef: ExperimentRepeatedRunGroupMetadataFragment$key;
  /**
   * The base experiment's run group for the same example, to show deltas
   * against. Omitted on the base column and when deltas are hidden; `null`
   * when the base has no group for the example.
   */
  baseFragmentRef?: ExperimentRepeatedRunGroupMetadataFragment$key | null;
  /** The number of runs in this group, for per-run means */
  runCount?: number;
  /** The number of runs in the base group, for per-run means */
  baseRunCount?: number;
}) {
  const { baseFragmentRef, runCount = 1, baseRunCount = 1 } = props;
  const showDeltas = baseFragmentRef !== undefined;
  const data = useFragment(metadataFragment, props.fragmentRef);
  const baseData = useFragment(metadataFragment, baseFragmentRef ?? null);
  const { id, averageLatencyMs, costSummary } = data;
  const tokenCountTotal = costSummary.total.tokens;
  const costTotal = costSummary.total.cost;
  const perRun = getPerRunMetrics({ group: data, runCount });
  const basePerRun = getPerRunMetrics({
    group: baseData ?? null,
    runCount: baseRunCount,
  });
  const isPerRun = runCount > 1 || baseRunCount > 1;
  const note = getRunGroupDeltaNote({
    hasBaseRuns: baseData != null && baseRunCount > 0,
    isPerRun,
    runCount,
    baseRunCount,
  });
  return (
    <ExperimentMetricStatRow>
      {averageLatencyMs != null && (
        <ExperimentMetricStat>
          <LatencyText size="S" latencyMs={averageLatencyMs} />
          {showDeltas && (
            <RunGroupStatDelta
              base={basePerRun.latencyMs}
              compare={averageLatencyMs}
              metricLabel="Latency"
              formatter={latencyMsFormatter}
              note={note}
            />
          )}
        </ExperimentMetricStat>
      )}
      <ExperimentMetricStat>
        <ExperimentRepeatedRunGroupTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRepeatedRunGroupId={id}
          size="S"
        />
        {showDeltas && perRun.tokens != null && (
          <RunGroupStatDelta
            base={basePerRun.tokens}
            compare={perRun.tokens}
            metricLabel={isPerRun ? "Tokens per run" : "Total tokens"}
            formatter={numberFormatter}
            note={note}
          />
        )}
      </ExperimentMetricStat>
      {costTotal != null && id ? (
        <ExperimentMetricStat>
          <ExperimentRepeatedRunGroupTokenCosts
            costTotal={costTotal}
            experimentRepeatedRunGroupId={id}
            size="S"
          />
          {showDeltas && perRun.cost != null && (
            <RunGroupStatDelta
              base={basePerRun.cost}
              compare={perRun.cost}
              metricLabel={isPerRun ? "Cost per run" : "Total cost"}
              formatter={costFormatter}
              note={note}
            />
          )}
        </ExperimentMetricStat>
      ) : null}
    </ExperimentMetricStatRow>
  );
}
