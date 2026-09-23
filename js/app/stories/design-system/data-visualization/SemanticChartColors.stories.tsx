import type { Meta, StoryFn } from "@storybook/react";

import { Flex } from "@phoenix/components";
import {
  SEMANTIC_CHART_COLORS,
  useSemanticChartColors,
} from "@phoenix/components/chart/colors";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/core/tooltip";

const meta: Meta = {
  title: "Design System/Data visualization/Semantic Chart Colors",
  tags: ["legacy", "unreviewed"],
};

export default meta;

const Template: StoryFn = () => {
  const colors = useSemanticChartColors();
  return (
    <Flex direction="column" gap="size-100">
      {SEMANTIC_CHART_COLORS.map((colorKey) => (
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail = {
  tags: ["!dev", "!autodocs"],
  render: function SemanticChartColorsThumbnail() {
    const colors = useSemanticChartColors();
    return (
      <Flex direction="row" gap="size-100">
        {SEMANTIC_CHART_COLORS.map((colorKey) => (
          <div
            key={colorKey}
            style={{
              backgroundColor: colors[colorKey],
              height: "40px",
              width: "40px",
            }}
          />
        ))}
      </Flex>
    );
  },
};
