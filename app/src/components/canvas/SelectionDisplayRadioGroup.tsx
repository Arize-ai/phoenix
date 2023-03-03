import React from "react";

import { Icon, Icons, Radio, RadioGroup } from "@arizeai/components";

import { SelectionDisplay } from "@phoenix/types";

/**
 * TypeGuard for the view mode
 */
function isSelectionDisplay(m: unknown): m is SelectionDisplay {
  return typeof m === "string" && m in SelectionDisplay;
}

type SelectionDisplayRadioGroupProps = {
  mode: SelectionDisplay;
  onChange: (mode: SelectionDisplay) => void;
};

/**
 * Controls the view of the user's selection (e.g. view as a list or gallery)
 */
export function SelectionDisplayRadioGroup(
  props: SelectionDisplayRadioGroupProps
) {
  return (
    <RadioGroup
      defaultValue={props.mode}
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (isSelectionDisplay(v)) {
          props.onChange(v);
        } else {
          throw new Error(`Unknown view mode: ${v}`);
        }
      }}
    >
      <Radio label="Move" value={SelectionDisplay.gallery}>
        <Icon svg={<Icons.Grid />} />
      </Radio>
      <Radio label="Select" value={SelectionDisplay.list}>
        <Icon svg={<Icons.List />} />
      </Radio>
    </RadioGroup>
  );
}
