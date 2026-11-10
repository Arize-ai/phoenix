import { toEvaluatorTaskOutputConfigs } from "../fetchPlaygroundEvaluator";

type OutputConfigNode = Parameters<
  typeof toEvaluatorTaskOutputConfigs
>[0][number];

describe("toEvaluatorTaskOutputConfigs", () => {
  it("carries a continuous output's threshold into the store", () => {
    const config = {
      __typename: "ContinuousAnnotationConfig",
      name: "helpfulness",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: 7,
    } as OutputConfigNode;
    expect(toEvaluatorTaskOutputConfigs([config])).toEqual([
      {
        annotationType: "CONTINUOUS",
        name: "helpfulness",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 10,
        threshold: 7,
      },
    ]);
  });
});
