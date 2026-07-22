import type { Meta, StoryObj } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import { RichTokenBreakdown } from "@phoenix/components/RichTokenCostBreakdown";
import { formatCost, formatInt } from "@phoenix/utils/numberFormatUtils";

const meta = {
  title: "Tokens/Rich Token Breakdown",
  component: RichTokenBreakdown,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Displays a total with a proportional segment bar and a color-keyed value breakdown.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    formatter: {
      control: false,
      description: "Formats the total and segment values.",
    },
  },
  render: (args) => (
    <View width="size-3600">
      <RichTokenBreakdown {...args} />
    </View>
  ),
} satisfies Meta<typeof RichTokenBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Token consumption split between prompt and completion tokens. */
export const TokenCounts: Story = {
  args: {
    valueLabel: "tokens",
    totalValue: 84_320,
    formatter: formatInt,
    segments: [
      {
        name: "Prompt",
        value: 78_100,
      },
      {
        name: "Completion",
        value: 6_220,
      },
    ],
  },
};

/**
 * A real PXI conversation turn. The two breakdowns preserve the wire model's
 * hierarchy: prompt and completion partition the total, while cache reads and
 * writes are optional details within the prompt total.
 */
export const CachedConversation: Story = {
  render: (args) => (
    <View width="size-3600">
      <Flex direction="column" gap="size-300">
        <RichTokenBreakdown {...args} />
        <RichTokenBreakdown
          valueLabel="prompt tokens"
          totalValue={15_937}
          formatter={formatInt}
          segments={[
            {
              name: "Cache read",
              value: 15_326,
            },
            {
              name: "Cache write",
              value: 608,
            },
          ]}
        />
      </Flex>
    </View>
  ),
  args: {
    valueLabel: "tokens",
    totalValue: 16_567,
    formatter: formatInt,
    segments: [
      {
        name: "Prompt",
        value: 15_937,
      },
      {
        name: "Completion",
        value: 630,
      },
    ],
  },
};

/** Token cost split between prompt and completion charges. */
export const TokenCosts: Story = {
  args: {
    valueLabel: "cost",
    totalValue: 0.1842,
    formatter: formatCost,
    segments: [
      {
        name: "Prompt",
        value: 0.132,
      },
      {
        name: "Completion",
        value: 0.0522,
      },
    ],
  },
};
