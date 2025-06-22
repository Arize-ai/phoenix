import { Suspense } from "react";
import { Pressable } from "react-aria";
import type { Meta, StoryObj } from "@storybook/react";

import { Loading, RichTooltip, TooltipTrigger } from "@phoenix/components";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";

/**
 * TokenCosts displays a cost value with an icon. When composed with tooltips,
 * it can show detailed breakdowns of cost usage by token type and prompt/completion.
 */
const meta = {
  title: "TokenCosts",
  component: TokenCosts,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "number",
      description: "The cost value to display",
    },
    size: {
      control: "select",
      options: ["S", "M"],
      description: "Size of the cost display",
    },
  },
} satisfies Meta<typeof TokenCosts>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic cost display without tooltip.
 */
export const Default: Story = {
  args: {
    children: 0.0342,
    size: "M",
  },
};

/**
 * Small size cost display.
 */
export const Small: Story = {
  args: {
    children: 0.0156,
    size: "S",
  },
};

/**
 * High cost value.
 */
export const HighCost: Story = {
  args: {
    children: 2.45,
    size: "M",
  },
};

/**
 * Very low cost value.
 */
export const LowCost: Story = {
  args: {
    children: 0.001,
    size: "M",
  },
};

/**
 * Cost with null value (shows "--").
 */
export const NullValue: Story = {
  args: {
    children: null,
    size: "M",
  },
};

/**
 * Cost with basic tooltip breakdown.
 */
export const WithBasicTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails total={0.0342} prompt={0.023} completion={0.0112} />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.0342,
    size: "M",
  },
};

/**
 * Cost with comprehensive tooltip breakdown showing token types.
 */
export const WithDetailedTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails
          total={0.157}
          prompt={0.096}
          completion={0.061}
          promptDetails={{
            input: 0.045,
            "cache read": 0.012,
            "cache write": 0.008,
            tool: 0.021,
            audio: 0.01,
          }}
          completionDetails={{
            output: 0.035,
            reasoning: 0.016,
            "function calls": 0.01,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.157,
    size: "M",
  },
};

/**
 * Small cost with tooltip.
 */
export const SmallWithTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails total={0.0156} prompt={0.0089} completion={0.0067} />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.0156,
    size: "S",
  },
};

/**
 * Cost with loading state in tooltip.
 */
export const WithLoadingTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <Suspense fallback={<Loading />}>
          <TokenCostsDetails
            total={0.089}
            prompt={0.052}
            completion={0.037}
            promptDetails={{
              input: 0.025,
              "cache read": 0.015,
              tool: 0.012,
            }}
            completionDetails={{
              output: 0.025,
              reasoning: 0.012,
            }}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.089,
    size: "M",
  },
};

/**
 * Cost showing prompt-only breakdown.
 */
export const PromptOnlyTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails
          prompt={0.0234}
          promptDetails={{
            input: 0.018,
            tool: 0.0054,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.0234,
    size: "M",
  },
};

/**
 * Cost showing completion-only breakdown.
 */
export const CompletionOnlyTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails
          completion={0.0412}
          completionDetails={{
            output: 0.0312,
            reasoning: 0.01,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 0.0412,
    size: "M",
  },
};

/**
 * High-cost scenario with detailed breakdown.
 */
export const HighCostDetailed: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCosts {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCostsDetails
          total={2.45}
          prompt={1.23}
          completion={1.22}
          promptDetails={{
            input: 0.45,
            "cache read": 0.23,
            "cache write": 0.15,
            tool: 0.28,
            audio: 0.12,
          }}
          completionDetails={{
            output: 0.67,
            reasoning: 0.35,
            "function calls": 0.2,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 2.45,
    size: "M",
  },
};

/**
 * Multiple cost displays in a row to show interaction.
 */
export const MultipleCostDisplays: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S" role="button">
            {0.0123}
          </TokenCosts>
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails total={0.0123} prompt={0.0123} />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S" role="button">
            {0.0456}
          </TokenCosts>
        </Pressable>
        <RichTooltip>
          <TokenCostsDetails total={0.0456} prompt={0.0256} completion={0.02} />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCosts size="S" role="button">
            {0.1234}
          </TokenCosts>
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
            <TokenCosts size="M" role="button">
              {0.001}
            </TokenCosts>
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
            <TokenCosts size="M" role="button">
              {0.056}
            </TokenCosts>
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
            <TokenCosts size="M" role="button">
              {0.234}
            </TokenCosts>
          </Pressable>
          <RichTooltip>
            <TokenCostsDetails
              total={0.234}
              prompt={0.145}
              completion={0.089}
              promptDetails={{
                input: 0.067,
                "cache read": 0.023,
                tool: 0.034,
                audio: 0.021,
              }}
              completionDetails={{
                output: 0.045,
                reasoning: 0.034,
                "function calls": 0.01,
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
