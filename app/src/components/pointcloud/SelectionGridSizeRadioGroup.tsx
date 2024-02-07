import React from "react";

import { Radio, RadioGroup } from "@arizeai/components";

import { SelectionGridSize } from "@phoenix/constants/pointCloudConstants";

/**
 * TypeGuard for the view mode
 */
function isSelectionGridSize(m: unknown): m is SelectionGridSize {
  return typeof m === "string" && m in SelectionGridSize;
}

type SelectionGridSizeRadioGroupProps = {
  size: SelectionGridSize;
  onChange: (size: SelectionGridSize) => void;
};

/**
 * Selects the size of the grid view of the points
 */
export function SelectionGridSizeRadioGroup(
  props: SelectionGridSizeRadioGroupProps
) {
  return (
    <RadioGroup
      defaultValue={props.size}
      variant="inline-button"
      onChange={(v) => {
        if (isSelectionGridSize(v)) {
          props.onChange(v);
        } else {
          throw new Error(`Unknown grid size: ${v}`);
        }
      }}
    >
      <Radio label="Small" value={SelectionGridSize.small}>
        S
      </Radio>
      <Radio label="Medium" value={SelectionGridSize.medium}>
        M
      </Radio>
      <Radio label="Large" value={SelectionGridSize.large}>
        L
      </Radio>
    </RadioGroup>
  );
}
