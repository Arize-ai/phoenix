import type { Meta, StoryObj } from "@storybook/react";
import { Pressable } from "react-aria";

import {
  Flex,
  RichTooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import {
  TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
  TokenDetailsBreakdown,
  TokenDetailsBreakdownSkeleton,
} from "@phoenix/components/trace/TokenDetailsBreakdown";

/**
 * The body of every token and cost tooltip in the app: the trace tree's row
 * preview, the span header, and the token counts and costs in tables.
 *
 * A bar per measure splits the total into token types, with a tick where the
 * prompt ends and the completion begins, and a table gives each type's value
 * and share in every measure. Because the bars share their segments, a type's
 * share of the tokens reads against its share of the cost: cache reads that
 * are most of the context window but a fraction of the bill.
 *
 * `TokenCountDetails` and `TokenCostsDetails` are thin wrappers over this
 * component for surfaces that show one measure only.
 */
const meta = {
  title: "Tokens/Token Details Breakdown",
  component: TokenDetailsBreakdown,
  parameters: {
    width: TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TokenDetailsBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A cached LLM call, priced. Cache reads dominate the tokens but not the
 * cost, and the output is the reverse.
 */
export const TokensAndCost: Story = {
  args: {
    tokens: {
      total: 49_494,
      prompt: 48_210,
      completion: 1_284,
      promptDetails: { input: 3_490, cache_read: 41_600, cache_write: 3_120 },
    },
    costs: {
      total: 0.0539,
      prompt: 0.0347,
      completion: 0.0193,
      promptDetails: { input: 0.0105, cache_read: 0.0125, cache_write: 0.0117 },
    },
  },
};

/**
 * Token counts alone, as a local model reports them.
 */
export const TokensOnly: Story = {
  args: {
    tokens: { total: 812, prompt: 600, completion: 212 },
  },
};

/**
 * Cost alone, as a cost tooltip in a table shows it. Reasoning tokens keep
 * the color they carry in the project metrics charts.
 */
export const CostOnly: Story = {
  args: {
    costs: {
      total: 27.09,
      prompt: 24.04,
      completion: 3.05,
      promptDetails: { input: 4.04, cache_read: 16.0, cache_write: 4.0 },
      completionDetails: { output: 2.05, reasoning: 1.0 },
    },
  },
};

/**
 * Details recorded before a token type was tracked can add up to less than
 * the side they belong to. The unaccounted remainder is attributed to plain
 * input or output rather than left as a gap, so the bar still fills its
 * total.
 */
export const IncompleteDetails: Story = {
  args: {
    tokens: {
      total: 84_320,
      prompt: 78_100,
      completion: 6_220,
      // Only the cache is broken out; the remaining 16,774 prompt tokens
      // surface as Input.
      promptDetails: { cache_read: 61_326 },
    },
  },
};

/**
 * A token type used on both sides, such as audio heard and audio spoken, is
 * told apart by the side it was used on, and the second side gives up the
 * type's color so the two rows and segments cannot be confused.
 */
export const TypeOnBothSides: Story = {
  args: {
    tokens: {
      total: 9_400,
      prompt: 7_000,
      completion: 2_400,
      promptDetails: { input: 3_000, audio: 4_000 },
      completionDetails: { output: 1_400, audio: 1_000 },
    },
  },
};

/**
 * An experiment's average per run, where the totals are qualified rather
 * than plain.
 */
export const Average: Story = {
  args: { ...CostOnly.args, totalLabel: "Average" },
};

/**
 * Totals whose split was never recorded. Each measure is one neutral bar of
 * its total and there is no table. This is a final state, not a loading one:
 * while a split loads, `TokenDetailsBreakdownSkeleton` stands in instead.
 */
export const TotalsOnly: Story = {
  args: {
    tokens: { total: 49_494 },
    costs: { total: 0.0539 },
  },
};

/**
 * The skeleton every token and cost tooltip shows while its breakdown loads.
 * It is given the totals the tooltip already has, so the heading, the
 * measure labels and the totals are real, and the split, the bars and the
 * table rows pulse in their places on the loaded layout's grid.
 */
export const Loading: Story = {
  render: (args) => <TokenDetailsBreakdownSkeleton {...args} />,
  args: TotalsOnly.args,
};

/**
 * The skeleton over the breakdown it stands in for, at the same width. The
 * header, bars, rule and table columns line up; the number of table rows is
 * a guess, since the skeleton cannot know how many token types the span
 * used.
 */
export const LoadingAndLoaded: Story = {
  render: (args) => (
    <Flex direction="column" gap="size-400">
      <TokenDetailsBreakdownSkeleton
        tokens={{ total: args.tokens?.total }}
        costs={{ total: args.costs?.total }}
        rows={4}
      />
      <TokenDetailsBreakdown {...args} />
    </Flex>
  ),
  args: TokensAndCost.args,
};

/**
 * A single measure loading over what it loads into, at the content width of
 * a tooltip left at its default cap, as the token count tooltips in tables
 * are. The header wraps in neither or in both.
 */
export const LoadingAndLoadedTokensOnly: Story = {
  render: (args) => (
    <Flex direction="column" gap="size-400">
      <TokenDetailsBreakdownSkeleton
        tokens={{ total: args.tokens?.total }}
        rows={2}
      />
      <TokenDetailsBreakdown {...args} />
    </Flex>
  ),
  args: TokensOnly.args,
  // The default tooltip cap less its padding
  parameters: { width: 268 },
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
          {0.0539}
        </TokenCosts>
      </Pressable>
      <RichTooltip
        placement="bottom"
        width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
      >
        <TooltipArrow />
        <TokenDetailsBreakdown {...args} />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: TokensAndCost.args,
};
