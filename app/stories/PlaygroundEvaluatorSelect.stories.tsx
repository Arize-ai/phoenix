import { ComponentProps, useState } from "react";
import type { Meta } from "@storybook/react";

import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";

/**
 * A select component for choosing evaluators in the playground.
 * Supports multiple selection and displays different evaluator types.
 */
const meta = {
  title: "Playground/PlaygroundEvaluatorSelect",
  component: PlaygroundEvaluatorSelect,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    evaluators: {
      control: "object",
      description: "Array of evaluator options to display",
    },
    selectedIds: {
      control: "object",
      description: "Array of selected evaluator IDs",
    },
    onSelectionChange: {
      action: "selectionChanged",
      description:
        "Callback fired when an individual evaluator is selected/deselected",
    },
  },
} satisfies Meta<typeof PlaygroundEvaluatorSelect>;

export default meta;

const sampleEvaluators: ComponentProps<
  typeof PlaygroundEvaluatorSelect
>["evaluators"] = [
  {
    id: "1",
    displayName: "Correctness Evaluator",
    kind: "LLM",
    isBuiltIn: false,
  },
  {
    id: "2",
    displayName: "Creativity Evaluator",
    kind: "LLM",
    isBuiltIn: false,
    annotationName: "creativity_score",
  },
  {
    id: "3",
    displayName: "Relevance Evaluator",
    kind: "LLM",
    isBuiltIn: false,
  },
  {
    id: "4",
    displayName:
      "An evaluator that has a really really really really really really really really long name",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
    kind: "LLM",
    isBuiltIn: false,
  },
  {
    id: "5",
    displayName: "Accuracy Evaluator",
    kind: "CODE",
    isBuiltIn: true,
  },
  {
    id: "6",
    displayName: "Hallucination Evaluator",
    annotationName: "hallucination",
    kind: "LLM",
    isBuiltIn: false,
  },
  {
    id: "7",
    displayName: "Jaccard Similarity Evaluator",
    kind: "CODE",
    isBuiltIn: true,
  },
  {
    id: "8",
    displayName: "Short",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
    kind: "LLM",
    isBuiltIn: false,
  },
];

const DefaultComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <PlaygroundEvaluatorSelect
      datasetId="1"
      evaluators={sampleEvaluators}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );
};

const NoEvaluatorsComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <PlaygroundEvaluatorSelect
      datasetId="1"
      evaluators={[]}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );
};

const WithAlreadyAddedEvaluatorsComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>(["1", "3"]);

  const evaluatorsWithSomeAdded = sampleEvaluators.map((evaluator) => ({
    ...evaluator,
    alreadyAdded: evaluator.id === "2" || evaluator.id === "5",
  }));

  return (
    <PlaygroundEvaluatorSelect
      datasetId="1"
      evaluators={evaluatorsWithSomeAdded}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );
};

/**
 * Default story with multiple evaluator options including both LLM and CODE types
 */
export const Default = {
  render: () => <DefaultComponent />,
};

/**
 * Story showing the empty state when no evaluators are available
 */
export const NoEvaluators = {
  render: () => <NoEvaluatorsComponent />,
};

/**
 * Story showing evaluators with some already selected
 */
export const WithAlreadyAddedEvaluators = {
  render: () => <WithAlreadyAddedEvaluatorsComponent />,
};
