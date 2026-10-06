import {
  type DatasetEvaluatorForConfig,
  datasetEvaluatorsToAnnotationConfigs,
} from "@phoenix/utils/datasetEvaluatorUtils";

const experimentDatasetEvaluators: DatasetEvaluatorForConfig[] = [
  {
    name: "qa_correctness",
    outputConfigs: [
      {
        __typename: "ContinuousAnnotationConfig",
        name: "qa_correctness",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    ],
  },
  {
    name: "has_results",
    outputConfigs: [
      {
        __typename: "FreeformAnnotationConfig",
        name: "has_results",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.5,
        lowerBound: null,
        upperBound: null,
      },
    ],
  },
  {
    name: "sql_syntax_valid",
    outputConfigs: [
      {
        __typename: "CategoricalAnnotationConfig",
        name: "sql_syntax_valid",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "valid", score: 1 },
          { label: "invalid", score: 0 },
        ],
      },
    ],
  },
  {
    name: "toxicity",
    outputConfigs: [
      {
        __typename: "ContinuousAnnotationConfig",
        name: "toxicity",
        optimizationDirection: "MINIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    ],
  },
  {
    name: "row_overlap",
    outputConfigs: [
      {
        __typename: "FreeformAnnotationConfig",
        name: "row_overlap",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.8,
        lowerBound: null,
        upperBound: null,
      },
    ],
  },
  {
    name: "query_complexity",
    outputConfigs: [
      {
        __typename: "CategoricalAnnotationConfig",
        name: "query_complexity",
        optimizationDirection: "NONE",
        values: [
          { label: "simple", score: 0 },
          { label: "moderate", score: 0.5 },
          { label: "complex", score: 1 },
        ],
      },
    ],
  },
  {
    name: "mixed_evaluation",
    outputConfigs: [
      {
        __typename: "ContinuousAnnotationConfig",
        name: "mixed_evaluation",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    ],
  },
];

export const experimentAnnotationConfigs = datasetEvaluatorsToAnnotationConfigs(
  experimentDatasetEvaluators
);
