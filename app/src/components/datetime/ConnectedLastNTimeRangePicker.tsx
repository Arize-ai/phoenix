import React from "react";

import { useLastNTimeRange } from "./LastNTimeRangeContext";
import { LastNTimeRangePicker } from "./LastNTimeRangePicker";

export function ConnectedLastNTimeRangePicker() {
  const { timeRangeKey, setTimeRangeKey } = useLastNTimeRange();
  return (
    <LastNTimeRangePicker
      selectedKey={timeRangeKey}
      onSelectionChange={setTimeRangeKey}
    />
  );
}
