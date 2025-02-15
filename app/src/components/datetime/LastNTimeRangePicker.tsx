import React, { Key } from "react";

import { Item, Picker } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";

import { LAST_N_TIME_RANGES } from "./constants";
import { LastNTimeRangeKey } from "./types";

export type LastNTimeRangePickerProps = {
  isDisabled?: boolean;
  selectedKey?: LastNTimeRangeKey;
  onSelectionChange?: (key: LastNTimeRangeKey) => void;
};
export function LastNTimeRangePicker(props: LastNTimeRangePickerProps) {
  const { isDisabled, selectedKey, onSelectionChange } = props;
  return (
    <Picker
      aria-label={"Time Range"}
      addonBefore={<Icon svg={<Icons.CalendarOutline />} />}
      isDisabled={isDisabled}
      selectedKey={selectedKey}
      onSelectionChange={(key: Key) => {
        onSelectionChange && onSelectionChange(key as LastNTimeRangeKey);
      }}
      align="end"
    >
      {LAST_N_TIME_RANGES.map(({ key, label }) => (
        <Item key={key}>{label}</Item>
      ))}
    </Picker>
  );
}
