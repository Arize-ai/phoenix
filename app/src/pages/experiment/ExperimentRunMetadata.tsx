import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
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

  const runsByRepetitionNumber = useMemo(() => {
    return data.runs.reduce(
      (acc, run) => {
        const repetitionNumber = run.repetitionNumber;
        acc[repetitionNumber] = run;
        return acc;
      },
      {} as Record<number, ExperimentRun>
    );
  }, [data.runs]);

  const run = runsByRepetitionNumber[props.repetitionNumber];
  if (run == null) {
    return null;
  }
  const { id, startTime, endTime, costSummary } = run;
  const tokenCountTotal = costSummary.total.tokens;
  const costTotal = costSummary.total.cost;
  return (
    <Flex direction="row" gap="size-100">
      <ExperimentRunLatency startTime={startTime} endTime={endTime} />
      {tokenCountTotal != null && id ? (
        <ExperimentRunTokenCount
          tokenCountTotal={tokenCountTotal}
          experimentRunId={id}
          size="S"
        />
      ) : (
        <TokenCount size="S">{tokenCountTotal}</TokenCount>
      )}
      {costTotal != null && id ? (
        <ExperimentRunTokenCosts
          costTotal={costTotal}
          experimentRunId={id}
          size="S"
        />
      ) : null}
    </Flex>
  );
}
