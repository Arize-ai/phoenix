import type { Meta, StoryObj } from "@storybook/react";
import { Pressable } from "react-aria";

import {
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";

/**
 * TokenCosts displays a cost in dollars. Where a breakdown is available it is
 * the trigger of a tooltip that splits the cost by prompt, completion and
 * token type.
 *
 * This entry shows the cost itself and how its tooltip opens. The tooltip's
 * content, `TokenCostsDetails`, is the cost side of `Token Details
 * Breakdown`, and every shape it takes is documented there.
 */
const meta = {
  title: "Domains/Cost/Token Costs",
  component: TokenCosts,
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=569-583",
    },
  },
  tags: ["updated", "unreviewed", "incomplete"],
  args: { children: 0.0342, size: "M" },
} satisfies Meta<typeof TokenCosts>;

export default meta;
type Story = StoryObj<typeof meta>;

type CostValue = { label: string; value: number | null };

/** The formatting cases: two decimals, under a cent, and no cost. */
const VALUES: CostValue[] = [
  { label: "High — 2.45", value: 2.45 },
  { label: "Low — 0.001, under a cent", value: 0.001 },
  { label: "No cost — null", value: null },
];

const SIZES: { label: string; size: "M" | "S" }[] = [
  { label: "Default (M)", size: "M" },
  { label: "Small (S)", size: "S" },
];

/**
 * Both sizes against each kind of value. A cost of a cent or more shows two
 * decimals, a smaller one reads "<$0.01", and a missing cost shows "--".
 * Tables and session lists use the small size; the default is for headers
 * and summaries.
 */
export const SizesAndValues: Story = {
  name: "Sizes and Values",
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `auto repeat(${VALUES.length}, auto)`,
        columnGap: 32,
        rowGap: 16,
        alignItems: "center",
      }}
    >
      <div />
      {VALUES.map(({ label }) => (
        <Text key={label} size="S" color="text-700">
          {label}
        </Text>
      ))}
      {SIZES.map(({ label, size }) => [
        <Text key={label} size="S" color="text-700">
          {label}
        </Text>,
        ...VALUES.map(({ label: valueLabel, value }) => (
          <TokenCosts key={`${label}-${valueLabel}`} size={size}>
            {value}
          </TokenCosts>
        )),
      ])}
    </div>
  ),
};

/**
 * How a cost opens its breakdown, as the span, trace and session cost cells
 * compose it: the cost is a pressable button and the breakdown opens beside
 * it. Held open through the trigger, so hovering or leaving the cost does not
 * close it. What the breakdown can contain is documented in `Token Details
 * Breakdown`.
 */
export const WithTooltip: Story = {
  name: "With Tooltip",
  render: () => (
    // The open tooltip is portaled and takes no layout space, so reserve
    // room for it beside the cost.
    <div
      style={{ display: "flex", alignItems: "center", width: 440, height: 480 }}
    >
      <TooltipTrigger isOpen>
        <Pressable>
          <TokenCosts role="button" tabIndex={0}>
            {0.157}
          </TokenCosts>
        </Pressable>
        <RichTooltip placement="end">
          <TooltipArrow />
          <TokenCostsDetails
            total={0.157}
            prompt={0.096}
            completion={0.061}
            promptDetails={{
              input: 0.045,
              cache_read: 0.012,
              cache_write: 0.008,
              tool: 0.021,
              audio: 0.01,
            }}
            completionDetails={{
              output: 0.035,
              reasoning: 0.016,
              function_calls: 0.01,
            }}
          />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
};

/**
 * Multiple cost displays in a row to show interaction.
 */
export const MultipleCostDisplays: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S">{0.0123}</TokenCosts>
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails total={0.0123} prompt={0.0123} />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S">{0.0456}</TokenCosts>
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails total={0.0456} prompt={0.0256} completion={0.02} />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S">{0.1234}</TokenCosts>
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails
            total={0.1234}
            prompt={0.0567}
            completion={0.0667}
            promptDetails={{
              input: 0.0234,
              tool: 0.0333,
            }}
            completionDetails={{
              output: 0.0456,
              reasoning: 0.0211,
            }}
          />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
  args: {
    children: 0.1813,
    size: "S",
  },
};

/**
 * Cost comparison scenario showing different cost levels.
 */
export const CostComparison: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "8px", fontSize: "12px", color: "#666" }}>
          Basic Query
        </div>
        <TooltipTrigger>
          <Pressable>
            <TokenCosts size="M">{0.001}</TokenCosts>
          </Pressable>
          <RichTooltip>
            <TokenCostsDetails
              total={0.001}
              prompt={0.0007}
              completion={0.0003}
            />
          </RichTooltip>
        </TooltipTrigger>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "8px", fontSize: "12px", color: "#666" }}>
          Complex Query
        </div>
        <TooltipTrigger>
          <Pressable>
            <TokenCosts size="M">{0.056}</TokenCosts>
          </Pressable>
          <RichTooltip>
            <TokenCostsDetails
              total={0.056}
              prompt={0.032}
              completion={0.024}
              promptDetails={{
                input: 0.018,
                tool: 0.014,
              }}
              completionDetails={{
                output: 0.016,
                reasoning: 0.008,
              }}
            />
          </RichTooltip>
        </TooltipTrigger>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "8px", fontSize: "12px", color: "#666" }}>
          Heavy Processing
        </div>
        <TooltipTrigger>
          <Pressable>
            <TokenCosts size="M">{0.234}</TokenCosts>
          </Pressable>
          <RichTooltip>
            <TokenCostsDetails
              total={0.234}
              prompt={0.145}
              completion={0.089}
              promptDetails={{
                input: 0.067,
                cache_read: 0.023,
                tool: 0.034,
                audio: 0.021,
              }}
              completionDetails={{
                output: 0.045,
                reasoning: 0.034,
                function_calls: 0.01,
              }}
            />
          </RichTooltip>
        </TooltipTrigger>
      </div>
    </div>
  ),
  args: {
    children: 0.234,
    size: "M",
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  // Top-aligned, so the breakdown has room to open below the value.
  render: (args) => (
    <div style={{ alignSelf: "flex-start" }}>
      <TooltipTrigger isOpen>
        <Pressable>
          <TokenCosts {...args} />
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails
            total={0.0342}
            prompt={0.023}
            completion={0.0112}
          />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
  args: {
    children: 0.0342,
    size: "M",
  },
};
