import React from "react";

import { Icon, Icons, Radio, RadioGroup } from "@phoenix/components";
import { SelectionDisplay } from "@phoenix/constants/pointCloudConstants";

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
      size="L"
      onChange={(v) => {
        if (isSelectionDisplay(v)) {
          props.onChange(v);
        } else {
          throw new Error(`Unknown view mode: ${v}`);
        }
      }}
    >
      <Radio aria-label="List" value={SelectionDisplay.list}>
        <Icon svg={<Icons.ListOutline />} />
      </Radio>
      <Radio aria-label="Grid" value={SelectionDisplay.gallery}>
        <Icon svg={<Icons.Grid />} />
      </Radio>
    </RadioGroup>
  );
}
