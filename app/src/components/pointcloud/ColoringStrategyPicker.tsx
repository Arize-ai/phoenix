import React from "react";

import {
  Content,
  ContextualHelp,
  Heading,
  Item,
  Picker,
  Text,
} from "@arizeai/components";

import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";

function isColoringStrategy(strategy: unknown): strategy is ColoringStrategy {
  return typeof strategy === "string" && strategy in ColoringStrategy;
}

const ColoringStrategies = Object.values(ColoringStrategy);

type ColoringStrategyPickerProps = {
  strategy: ColoringStrategy;
  onChange: (strategy: ColoringStrategy) => void;
};

const contextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Coloring Strategy
    </Heading>
    <Content>
      <Text>
        The way in which inference point is colored. Each point in the
        point-cloud represents a model inference. These inferences can be
        colored by a particular attribute (such as dataset and dimension) or by
        a performance value such as correctness (predicted value equals the
        actual value)
      </Text>
    </Content>
  </ContextualHelp>
);

export function ColoringStrategyPicker(props: ColoringStrategyPickerProps) {
  const { strategy, onChange } = props;
  return (
    <Picker
      defaultSelectedKey={strategy}
      aria-label="Coloring strategy"
      onSelectionChange={(key) => {
        if (isColoringStrategy(key)) {
          onChange(key);
        }
      }}
      label="Color By"
      labelExtra={contextualHelp}
    >
      {ColoringStrategies.map((item) => (
        <Item key={item}>{item}</Item>
      ))}
    </Picker>
  );
}
