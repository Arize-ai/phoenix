import { describe, expect, it } from "vitest";

import type { HomePageQuery$data } from "../__generated__/HomePageQuery.graphql";
import { computeChecklistSteps } from "../HomePage";

function makeData(overrides: Partial<HomePageQuery$data>): HomePageQuery$data {
  return {
    datasetCount: 0,
    evaluatorCount: 0,
    modelProviders: [],
    projects: { edges: [] },
    ...overrides,
  } as HomePageQuery$data;
}

// A provider that requires a key (e.g. OpenAI) has a required credential;
// a no-auth provider (e.g. Ollama) has no requirements.
const providerWithKey = {
  credentialsSet: true,
  credentialRequirements: [{ isRequired: true }],
};
const providerWithoutKey = {
  credentialsSet: false,
  credentialRequirements: [{ isRequired: true }],
};
const noAuthProvider = {
  credentialsSet: true,
  credentialRequirements: [],
};

describe("computeChecklistSteps", () => {
  it("marks every step incomplete for a brand-new instance", () => {
    const steps = computeChecklistSteps(makeData({}));
    expect(steps.map((s) => s.id)).toEqual([
      "trace",
      "api-key",
      "dataset",
      "evaluator",
    ]);
    expect(steps.every((s) => !s.isComplete)).toBe(true);
    // undone steps expose a CTA target
    expect(steps[0].cta.to).toBe("/projects");
    expect(steps[1].cta.to).toBe("/settings/providers");
    expect(steps[2].cta.to).toBe("/datasets");
    expect(steps[3].cta.to).toBe("/evaluators");
  });

  it("completes the trace step and sums traces across projects", () => {
    const steps = computeChecklistSteps(
      makeData({
        projects: {
          edges: [{ node: { traceCount: 3 } }, { node: { traceCount: 5 } }],
        },
      })
    );
    const trace = steps.find((s) => s.id === "trace")!;
    expect(trace.isComplete).toBe(true);
    expect(trace.stat.value).toBe("8");
    expect(trace.stat.label).toBe("traces logged");
    // other steps remain incomplete
    expect(steps.filter((s) => s.isComplete)).toHaveLength(1);
  });

  it("completes the api-key step only when a provider with a required key is set", () => {
    const none = computeChecklistSteps(
      makeData({ modelProviders: [providerWithoutKey] })
    );
    expect(none.find((s) => s.id === "api-key")!.isComplete).toBe(false);

    const set = computeChecklistSteps(
      makeData({
        modelProviders: [providerWithoutKey, providerWithKey],
      })
    );
    const apiKey = set.find((s) => s.id === "api-key")!;
    expect(apiKey.isComplete).toBe(true);
    expect(apiKey.stat.value).toBe("1");
    expect(apiKey.stat.label).toBe("provider connected");
  });

  it("does NOT count no-auth providers (e.g. Ollama) as an added API key", () => {
    const steps = computeChecklistSteps(
      makeData({ modelProviders: [noAuthProvider] })
    );
    expect(steps.find((s) => s.id === "api-key")!.isComplete).toBe(false);
  });

  it("uses singular stat labels for a single item", () => {
    const steps = computeChecklistSteps(
      makeData({
        datasetCount: 1,
        evaluatorCount: 1,
        projects: { edges: [{ node: { traceCount: 1 } }] },
      })
    );
    expect(steps.find((s) => s.id === "trace")!.stat.label).toBe(
      "trace logged"
    );
    expect(steps.find((s) => s.id === "dataset")!.stat.label).toBe(
      "dataset created"
    );
    expect(steps.find((s) => s.id === "evaluator")!.stat.label).toBe(
      "evaluator created"
    );
  });

  it("completes all steps when every prerequisite is met", () => {
    const steps = computeChecklistSteps(
      makeData({
        datasetCount: 2,
        evaluatorCount: 4,
        modelProviders: [providerWithKey],
        projects: { edges: [{ node: { traceCount: 10 } }] },
      })
    );
    expect(steps.every((s) => s.isComplete)).toBe(true);
    expect(steps.find((s) => s.id === "dataset")!.stat.value).toBe("2");
    expect(steps.find((s) => s.id === "evaluator")!.stat.value).toBe("4");
  });
});
