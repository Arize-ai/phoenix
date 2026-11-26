import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import type { useExperimentCompareLaneRunGroup_runGroup$key } from "./__generated__/useExperimentCompareLaneRunGroup_runGroup.graphql";
import type { useExperimentCompareLaneRunGroupQuery } from "./__generated__/useExperimentCompareLaneRunGroupQuery.graphql";
import {
  getCompareLaneRunState,
  getShownRun,
} from "./experimentCompareLaneRuns";
import type { CompareLane } from "./experimentCompareLaneTypes";

const runGroupFragment = graphql`
  fragment useExperimentCompareLaneRunGroup_runGroup on ExperimentRepeatedRunGroup {
    id
    averageLatencyMs
    costSummary {
      total {
        tokens
        cost
      }
    }
    runs {
      id
      repetitionNumber
      latencyMs
      output
      error
      trace {
        traceId
        projectId
      }
      costSummary {
        total {
          tokens
          cost
        }
      }
      annotations {
        edges {
          annotation: node {
            id
            name
            score
            label
            annotatorKind
            explanation
            metadata
            trace {
              traceId
              projectId
            }
          }
        }
      }
    }
  }
`;

/**
 * One experiment's runs for one example: every repetition with its output,
 * metrics and annotations. A lane's cells each call this with the same
 * arguments and share a single request, so every cell suspends on its own
 * boundary without one lane waiting on the other.
 * @param params.fetchKey - re-reads the runs when it changes, for an experiment that is still running
 */
export function useExperimentCompareLaneRunGroup({
  exampleId,
  experimentId,
  fetchKey,
}: {
  exampleId: string;
  experimentId: string;
  fetchKey?: string;
}) {
  const data = useLazyLoadQuery<useExperimentCompareLaneRunGroupQuery>(
    graphql`
      query useExperimentCompareLaneRunGroupQuery(
        $exampleId: ID!
        $experimentIds: [ID!]!
      ) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            experimentRepeatedRunGroups(experimentIds: $experimentIds) {
              ...useExperimentCompareLaneRunGroup_runGroup
            }
          }
        }
      }
    `,
    { exampleId, experimentIds: [experimentId] },
    { fetchPolicy: "store-and-network", fetchKey }
  );
  const runGroup = useFragment<useExperimentCompareLaneRunGroup_runGroup$key>(
    runGroupFragment,
    data.example.experimentRepeatedRunGroups?.[0] ?? null
  );
  return {
    runGroupId: runGroup?.id ?? null,
    averageLatencyMs: runGroup?.averageLatencyMs ?? null,
    totalTokens: runGroup?.costSummary.total.tokens ?? null,
    totalCost: runGroup?.costSummary.total.cost ?? null,
    runs: (runGroup?.runs ?? []).map((run) => ({
      ...run,
      annotations: run.annotations.edges.map((edge) => edge.annotation),
    })),
  };
}

export type CompareLaneRunGroup = ReturnType<
  typeof useExperimentCompareLaneRunGroup
>;

export type CompareLaneRun = CompareLaneRunGroup["runs"][number];

export type CompareLaneAnnotation = CompareLaneRun["annotations"][number];

/**
 * A lane's runs for one example with the run its shown repetition resolves
 * to: `shownRun` is null when the lane has no run for that repetition.
 */
export function useCompareLaneRun({
  exampleId,
  lane,
}: {
  exampleId: string;
  lane: CompareLane;
}) {
  const runGroup = useExperimentCompareLaneRunGroup({
    exampleId,
    experimentId: lane.experiment.id,
    fetchKey: lane.liveRuns?.fetchKey,
  });
  const runState = getCompareLaneRunState({
    runs: runGroup.runs,
    shownRepetitionNumber: lane.shownRepetitionNumber,
    pendingRuns: lane.liveRuns?.pendingRuns,
  });
  return { runGroup, runState, shownRun: getShownRun(runState) };
}
