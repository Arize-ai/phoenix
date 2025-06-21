import { Suspense } from "react";
import { Pressable } from "react-aria";
import type { Meta, StoryObj } from "@storybook/react";

import { Loading, RichTooltip, TooltipTrigger } from "@phoenix/components";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TokenCountDetails } from "@phoenix/components/trace/TokenCountDetails";

/**
 * TokenCount displays a token count with an icon. When composed with tooltips,
 * it can show detailed breakdowns of token usage.
 */
const meta = {
  title: "TokenCount",
  component: TokenCount,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "number",
      description: "The token count to display",
    },
    size: {
      control: "select",
      options: ["S", "M"],
      description: "Size of the token count display",
    },
  },
} satisfies Meta<typeof TokenCount>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic token count display without tooltip.
 */
export const Default: Story = {
  args: {
    children: 1721,
    size: "M",
  },
};

/**
 * Small size token count.
 */
export const Small: Story = {
  args: {
    children: 230,
    size: "S",
  },
};

/**
 * Token count with null value (shows "--").
 */
export const NullValue: Story = {
  args: {
    children: null,
    size: "M",
  },
};

/**
 * Token count with basic tooltip breakdown.
 */
export const WithBasicTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCount {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCountDetails
          total={1721}
          prompt={230}
          completion={1008}
          promptDetails={{
            tool: 461,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 1721,
    size: "M",
  },
};

/**
 * Token count with comprehensive tooltip breakdown.
 */
export const WithDetailedTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCount {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCountDetails
          total={3500}
          prompt={1200}
          completion={1800}
          promptDetails={{
            audio: 100,
            "cache read": 300,
            "cache write": 150,
            tool: 500,
            "system instructions": 200,
          }}
          completionDetails={{
            audio: 200,
            reasoning: 300,
            "function calls": 150,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 3500,
    size: "M",
  },
};

/**
 * Small token count with tooltip.
 */
export const SmallWithTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCount {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCountDetails total={842} prompt={342} completion={500} />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 842,
    size: "S",
  },
};

/**
 * Token count with loading state in tooltip.
 */
export const WithLoadingTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCount {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <Suspense fallback={<Loading />}>
          <TokenCountDetails
            total={2500}
            prompt={800}
            completion={1200}
            promptDetails={{
              audio: 150,
              "cache read": 250,
              "cache write": 100,
              tool: 500,
            }}
          />
        </Suspense>
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 2500,
    size: "M",
  },
};

/**
 * Token count showing completion-only breakdown.
 */
export const CompletionOnlyTooltip: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Pressable>
        <TokenCount {...args} role="button" />
      </Pressable>
      <RichTooltip>
        <TokenCountDetails
          completion={1000}
          completionDetails={{
            reasoning: 200,
            output: 800,
          }}
        />
      </RichTooltip>
    </TooltipTrigger>
  ),
  args: {
    children: 1000,
    size: "M",
  },
};

/**
 * Multiple token counts in a row to show interaction.
 */
export const MultipleTokenCounts: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <TooltipTrigger>
        <Pressable>
          <TokenCount size="S" role="button">
            {230}
          </TokenCount>
        </Pressable>
        <RichTooltip>
          <TokenCountDetails total={230} prompt={230} />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCount size="S" role="button">
            {461}
          </TokenCount>
        </Pressable>
        <RichTooltip>
          <TokenCountDetails
            total={461}
            promptDetails={{
              tool: 461,
            }}
          />
        </RichTooltip>
      </TooltipTrigger>

      <TooltipTrigger>
        <Pressable>
          <TokenCount size="S" role="button">
            {1008}
          </TokenCount>
        </Pressable>
        <RichTooltip>
          <TokenCountDetails total={1008} completion={1008} />
        </RichTooltip>
      </TooltipTrigger>
    </div>
  ),
  args: {
    children: 1721,
    size: "S",
  },
};
