import { getProjectEvaluatorStatus } from "../projectEvaluatorStatus";

describe("getProjectEvaluatorStatus", () => {
  it.each([
    ["HEALTHY", "Running", "success"],
    ["DISABLED", "Disabled", "default"],
    ["DEGRADED", "Degraded", "warning"],
  ] as const)("labels %s as %s", (status, label, variant) => {
    expect(getProjectEvaluatorStatus({ runSummary: { status } })).toMatchObject(
      { label, variant }
    );
  });
});
