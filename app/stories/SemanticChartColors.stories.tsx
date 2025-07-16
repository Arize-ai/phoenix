import { Meta, StoryFn } from "@storybook/react";

import { Flex } from "@phoenix/components";
import {
  SEMANTIC_CHART_COLORS,
  useSemanticChartColors,
} from "@phoenix/components/chart/colors";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";

const meta: Meta = {
  title: "charting/SemanticChartColors",
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
                padding: "var(--ac-global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
};

export const Default = Template.bind({});
