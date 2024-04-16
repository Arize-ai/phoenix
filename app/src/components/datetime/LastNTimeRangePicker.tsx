import React, { Key } from "react";

import { Icon, Icons, Item, Picker } from "@arizeai/components";

export type LastNTimeRangeKey = "7d" | "30d" | "all";
type LastNTimeRange = { key: string; label: string; numDays?: number };

export const LAST_N_TIME_RANGES: LastNTimeRange[] = [
  { key: "7d", label: "Last 7 Days", numDays: 7 },
  { key: "7d", label: "Last 7 Days", numDays: 7 },
  { key: "30d", label: "Last Month", numDays: 30 },
  { key: "all", label: "All Time" },
];

const LAST_N_TIME_RANGES_MAP = LAST_N_TIME_RANGES.reduce(
  (acc, range) => ({ ...acc, [range.key]: range }),
  {} as Record<LastNTimeRangeKey, LastNTimeRange | undefined>
);

export type LastNTimeRangePickerProps = {
  isDisabled?: boolean;
  selectedKey?: LastNTimeRangeKey;
  onSelectionChange?: (key: LastNTimeRange) => void;
};
export function LastNTimeRangePicker(props: LastNTimeRangePickerProps) {
  const { isDisabled, selectedKey, onSelectionChange } = props;
  return (
    <Picker
      aria-label={"Time Range"}
      addonBefore={<Icon svg={<Icons.CalendarOutline />} />}
      isDisabled={isDisabled}
      defaultSelectedKey={selectedKey}
      onSelectionChange={(key: Key) => {
        const selected = LAST_N_TIME_RANGES_MAP[key as LastNTimeRangeKey];
        if (selected) {
          onSelectionChange && onSelectionChange(selected);
        }
      }}
    >
      {LAST_N_TIME_RANGES.map(({ key, label }) => (
        <Item key={key}>{label}</Item>
      ))}
    </Picker>
  );
}
