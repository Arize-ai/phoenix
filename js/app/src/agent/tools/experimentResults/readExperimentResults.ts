import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { readExperimentResultsQuery } from "./__generated__/readExperimentResultsQuery.graphql";

/** Maximum runs fetched per read; larger experiments report truncation. */
export const MAX_EXPERIMENT_RESULT_RUNS = 100;

type ExperimentRunAnnotation = {
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
};

type ExperimentRunResult = {
  runId: string;
  exampleId: string;
  input: unknown;
  referenceOutput: unknown;
  metadata: unknown;
  output: unknown;
  error: string | null;
  latencyMs: number;
  annotations: ExperimentRunAnnotation[];
};

export type ExperimentResults = {
  experiment: {
    id: string;
    name: string;
    status: string | null;
    runCount: number;
    expectedRunCount: number;
    errorRate: number | null;
    averageRunLatencyMs: number | null;
    totalCost: number | null;
    totalTokens: number | null;
  };
  annotationSummaries: {
    annotationName: string;
    meanScore: number | null;
    count: number;
    errorCount: number;
  }[];
  runs: ExperimentRunResult[];
  /** Runs matching the filter out of the runs fetched. */
  returnedRunCount: number;
  /** Set when the experiment has more runs than one read fetches. */
  truncatedToFirstRuns?: number;
};

/**
 * A run "fails" when it errored or any evaluator scored it below 1. This is
 * the pass/fail convention of score-bearing evaluators (0/1 classification
 * and continuous scores alike); label vocabularies are evaluator-specific,
 * so labels deliberately play no part.
 */
function isFailingRun(run: ExperimentRunResult): boolean {
  return (
    run.error != null ||
    run.annotations.some(
      (annotation) => annotation.score != null && annotation.score < 1
    )
  );
}

type ExperimentResultsQueryData = readExperimentResultsQuery["response"];

/**
 * Shape the raw query payload into the operation output. Pure — unit tested
 * without Relay.
 */
export function shapeExperimentResults({
  data,
  failuresOnly = false,
}: {
  data: ExperimentResultsQueryData;
  failuresOnly?: boolean;
}): ExperimentResults {
  const experiment = data.experiment;
  if (experiment?.__typename !== "Experiment") {
    throw new Error("Could not resolve experimentId to an experiment.");
  }
  const allRuns: ExperimentRunResult[] = experiment.runs.edges.map(
    ({ node }) => ({
      runId: node.id,
      exampleId: node.example.id,
      input: node.example.revision.input,
      referenceOutput: node.example.revision.output,
      metadata: node.example.revision.metadata,
      output: node.output,
      error: node.error ?? null,
      latencyMs: node.latencyMs,
      annotations: node.annotations.edges.map(({ node: annotation }) => ({
        name: annotation.name,
        label: annotation.label ?? null,
        score: annotation.score ?? null,
        explanation: annotation.explanation ?? null,
      })),
    })
  );
  const runs = failuresOnly ? allRuns.filter(isFailingRun) : allRuns;
  return {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      status: experiment.job?.status ?? null,
      runCount: experiment.runCount,
      expectedRunCount: experiment.expectedRunCount,
      errorRate: experiment.errorRate ?? null,
      averageRunLatencyMs: experiment.averageRunLatencyMs ?? null,
      totalCost: experiment.costSummary.total.cost ?? null,
      totalTokens: experiment.costSummary.total.tokens ?? null,
    },
    annotationSummaries: experiment.annotationSummaries.map((summary) => ({
      annotationName: summary.annotationName,
      meanScore: summary.meanScore ?? null,
      count: summary.count,
      errorCount: summary.errorCount,
    })),
    runs,
    returnedRunCount: runs.length,
    ...(experiment.runCount > allRuns.length
      ? { truncatedToFirstRuns: allRuns.length }
      : {}),
  };
}

export async function readExperimentResults({
  experimentId,
  failuresOnly,
}: {
  experimentId: string;
  failuresOnly?: boolean;
}): Promise<ExperimentResults> {
  const data = await fetchQuery<readExperimentResultsQuery>(
    RelayEnvironment,
    graphql`
      query readExperimentResultsQuery($experimentId: ID!, $first: Int!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            id
            name
            runCount
            expectedRunCount
            errorRate
            averageRunLatencyMs
            job {
              status
            }
            costSummary {
              total {
                cost
                tokens
              }
            }
            annotationSummaries {
              annotationName
              meanScore
              count
              errorCount
            }
            runs(first: $first) {
              edges {
                node {
                  id
                  output
                  latencyMs
                  error
                  annotations {
                    edges {
                      node {
                        name
                        label
                        score
                        explanation
                      }
                    }
                  }
                  example {
                    id
                    revision {
                      input
                      output
                      metadata
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { experimentId, first: MAX_EXPERIMENT_RESULT_RUNS },
    { fetchPolicy: "network-only" }
  ).toPromise();

  if (data == null) {
    throw new Error("The experiment results query returned no data.");
  }
  return shapeExperimentResults({ data, failuresOnly });
}
