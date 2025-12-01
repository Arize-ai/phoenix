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
    addNewEvaluatorLink: {
      control: "text",
      description: "Link to the new evaluator page",
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
    isAssignedToDataset: false,
  },
  {
    id: "2",
    name: "Creativity Evaluator",
    annotationName: "creativity_score",
    isAssignedToDataset: false,
  },
  {
    id: "3",
    name: "Relevance Evaluator",
    isAssignedToDataset: false,
  },
  {
    id: "4",
    name: "An evaluator that has a really really really really really really really really long name",
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
    isAssignedToDataset: false,
  },
  {
    id: "5",
    name: "Accuracy Evaluator",
    isAssignedToDataset: true,
  },
  {
    id: "6",
    name: "Hallucination Evaluator",
    annotationName: "hallucination",
    isAssignedToDataset: false,
  },
  {
    id: "7",
    name: "Jaccard Similarity Evaluator",
    isAssignedToDataset: true,
  },
  {
    id: "8",
    name: "Short",
    isAssignedToDataset: true,
    annotationName: "annotation_name_that_is_very_long_and_should_be_truncated",
  },
];

const DefaultComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <PlaygroundEvaluatorSelect
      evaluators={sampleEvaluators}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      addNewEvaluatorLink=""
    />
  );
};

const NoEvaluatorsComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <PlaygroundEvaluatorSelect
      evaluators={[]}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      addNewEvaluatorLink=""
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
      evaluators={evaluatorsWithSomeAdded}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      addNewEvaluatorLink=""
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
