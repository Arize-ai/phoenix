import type { Meta, StoryObj } from "@storybook/react";

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
  },
} satisfies Meta<typeof EvaluatorSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleEvaluators = [
  {
    id: "1",
    name: "Code Quality Evaluator",
    kind: "CODE",
  },
  {
    id: "2",
    name: "GPT-4 Response Evaluator",
    kind: "LLM",
  },
  {
    id: "3",
    name: "Syntax Checker",
    kind: "CODE",
  },
  {
    id: "4",
    name: "An evaluator that has a really really really really long name",
    kind: "LLM",
  },
];

/**
 * Default story with multiple evaluator options including both LLM and CODE types
 */
export const Default: Story = {
  args: {
    evaluators: sampleEvaluators,
  },
};

/**
 * Story showing the empty state when no evaluators are available
 */
export const NoEvaluators: Story = {
  args: {
    evaluators: [],
  },
};
