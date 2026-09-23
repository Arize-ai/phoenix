import { describe, expect, it } from "vitest";

import type { readExperimentResultsQuery } from "@phoenix/agent/tools/experimentResults/__generated__/readExperimentResultsQuery.graphql";
import { shapeExperimentResults } from "@phoenix/agent/tools/experimentResults/readExperimentResults";

type QueryData = readExperimentResultsQuery["response"];

function runNode({
  id,
  error = null,
  score,
  label,
}: {
  id: string;
  error?: string | null;
  score: number | null;
  label: string;
}) {
  return {
    id,
    output: `output-${id}`,
    latencyMs: 1200,
    error,
    annotations: {
      edges: [
        {
          node: {
            name: "reference_match",
            label,
            score,
            explanation: `explanation-${id}`,
          },
        },
      ],
    },
    example: {
      id: `example-${id}`,
      revision: {
        input: { messages: [{ role: "user", content: `input-${id}` }] },
        output: { reference: `reference-${id}` },
        metadata: { id },
      },
    },
  };
}

function experimentData(
  runs: ReturnType<typeof runNode>[],
  { runCount = runs.length }: { runCount?: number } = {}
): QueryData {
  return {
    experiment: {
      __typename: "Experiment",
      id: "RXhwZXJpbWVudDoxOA==",
      name: "generic_sql_guardrails_v1",
      runCount,
      expectedRunCount: runCount,
      errorRate: 0,
      averageRunLatencyMs: 1345.6,
      job: { status: "COMPLETED" },
      costSummary: { total: { cost: 0.0089, tokens: 51000 } },
      annotationSummaries: [
        {
          annotationName: "reference_match",
          meanScore: 0.75,
          count: runs.length,
          errorCount: 0,
        },
      ],
      runs: { edges: runs.map((node) => ({ node })) },
    },
  } as unknown as QueryData;
}

describe("shapeExperimentResults", () => {
  it("shapes experiment metrics, summaries, and per-run example data", () => {
    const data = experimentData([
      runNode({ id: "1", score: 1, label: "pass" }),
    ]);

    const results = shapeExperimentResults({ data });

    expect(results.experiment).toEqual({
      id: "RXhwZXJpbWVudDoxOA==",
      name: "generic_sql_guardrails_v1",
      status: "COMPLETED",
      runCount: 1,
      expectedRunCount: 1,
      errorRate: 0,
      averageRunLatencyMs: 1345.6,
      totalCost: 0.0089,
      totalTokens: 51000,
    });
    expect(results.annotationSummaries).toEqual([
      {
        annotationName: "reference_match",
        meanScore: 0.75,
        count: 1,
        errorCount: 0,
      },
    ]);
    expect(results.runs).toHaveLength(1);
    expect(results.runs[0]).toMatchObject({
      exampleId: "example-1",
      referenceOutput: { reference: "reference-1" },
      output: "output-1",
      annotations: [expect.objectContaining({ label: "pass", score: 1 })],
    });
    expect(results.truncatedToFirstRuns).toBeUndefined();
  });

  it("failuresOnly keeps runs that errored or scored below 1", () => {
    const data = experimentData([
      runNode({ id: "pass", score: 1, label: "pass" }),
      runNode({ id: "fail", score: 0, label: "fail" }),
      runNode({ id: "error", score: null, label: "pass", error: "boom" }),
    ]);

    const results = shapeExperimentResults({ data, failuresOnly: true });

    expect(results.runs.map((run) => run.exampleId)).toEqual([
      "example-fail",
      "example-error",
    ]);
    expect(results.returnedRunCount).toBe(2);
  });

  it("reports truncation when the experiment has more runs than fetched", () => {
    const data = experimentData([runNode({ id: "1", score: 1, label: "p" })], {
      runCount: 250,
    });

    const results = shapeExperimentResults({ data });

    expect(results.truncatedToFirstRuns).toBe(1);
  });

  it("throws a resolvable error for a non-experiment node", () => {
    const data = { experiment: { __typename: "%other" } } as QueryData;

    expect(() => shapeExperimentResults({ data })).toThrow(
      "Could not resolve experimentId to an experiment."
    );
  });
});
