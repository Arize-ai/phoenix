import { ComponentProps } from "react";
import type { Meta } from "@storybook/react";

import { DatasetEvaluatorSelect } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorSelect";

/**
 * A select component for choosing evaluators in dataset pages.
 * Supports single selection and displays different evaluator types.
 */
const meta = {
  title: "Datasets/DatasetEvaluatorSelect",
  component: DatasetEvaluatorSelect,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    evaluators: {
      control: "object",
      description: "Array of evaluator options to display",
    },
    onSelectionChange: {
      action: "selectionChanged",
      description: "Callback fired when an evaluator is selected",
    },
    addNewEvaluatorLink: {
      control: "text",
      description: "Link to the new evaluator page",
    },
  },
} satisfies Meta<typeof DatasetEvaluatorSelect>;

export default meta;

const sampleEvaluators: ComponentProps<
  typeof DatasetEvaluatorSelect
>["evaluators"] = [
  {
    id: "1",
    name: "Correctness Evaluator",
    kind: "CODE",
  },
  {
    id: "2",
    name: "Creativity Evaluator",
    kind: "LLM",
    annotationName: "creativity_score",
  },
  {
    id: "3",
    name: "Relevance Evaluator",
    kind: "CODE",
  },
  {
    id: "4",
    name: "An evaluator that has a really really really really really really really really long name",
    kind: "LLM",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
  },
  {
    id: "5",
    name: "Accuracy Evaluator",
    kind: "CODE",
  },
  {
    id: "6",
    name: "Hallucination Evaluator",
    kind: "LLM",
    annotationName: "hallucination",
  },
  {
    id: "7",
    name: "Jaccard Similarity Evaluator",
    kind: "CODE",
  },
];

/**
 * Default story with multiple evaluator options including both LLM and CODE types
 */
export const Default = {
  args: {
    evaluators: sampleEvaluators,
    addNewEvaluatorLink: "",
  },
};

/**
 * Story showing the empty state when no evaluators are available
 */
export const NoEvaluators = {
  args: {
    evaluators: [],
    addNewEvaluatorLink: "",
  },
};

/**
 * Story showing evaluators with some already added to the dataset
 */
export const WithAlreadyAddedEvaluators = {
  args: {
    evaluators: sampleEvaluators.map((evaluator) => ({
      ...evaluator,
      alreadyAdded: evaluator.id === "2" || evaluator.id === "4",
    })),
    addNewEvaluatorLink: "",
  },
};

/**
 * Story showing evaluators with very short names
 */
export const WithVeryShortNames = {
  args: {
    evaluators: [
      {
        id: "1",
        name: "A",
        kind: "CODE",
        alreadyAdded: true,
        annotationName: "A",
      },
      {
        id: "2",
        name: "B",
        kind: "CODE",
        alreadyAdded: false,
        annotationName: "B",
      },
    ],
    addNewEvaluatorLink: "",
  },
};
