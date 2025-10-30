import { ComponentProps, useState } from "react";
import type { Meta } from "@storybook/react";

import { EvaluatorSelect } from "@phoenix/components/evaluators/EvaluatorSelect";

/**
 * A select component for choosing evaluators with search functionality.
 * Supports multiple selection and displays different evaluator types.
 */
const meta = {
  title: "EvaluatorSelect",
  component: EvaluatorSelect,
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
} satisfies Meta<typeof EvaluatorSelect>;

export default meta;

const sampleEvaluators: ComponentProps<typeof EvaluatorSelect>["evaluators"] = [
  {
    id: "1",
    name: "Correctness Evaluator",
    kind: "CODE",
  },
  {
    id: "2",
    name: "Creativity Evaluator",
    kind: "LLM",
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
  },
  {
    id: "7",
    name: "Jaccard Similarity Evaluator",
    kind: "CODE",
  },
];

const DefaultComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectionChange = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  return (
    <EvaluatorSelect
      evaluators={sampleEvaluators}
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      onNewEvaluatorPress={() => {}}
    />
  );
};

const NoEvaluatorsComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectionChange = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  return (
    <EvaluatorSelect
      evaluators={[]}
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      onNewEvaluatorPress={() => {}}
    />
  );
};

const WithAlreadyAddedEvaluatorsComponent = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>(["1", "3"]);

  const handleSelectionChange = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  const evaluatorsWithSomeAdded = sampleEvaluators.map((evaluator) => ({
    ...evaluator,
    alreadyAdded: evaluator.id === "2" || evaluator.id === "5",
  }));

  return (
    <EvaluatorSelect
      evaluators={evaluatorsWithSomeAdded}
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      onNewEvaluatorPress={() => {}}
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
