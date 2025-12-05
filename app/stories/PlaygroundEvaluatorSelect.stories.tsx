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
    name: "Correctness Evaluator",
  },
  {
    id: "2",
    name: "Creativity Evaluator",
    annotationName: "creativity_score",
  },
  {
    id: "3",
    name: "Relevance Evaluator",
  },
  {
    id: "4",
    name: "An evaluator that has a really really really really really really really really long name",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
  },
  {
    id: "5",
    name: "Accuracy Evaluator",
  },
  {
    id: "6",
    name: "Hallucination Evaluator",
    annotationName: "hallucination",
  },
  {
    id: "7",
    name: "Jaccard Similarity Evaluator",
  },
  {
    id: "8",
    name: "Short",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
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
