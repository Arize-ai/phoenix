import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Text } from "@phoenix/components";
import type { ChartTypeIconType } from "@phoenix/components/chart";
import { CHART_TYPE_LABELS, ChartTypeIcon } from "@phoenix/components/chart";

const meta: Meta<typeof ChartTypeIcon> = {
  title: "Chart/ChartTypeIcon",
  component: ChartTypeIcon,
  parameters: {
    layout: "centered",
  },
  args: {
    type: "bar",
    size: 24,
  },
  argTypes: {
    type: {
      control: "select",
      options: ["bar", "barHorizontal", "line"] satisfies ChartTypeIconType[],
    },
    size: {
      control: { type: "range", min: 16, max: 64, step: 2 },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ChartTypeIcon>;

export const Default: Story = {};

const TYPES: ChartTypeIconType[] = ["bar", "barHorizontal", "line"];

/**
 * Every chart archetype rendered side by side with its label. These glyphs let
 * a reader recognize a chart by its shape — vertical bars, a ranked horizontal
 * "top N" chart, or a line — independent of the chart's series colors.
 */
export const AllTypes: Story = {
  render: () => (
    <Flex direction="row" gap="size-400">
      {TYPES.map((type) => (
        <Flex key={type} direction="column" gap="size-100" alignItems="center">
          <ChartTypeIcon type={type} size={40} />
          <Text size="XS" color="text-700">
            {CHART_TYPE_LABELS[type]}
          </Text>
        </Flex>
      ))}
    </Flex>
  ),
};

/**
 * The glyph scales cleanly across a range of sizes.
 */
export const Sizes: Story = {
  render: () => (
    <Flex direction="row" gap="size-200" alignItems="center">
      {[16, 20, 24, 32, 48].map((size) => (
        <div
          key={size}
          css={css`
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--global-dimension-size-50);
          `}
        >
          <ChartTypeIcon type="bar" size={size} />
          <Text size="XS" color="text-700">
            {size}px
          </Text>
        </div>
      ))}
    </Flex>
  ),
};
