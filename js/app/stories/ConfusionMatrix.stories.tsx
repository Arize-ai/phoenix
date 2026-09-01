import type { Meta, StoryObj } from "@storybook/react";
import { interpolateMagma, interpolateViridis } from "d3-scale-chromatic";
import type { ComponentProps } from "react";

import { Flex, Heading, View } from "@phoenix/components";
import {
  ConfusionMatrix,
  ConfusionMatrixLegend,
  reverseColorInterpolator,
  useSequentialBlueColorInterpolator,
} from "@phoenix/components/chart";
import { useTheme } from "@phoenix/contexts";

/**
 * A binary eval: "hallucinated" is the positive class, so quadrant labels
 * read TP / FN / FP / TN.
 */
const binaryData = [
  { actual: "hallucinated", predicted: "hallucinated", count: 94 },
  { actual: "hallucinated", predicted: "factual", count: 34 },
  { actual: "factual", predicted: "hallucinated", count: 41 },
  { actual: "factual", predicted: "factual", count: 1078 },
];

/**
 * A multiclass classifier where the predicted axis has a label the ground
 * truth never contains (`unparseable`) — the axes are independent.
 */
const multiclassData = [
  { actual: "billing", predicted: "billing", count: 842 },
  { actual: "billing", predicted: "refunds", count: 31 },
  { actual: "billing", predicted: "shipping", count: 12 },
  { actual: "billing", predicted: "account", count: 9 },
  { actual: "billing", predicted: "other", count: 22 },
  { actual: "billing", predicted: "unparseable", count: 4 },
  { actual: "refunds", predicted: "billing", count: 58 },
  { actual: "refunds", predicted: "refunds", count: 611 },
  { actual: "refunds", predicted: "shipping", count: 24 },
  { actual: "refunds", predicted: "account", count: 7 },
  { actual: "refunds", predicted: "other", count: 31 },
  { actual: "refunds", predicted: "unparseable", count: 2 },
  { actual: "shipping", predicted: "billing", count: 15 },
  { actual: "shipping", predicted: "refunds", count: 19 },
  { actual: "shipping", predicted: "shipping", count: 488 },
  { actual: "shipping", predicted: "account", count: 11 },
  { actual: "shipping", predicted: "other", count: 26 },
  { actual: "shipping", predicted: "unparseable", count: 3 },
  { actual: "account", predicted: "billing", count: 21 },
  { actual: "account", predicted: "refunds", count: 6 },
  { actual: "account", predicted: "shipping", count: 14 },
  { actual: "account", predicted: "account", count: 302 },
  { actual: "account", predicted: "other", count: 40 },
  { actual: "other", predicted: "billing", count: 33 },
  { actual: "other", predicted: "refunds", count: 27 },
  { actual: "other", predicted: "shipping", count: 22 },
  { actual: "other", predicted: "account", count: 36 },
  { actual: "other", predicted: "other", count: 214 },
  { actual: "other", predicted: "unparseable", count: 9 },
];

const meta: Meta<typeof ConfusionMatrix> = {
  title: "Charting/ConfusionMatrix",
  component: ConfusionMatrix,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    scaleType: {
      control: "radio",
      options: ["log", "linear"],
    },
    size: {
      control: "radio",
      options: ["S", "M", "L"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfusionMatrix>;

export const Binary: Story = {
  args: {
    data: binaryData,
    size: "L",
    showPercentage: true,
    positiveLabel: "hallucinated",
  },
};

export const Multiclass: Story = {
  args: {
    data: multiclassData,
    size: "M",
  },
};

export const LinearScale: Story = {
  args: {
    data: binaryData,
    size: "L",
    scaleType: "linear",
    showPercentage: true,
  },
};

export const CustomColorScale: Story = {
  render: () => (
    <Flex direction="column" gap="size-400">
      <ConfusionMatrix
        data={multiclassData}
        colorInterpolator={interpolateViridis}
        legendLabel="count · log scale · viridis"
      />
      <ConfusionMatrix
        data={multiclassData}
        colorInterpolator={interpolateMagma}
        legendLabel="count · log scale · magma"
      />
    </Flex>
  ),
};

type DensityDirectionArgs = ComponentProps<typeof ConfusionMatrix> & {
  moreMeans: "brighter" | "darker";
};

/**
 * In the dark theme the default color scale brightens as counts grow, so the
 * densest cell is the most vivid blue. Readers trained on print-style
 * heatmaps expect the opposite — darker means more. With the dark theme
 * active, switch `moreMeans` to "darker" to compare: the color scale is
 * reversed so the densest cell is the deepest navy. The light theme already
 * maps more to darker and is left unchanged.
 */
export const DensityDirection: StoryObj<DensityDirectionArgs> = {
  args: {
    data: binaryData,
    size: "L",
    showPercentage: true,
    moreMeans: "brighter",
  },
  argTypes: {
    moreMeans: {
      control: "radio",
      options: ["brighter", "darker"],
      description:
        'Which color direction encodes higher counts in dark mode — the current default brightens toward vivid blue; "darker" sinks high counts into navy like a print heatmap. Light mode already maps more to darker and is unaffected.',
    },
  },
  render: function DensityDirectionStory({ moreMeans, ...props }) {
    const { theme } = useTheme();
    const defaultColorInterpolator = useSequentialBlueColorInterpolator();
    const colorInterpolator =
      moreMeans === "darker" && theme === "dark"
        ? reverseColorInterpolator(defaultColorInterpolator)
        : defaultColorInterpolator;
    return (
      <Flex direction="column" gap="size-400">
        <ConfusionMatrix {...props} colorInterpolator={colorInterpolator} />
        <ConfusionMatrix
          data={multiclassData}
          size="M"
          colorInterpolator={colorInterpolator}
        />
      </Flex>
    );
  },
};

export const Compact: Story = {
  args: {
    data: multiclassData,
    size: "S",
    showTotals: false,
    showLegend: false,
  },
};

/**
 * Several matrices sharing one scale should share one legend: turn
 * `showLegend` off per matrix, pin a common `maxCount` so their colors are
 * directly comparable, and render a single `ConfusionMatrixLegend`.
 */
const binaryDataOtherModel = [
  { actual: "hallucinated", predicted: "hallucinated", count: 112 },
  { actual: "hallucinated", predicted: "factual", count: 16 },
  { actual: "factual", predicted: "hallucinated", count: 18 },
  { actual: "factual", predicted: "factual", count: 1101 },
];

export const SharedLegend: Story = {
  render: () => {
    const sharedMaxCount = Math.max(
      ...binaryData.map((datum) => datum.count),
      ...binaryDataOtherModel.map((datum) => datum.count)
    );
    return (
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-400">
          <View flex="1 1 0">
            <Heading level={3}>gpt-4o-mini</Heading>
            <ConfusionMatrix
              data={binaryData}
              maxCount={sharedMaxCount}
              showLegend={false}
            />
          </View>
          <View flex="1 1 0">
            <Heading level={3}>gpt-4o</Heading>
            <ConfusionMatrix
              data={binaryDataOtherModel}
              maxCount={sharedMaxCount}
              showLegend={false}
            />
          </View>
        </Flex>
        <ConfusionMatrixLegend label="span count · log scale" />
      </Flex>
    );
  },
};
