import { getDatasetEvaluatorAnnotationConfigs } from "../datasetEvaluatorAnnotationConfigs";

const predicate = (name: string) => ({
  __typename: "ContinuousAnnotationConfig",
  name,
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
});

describe("getDatasetEvaluatorAnnotationConfigs", () => {
  it("names a one-question decision binding's column after the binding", () => {
    const configs = getDatasetEvaluatorAnnotationConfigs([
      {
        kind: "DECISION",
        name: "triage-judge",
        outputConfigs: [predicate("accurate")],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual(["triage-judge"]);
    expect(configs[0].annotationType).toBe("CONTINUOUS");
  });

  it("names a multi-question decision binding's columns {binding}.{question}", () => {
    const configs = getDatasetEvaluatorAnnotationConfigs([
      {
        kind: "DECISION",
        name: "triage-judge",
        outputConfigs: [predicate("accurate"), predicate("polite")],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual([
      "triage-judge.accurate",
      "triage-judge.polite",
    ]);
  });

  it("leaves other kinds' output config names untouched", () => {
    const configs = getDatasetEvaluatorAnnotationConfigs([
      {
        kind: "LLM",
        name: "binding",
        outputConfigs: [
          {
            __typename: "CategoricalAnnotationConfig",
            name: "correctness",
            values: [{ label: "yes", score: 1 }],
          },
        ],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual(["correctness"]);
  });
});
