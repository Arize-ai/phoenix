import {
  getOptimizationBounds,
  getOptimizationValueFromConfig,
} from "@phoenix/components/annotation/optimizationUtils";

import {
  datasetEvaluatorsToAnnotationConfigs,
  datasetEvaluatorToAnnotationConfigs,
  getDecisionAnnotationName,
  type DatasetEvaluatorForConfig,
} from "../datasetEvaluatorUtils";

describe("datasetEvaluatorToAnnotationConfigs", () => {
  it("discriminates freeform via __typename even when bounds are present", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "judge",
      outputConfigs: [
        {
          __typename: "FreeformAnnotationConfig",
          name: "judge",
          optimizationDirection: "MAXIMIZE",
          threshold: 0.7,
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(config.annotationType).toBe("FREEFORM");
  });

  it("maps a freeform config with threshold + MAXIMIZE to a saturated optimization value", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "score",
      outputConfigs: [
        {
          __typename: "FreeformAnnotationConfig",
          name: "score",
          optimizationDirection: "MAXIMIZE",
          threshold: 0.7,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(getOptimizationValueFromConfig({ config, score: 0.8 })).toBe(1);
    expect(getOptimizationValueFromConfig({ config, score: 0.5 })).toBe(-1);
  });

  it("maps a freeform config with bounds and MAXIMIZE to a value graded around the midpoint", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "score",
      outputConfigs: [
        {
          __typename: "FreeformAnnotationConfig",
          name: "score",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(getOptimizationValueFromConfig({ config, score: 0.75 })).toBeCloseTo(
      0.5
    );
    expect(getOptimizationValueFromConfig({ config, score: 0.25 })).toBeCloseTo(
      -0.5
    );
  });

  it("returns null when freeform has no valid pivot (single-ended bounds, no threshold)", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "score",
      outputConfigs: [
        {
          __typename: "FreeformAnnotationConfig",
          name: "score",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(getOptimizationValueFromConfig({ config, score: 5 })).toBeNull();
  });

  it("returns null when freeform optimizationDirection is NONE", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "score",
      outputConfigs: [
        {
          __typename: "FreeformAnnotationConfig",
          name: "score",
          optimizationDirection: "NONE",
          threshold: 0.5,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(getOptimizationValueFromConfig({ config, score: 0.8 })).toBeNull();
  });

  it("maps a categorical config via __typename", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "sentiment",
      outputConfigs: [
        {
          __typename: "CategoricalAnnotationConfig",
          name: "sentiment",
          optimizationDirection: "MAXIMIZE",
          values: [
            { label: "neg", score: 0 },
            { label: "pos", score: 1 },
          ],
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(config.annotationType).toBe("CATEGORICAL");
  });

  it("maps a continuous config via __typename", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "quality",
      outputConfigs: [
        {
          __typename: "ContinuousAnnotationConfig",
          name: "quality",
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(config.annotationType).toBe("CONTINUOUS");
  });

  it("maps a categorical MINIMIZE config to a lower-is-better optimization", () => {
    const evaluator: DatasetEvaluatorForConfig = {
      name: "hallucination",
      outputConfigs: [
        {
          __typename: "CategoricalAnnotationConfig",
          name: "hallucination",
          optimizationDirection: "MINIMIZE",
          values: [
            { label: "hallucinated", score: 1 },
            { label: "factual", score: 0 },
          ],
        },
      ],
    };

    const [config] = datasetEvaluatorToAnnotationConfigs(evaluator);
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      threshold: undefined,
      optimizationDirection: "MINIMIZE",
    });
  });
});

const continuousConfig = (name: string) => ({
  __typename: "ContinuousAnnotationConfig",
  name,
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
});

describe("datasetEvaluatorsToAnnotationConfigs", () => {
  it("names a one-question decision binding's column after the binding", () => {
    const configs = datasetEvaluatorsToAnnotationConfigs([
      {
        kind: "DECISION",
        name: "triage-judge",
        outputConfigs: [continuousConfig("accurate")],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual(["triage-judge"]);
    expect(configs[0].annotationType).toBe("CONTINUOUS");
  });

  it("names a multi-question decision binding's columns {binding}.{question}", () => {
    const configs = datasetEvaluatorsToAnnotationConfigs([
      {
        kind: "DECISION",
        name: "triage-judge",
        outputConfigs: [
          continuousConfig("accurate"),
          continuousConfig("polite"),
        ],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual([
      "triage-judge.accurate",
      "triage-judge.polite",
    ]);
  });

  it("reads the kind from the bound evaluator when the binding has none", () => {
    const configs = datasetEvaluatorsToAnnotationConfigs([
      {
        evaluator: { kind: "DECISION" },
        name: "dogfood_cs_action_match",
        outputConfigs: [continuousConfig("action_matches")],
      },
    ]);
    expect(configs.map((config) => config.name)).toEqual([
      "dogfood_cs_action_match",
    ]);
  });

  it("leaves other kinds' output config names untouched", () => {
    const configs = datasetEvaluatorsToAnnotationConfigs([
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

describe("getDecisionAnnotationName", () => {
  it("uses the binding name for a single question", () => {
    expect(
      getDecisionAnnotationName({
        bindingName: "judge",
        questionName: "q",
        questionCount: 1,
      })
    ).toBe("judge");
  });
  it("qualifies the name for several questions", () => {
    expect(
      getDecisionAnnotationName({
        bindingName: "judge",
        questionName: "q",
        questionCount: 2,
      })
    ).toBe("judge.q");
  });
});
