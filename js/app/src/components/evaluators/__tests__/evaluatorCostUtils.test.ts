import { getAverageEvaluatorCostSummary } from "../evaluatorCostUtils";

describe("getAverageEvaluatorCostSummary", () => {
  it("averages total, prompt, and completion costs over the run count", () => {
    expect(
      getAverageEvaluatorCostSummary({
        costSummary: {
          total: { cost: 0.12 },
          prompt: { cost: 0.03 },
          completion: { cost: 0.09 },
        },
        runCount: 3,
      })
    ).toEqual({
      total: { cost: 0.04 },
      prompt: { cost: 0.01 },
      completion: { cost: 0.03 },
    });
  });

  it("returns null when there are no runs", () => {
    expect(
      getAverageEvaluatorCostSummary({
        costSummary: {
          total: { cost: 0 },
          prompt: { cost: 0 },
          completion: { cost: 0 },
        },
        runCount: 0,
      })
    ).toBeNull();
  });

  it("returns null when aggregate costs are unavailable", () => {
    expect(
      getAverageEvaluatorCostSummary({ costSummary: null, runCount: 2 })
    ).toBeNull();
  });

  it("preserves unavailable cost breakdowns", () => {
    expect(
      getAverageEvaluatorCostSummary({
        costSummary: {
          total: { cost: 0.06 },
          prompt: { cost: null },
          completion: { cost: 0.06 },
        },
        runCount: 2,
      })
    ).toEqual({
      total: { cost: 0.03 },
      prompt: { cost: null },
      completion: { cost: 0.03 },
    });
  });
});
