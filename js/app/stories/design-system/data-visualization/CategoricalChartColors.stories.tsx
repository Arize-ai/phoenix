import type { Meta, StoryFn } from "@storybook/react";

import { Flex } from "@phoenix/components";
import {
  CATEGORICAL_CHART_COLORS,
  GRAYSCALE_CATEGORICAL_COLORS,
  useCategoryChartColors,
  useGrayscaleCategoricalColors,
} from "@phoenix/components/chart/colors";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/core/tooltip";

const meta: Meta = {
  title: "Design System/Data visualization/Categorical Chart Colors",
  tags: ["legacy", "unreviewed"],
};

export default meta;

const Template: StoryFn = () => {
  const colors = useCategoryChartColors();
  return (
    <Flex direction="column" gap="size-100">
      {CATEGORICAL_CHART_COLORS.map((colorKey) => (
        <TooltipTrigger key={colorKey} delay={0}>
          <TriggerWrap>
            <div
              style={{
                backgroundColor: colors[colorKey],
                height: "40px",
                width: "40px",
                padding: "var(--global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
};

export const Default = {
  render: Template,
};

const GrayscaleTemplate: StoryFn = () => {
  const colors = useGrayscaleCategoricalColors();
  return (
    <Flex direction="column" gap="size-100">
      {GRAYSCALE_CATEGORICAL_COLORS.map((colorKey) => (
        <TooltipTrigger key={colorKey} delay={0}>
          <TriggerWrap>
            <div
              style={{
                backgroundColor: colors[colorKey],
                height: "40px",
                width: "40px",
                padding: "var(--global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
};

export const Grayscale = {
  render: GrayscaleTemplate,
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  render: function CategoricalChartColorsThumbnail() {
    const colors = useCategoryChartColors();
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 40px)",
          gap: "var(--global-dimension-size-100)",
        }}
      >
        {CATEGORICAL_CHART_COLORS.map((colorKey) => (
          <div
            key={colorKey}
            style={{
              backgroundColor: colors[colorKey],
              height: "40px",
              width: "40px",
            }}
          />
        ))}
      </div>
    );
  },
};
