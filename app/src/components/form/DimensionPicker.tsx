import React from "react";

import { Item, Picker, PickerProps } from "@arizeai/components";

type Dimension = {
  name: string;
  type: "feature" | "tag" | "actual";
};

type DimensionPickerProps<T> = PickerProps<T> & {
  selectedDimension: Dimension | null;
  onChange: (dimension: Dimension) => void;
  dimensions: Dimension[];
};

export function DimensionPicker<T>(props: DimensionPickerProps<T>) {
  const { selectedDimension, dimensions, onChange } = props;
  return (
    <Picker
      defaultSelectedKey={
        selectedDimension ? selectedDimension.name : undefined
      }
      aria-label="Dimension"
      onSelectionChange={(key) => {
        // Find the dimension in the list
        const dimension = dimensions.find((d) => d.name === key);
        if (dimension) {
          onChange(dimension);
        }
      }}
      label="Dimension"
    >
      {dimensions.map((dimension) => (
        <Item key={dimension.name}>{dimension.name}</Item>
      ))}
    </Picker>
  );
}
