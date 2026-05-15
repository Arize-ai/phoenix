import { getPositiveOptimizationFromConfig } from "@phoenix/components/annotation/optimizationUtils";

import {
  datasetEvaluatorToAnnotationConfigs,
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

  it("maps a freeform config with threshold + MAXIMIZE to a positive optimization", () => {
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
    expect(getPositiveOptimizationFromConfig({ config, score: 0.8 })).toBe(
      true
    );
    expect(getPositiveOptimizationFromConfig({ config, score: 0.5 })).toBe(
      false
    );
  });

  it("maps a freeform config with bounds and MAXIMIZE to the bounded-midpoint result", () => {
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
    // Midpoint 0.5: 0.75 > 0.5 → true; 0.25 < 0.5 → false.
    expect(getPositiveOptimizationFromConfig({ config, score: 0.75 })).toBe(
      true
    );
    expect(getPositiveOptimizationFromConfig({ config, score: 0.25 })).toBe(
      false
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
    expect(getPositiveOptimizationFromConfig({ config, score: 5 })).toBeNull();
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
    expect(
      getPositiveOptimizationFromConfig({ config, score: 0.8 })
    ).toBeNull();
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
});
