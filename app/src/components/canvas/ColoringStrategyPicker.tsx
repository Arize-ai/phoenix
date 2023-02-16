import React from "react";
import { Picker, Item } from "@arizeai/components";
import { ColoringStrategy } from "./types";

function isColoringStrategy(strategy: unknown): strategy is ColoringStrategy {
  return typeof strategy === "string" && strategy in ColoringStrategy;
}

const ColoringStrategies = Object.values(ColoringStrategy);

type ColoringStrategyPickerProps = {
  strategy: ColoringStrategy;
  onChange: (strategy: ColoringStrategy) => void;
};
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
    >
      {ColoringStrategies.map((item) => (
        <Item key={item}>{item}</Item>
      ))}
    </Picker>
  );
}
