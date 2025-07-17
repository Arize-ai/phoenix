import { Canvas, Title } from "@storybook/blocks";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";

import {
  CATEGORICAL_CHART_COLORS,
  GLOBAL_COLORS,
  SEMANTIC_CHART_COLORS,
} from "./constants/colorConstants";

const meta: Meta = {
  title: "Colors",
  parameters: {
    docs: {
      page: () => (
        <>
          <Title />
          <Canvas of={Default} />

          <h2>Categorical Chart Colors</h2>
          <p>
            Use categorical chart colors when you want to represent discrete
            segments. The categorical colors are ordered intentionally and meant
            to be used in sequence, defaulting to start with colors closer to
            our brand, but with room to expand to up to 12 discrete categories.
          </p>
          <Canvas of={CategorialChart} />

          <h2>Semantic Chart Colors</h2>
          <p>
            Use semantic chart colors when you want express an opinion about an
            outcome, labelelling it specifically as positive, negative, or
            neutral.
          </p>
          <h4>Mixing semantic and categorical colors.</h4>
          <p>
            Semantic colors purposefully do not overlap with categorical colors,
            allowing them to be used side by side. For example, you could show
            muliple types of tool call using categorical colors, while using the
            semantic-negative color to indicate calls that failed.
          </p>
          <Canvas of={SemanticChart} />
        </>
      ),
    },
  },
};

export default meta;

const Template: StoryFn = () => {
  // Group colors by family
  const colorsByFamily = GLOBAL_COLORS.reduce(
    (acc, color) => {
      const family = color.split("-")[0];
      if (!acc[family]) {
        acc[family] = [];
      }
      acc[family].push(color);
      return acc;
    },
    {} as Record<string, typeof GLOBAL_COLORS>
  );

  return (
    <Flex direction="column" gap="size-100">
      {Object.entries(colorsByFamily).map(([family, colors]) => (
        <Flex key={family} direction="row" wrap>
          {colors.map((color) => (
            <TooltipTrigger key={color} delay={0}>
              <TriggerWrap>
                <View
                  backgroundColor={color}
                  height={40}
                  width={40}
                  padding="size-50"
                ></View>
              </TriggerWrap>
              <Tooltip>{color}</Tooltip>
            </TooltipTrigger>
          ))}
        </Flex>
      ))}
    </Flex>
  );
};

export const Default = Template.bind({});

const CategoricalTemplate: StoryFn = () => (
  <Flex direction="row" wrap>
    {CATEGORICAL_CHART_COLORS.map((color) => (
      <TooltipTrigger key={color} delay={0}>
        <TriggerWrap>
          <View
            backgroundColor={color}
            height={40}
            width={40}
            padding="size-50"
          ></View>
        </TriggerWrap>
        <Tooltip>{color}</Tooltip>
      </TooltipTrigger>
    ))}
  </Flex>
);

export const CategorialChart = CategoricalTemplate.bind({});

const SemanticChartTemplate: StoryFn = () => (
  <Flex direction="row" wrap>
    {SEMANTIC_CHART_COLORS.map((color) => (
      <TooltipTrigger key={color} delay={0}>
        <TriggerWrap>
          <View
            backgroundColor={color}
            height={40}
            width={40}
            padding="size-50"
          ></View>
        </TriggerWrap>
        <Tooltip>{color}</Tooltip>
      </TooltipTrigger>
    ))}
  </Flex>
);

export const SemanticChart = SemanticChartTemplate.bind({});
