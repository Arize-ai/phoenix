import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Flex,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import {
  ExperimentRunTokenCosts,
  ExperimentRunTokenCount,
} from "@phoenix/components/experiment";
import { TokenCount } from "@phoenix/components/trace";

import type {
  ExperimentRunMetadata_runs$data,
  ExperimentRunMetadata_runs$key,
} from "./__generated__/ExperimentRunMetadata_runs.graphql";
import { ExperimentRunLatency } from "./ExperimentRunLatency";

type ExperimentRun = ExperimentRunMetadata_runs$data["runs"][number];

export function ExperimentRunMetadata(props: {
  fragmentKey: ExperimentRunMetadata_runs$key;
  repetitionNumber: number;
}) {
  const data = useFragment(
    graphql`
      fragment ExperimentRunMetadata_runs on RunComparisonItem {
        runs {
          repetitionNumber
          id
          startTime
          endTime
          costSummary {
            total {
              tokens
              cost
            }
          }
        }
      }
    `,
    props.fragmentKey
  );

  const { latencyMs, tokenCountTotal, costTotal, run } = useMemo(() => {
    let costTotal = null;
    let tokenCountTotal = null;
    let latencyMs = null;
    const runsByRepetitionNumber = data.runs.reduce(
      (acc, run) => {
        const repetitionNumber = run.repetitionNumber;
        acc[repetitionNumber] = run;
        return acc;
      },
      {} as Record<number, ExperimentRun>
    );

    const selectedRun = runsByRepetitionNumber[props.repetitionNumber];
    let totalCost = 0;
    let numRunsWithCost = 0;
    let totalTokenCount = 0;
    let numRunsWithTokenCount = 0;
    let totalLatencyMs = 0;
    let numRunsWithLatencyMs = 0;
    data.runs.forEach((run) => {
      if (run.costSummary.total.cost != null) {
        totalCost += run.costSummary.total.cost;
        numRunsWithCost++;
      }
      if (run.costSummary.total.tokens != null) {
        totalTokenCount += run.costSummary.total.tokens;
        numRunsWithTokenCount++;
      }
      if (run.endTime && run.startTime) {
        totalLatencyMs +=
          new Date(run.endTime).getTime() - new Date(run.startTime).getTime();
        numRunsWithLatencyMs++;
      }
    });
    costTotal = numRunsWithCost > 0 ? totalCost / numRunsWithCost : null;
    tokenCountTotal =
      numRunsWithTokenCount > 0
        ? totalTokenCount / numRunsWithTokenCount
        : null;
    latencyMs =
      numRunsWithLatencyMs > 0 ? totalLatencyMs / numRunsWithLatencyMs : null;
    return {
      costTotal,
      tokenCountTotal,
      latencyMs,
      run: selectedRun,
    };
  }, [data.runs, props.repetitionNumber]);

  if (run == null) {
    return null;
  }

  return (
    <Flex direction="row" gap="size-100">
      <TooltipTrigger>
        <TriggerWrap>
          <Text size="S" fontFamily="mono" color="grey-500">
            AVG
          </Text>
        </TriggerWrap>
        <Tooltip>Averaged over repeated runs for this example</Tooltip>
      </TooltipTrigger>
      <ExperimentRunLatency latencyMs={latencyMs} />
      {tokenCountTotal != null && run.id ? (
        <ExperimentRunTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRunId={run.id}
          size="S"
        />
      ) : (
        <TokenCount size="S">{tokenCountTotal}</TokenCount>
      )}
      {costTotal != null && run.id ? (
        <ExperimentRunTokenCosts
          costTotal={costTotal}
          experimentRunId={run.id}
          size="S"
        />
      ) : null}
    </Flex>
  );
}
