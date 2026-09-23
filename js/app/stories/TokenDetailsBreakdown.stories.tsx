import type { Meta, StoryObj } from "@storybook/react";
import { Pressable } from "react-aria";

import { RichTooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenDetailsBreakdown } from "@phoenix/components/trace/TokenDetailsBreakdown";
import { formatCost, formatNumber } from "@phoenix/utils/numberFormatUtils";

/**
 * The body of every cost and token tooltip in the app. A total is split into
 * prompt and completion and drawn as a proportional bar, so the split reads at
 * a glance instead of having to be inferred from the numbers.
 *
 * Prompt and completion get a bar of their own when they break down further by
 * token type. A group whose details amount to a single token type is left out,
 * since its bar would restate the legend row above it.
 *
 * `TokenCostsDetails` and `TokenCountDetails` are thin wrappers over this
 * component that fix the formatter and the value label.
 */
const meta = {
  title: "Tokens/Token Details Breakdown",
  component: TokenDetailsBreakdown,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    formatter: {
      control: false,
      description: "Renders a value in the unit being broken down.",
    },
  },
} satisfies Meta<typeof TokenDetailsBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Cost split between prompt and completion. With no token-type details, the
 * breakdown is a single bar.
 */
export const Cost: Story = {
  args: {
    valueLabel: "cost",
    formatter: formatCost,
    total: 27.09,
    prompt: 24.04,
    completion: 3.05,
  },
};

/**
 * A cached conversation. The prompt bar shows what the cache absorbed, which is
 * the detail that explains an otherwise surprising prompt cost.
 */
export const CostWithCacheDetails: Story = {
  args: {
    valueLabel: "cost",
    formatter: formatCost,
    total: 27.09,
    prompt: 24.04,
    completion: 3.05,
    promptDetails: {
      input: 4.04,
      cache_read: 16.0,
      cache_write: 4.0,
    },
  },
};

/**
 * Token counts, with details on both sides of the split. Reasoning tokens keep
 * the same color here that they carry in the project metrics charts.
 */
export const TokenCounts: Story = {
  args: {
    valueLabel: "tokens",
    formatter: formatNumber,
    total: 84_320,
    prompt: 78_100,
    completion: 6_220,
    promptDetails: {
      input: 12_774,
      cache_read: 61_326,
      cache_write: 4_000,
    },
    completionDetails: {
      output: 4_220,
      reasoning: 2_000,
    },
  },
};

/**
 * Details recorded before a token type was tracked can add up to less than the
 * group they belong to. The unaccounted remainder is attributed to Input or
 * Output rather than left as a gap, so the bar still fills its total.
 */
export const IncompleteDetails: Story = {
  args: {
    valueLabel: "tokens",
    formatter: formatNumber,
    total: 84_320,
    prompt: 78_100,
    completion: 6_220,
    // Only the cache is broken out; the remaining 16,774 prompt tokens
    // surface as Input.
    promptDetails: {
      cache_read: 61_326,
    },
  },
};

/**
 * An experiment average, where the total is labeled rather than "Total".
 */
export const AverageLabel: Story = {
  args: {
    valueLabel: "cost",
    totalLabel: "Average",
    formatter: formatCost,
    total: 0.34,
    prompt: 0.28,
    completion: 0.06,
  },
};

/**
 * Nothing was spent. The bar is dropped rather than drawn empty, which would
 * read as a rendering failure.
 */
export const ZeroCost: Story = {
  args: {
    valueLabel: "cost",
    formatter: formatCost,
    total: 0,
    prompt: 0,
    completion: 0,
  },
};

/**
 * How the breakdown is actually seen: inside the tooltip of a cost, where it
 * has to stay legible at tooltip width.
 */
export const InTooltip: Story = {
  render: (args) => (
    <TooltipTrigger delay={0}>
      <Pressable>
        <TokenCosts role="button" tabIndex={0}>
          {27.09}
        </TokenCosts>
      </Pressable>
      <RichTooltip placement="bottom">
        <TooltipArrow />
        <TokenDetailsBreakdown {...args} />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    valueLabel: "cost",
    formatter: formatCost,
    total: 27.09,
    prompt: 24.04,
    completion: 3.05,
    promptDetails: {
      input: 4.04,
      cache_read: 16.0,
      cache_write: 4.0,
    },
    completionDetails: {
      output: 2.05,
      reasoning: 1.0,
    },
  },
};
