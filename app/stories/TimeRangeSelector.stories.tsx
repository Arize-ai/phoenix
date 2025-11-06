import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  OpenTimeRangeWithKey,
  TimeRangeSelector,
  TimeRangeSelectorProps,
} from "@phoenix/components";
import { PreferencesProvider } from "@phoenix/contexts";
import { createTimeRangeFormatter } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "TimeRangeSelector",
  component: TimeRangeSelector,
  parameters: {
    layout: "centered",
  },
};

const timeRangeFormatter = createTimeRangeFormatter({
  locale: "en-US",
  timeZone: "UTC",
});

export default meta;

const Template: StoryFn<TimeRangeSelectorProps> = (args) => {
  const [timeRange, setTimeRange] = useState<OpenTimeRangeWithKey>({
    timeRangeKey: "7d",
    start: new Date("2024-01-15T10:00:00Z"),
  });
  return (
    <PreferencesProvider>
      <span>{timeRangeFormatter(timeRange)}</span>
      <TimeRangeSelector
        {...args}
        value={timeRange}
        onChange={(value) => setTimeRange(value)}
      />
    </PreferencesProvider>
  );
};

/**
 * Used to specify a time range in a pop up or modal
 */
export const Default = Template.bind({});

Default.args = {};
