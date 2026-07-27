import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import { Flex, OverflowRow, Switch, Token, View } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Utility/OverflowRow",
  component: OverflowRow,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const LABELS = [
  "correctness",
  "hallucination",
  "toxicity",
  "relevance",
  "conciseness",
  "helpfulness",
  "coherence",
  "groundedness",
];

const COLORS = [
  "var(--global-color-celery-600)",
  "var(--global-color-fuchsia-600)",
  "var(--global-color-indigo-600)",
  "var(--global-color-magenta-600)",
  "var(--global-color-seafoam-600)",
  "var(--global-color-yellow-600)",
  "var(--global-color-purple-600)",
  "var(--global-color-chartreuse-600)",
];

const Tokens = () => (
  <>
    {LABELS.map((label, index) => (
      <Token key={label} color={COLORS[index % COLORS.length]} size="M">
        {label}
      </Token>
    ))}
  </>
);

const Template = ({ width }: { width: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <Flex direction="column" gap="size-200">
      <Switch isSelected={isExpanded} onChange={setIsExpanded}>
        Expanded
      </Switch>
      <View
        borderWidth="thin"
        borderColor="default"
        borderRadius="medium"
        padding="size-100"
        width={`${width}px`}
      >
        <OverflowRow isExpanded={isExpanded}>
          <Tokens />
        </OverflowRow>
      </View>
    </Flex>
  );
};

export const Default: StoryFn = () => <Template width={320} />;

export const Narrow: StoryFn = () => <Template width={160} />;

export const FitsWithoutOverflow: StoryFn = () => <Template width={900} />;

/**
 * Narrower than a single token: every item goes to the badge rather than one
 * rendering cut off.
 */
export const BadgeOnly: StoryFn = () => <Template width={80} />;
