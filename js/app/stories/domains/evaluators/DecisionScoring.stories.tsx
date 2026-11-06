import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type {
  DecisionQuestionDefinition,
  DecisionScoringPolicyValue,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { buildDefaultPolicy } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";

const questions: DecisionQuestionDefinition[] = [
  { type: "predicate", name: "relevant" },
  { type: "choice", name: "tone", choices: ["friendly", "neutral", "hostile"] },
  { type: "scale", name: "clarity", levels: ["low", "medium", "high"] },
];

const policy: DecisionScoringPolicyValue = {
  questions: [
    {
      predicate: {
        name: "relevant",
        threshold: 0.5,
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      choice: {
        name: "tone",
        scores: [
          { choice: "friendly", score: 1 },
          { choice: "hostile", score: -1 },
        ],
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      scale: {
        name: "clarity",
        includeLabel: true,
        optimizationDirection: "NONE",
      },
    },
  ],
};

const invalidPolicy: DecisionScoringPolicyValue = {
  questions: [
    {
      predicate: {
        name: "relevant",
        threshold: 1.5,
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      choice: {
        name: "tone",
        scores: [{ choice: "friendly", score: Number.NaN }],
        optimizationDirection: "MAXIMIZE",
      },
    },
    policy.questions[2],
  ],
};

function ScoringEditor({
  initial,
  isDisabled,
}: {
  initial: DecisionScoringPolicyValue;
  isDisabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DecisionScoringPolicyEditor
      questions={questions}
      value={value}
      onChange={setValue}
      isDisabled={isDisabled}
    />
  );
}

const meta: Meta<typeof DecisionScoringPolicyEditor> = {
  title: "Domains/Evaluators/Decision Scoring",
  component: DecisionScoringPolicyEditor,
  parameters: { layout: "padded", controls: { disable: true } },
};

export default meta;

type Story = StoryObj<typeof DecisionScoringPolicyEditor>;

export const Default: Story = {
  tags: ["updated", "complete", "unreviewed", "!dev"],
  render: () => <ScoringEditor initial={policy} />,
};

export const UnsetScores: Story = {
  tags: ["updated", "complete", "unreviewed", "!dev"],
  render: () => <ScoringEditor initial={buildDefaultPolicy(questions)} />,
};

export const Invalid: Story = {
  tags: ["updated", "complete", "unreviewed", "!dev"],
  render: () => <ScoringEditor initial={invalidPolicy} />,
};

export const Disabled: Story = {
  tags: ["updated", "complete", "unreviewed", "!dev"],
  render: () => <ScoringEditor initial={policy} isDisabled />,
};
