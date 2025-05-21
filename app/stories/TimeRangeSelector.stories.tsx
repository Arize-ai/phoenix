import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  OpenTimeRangeWithKey,
  TimeRangeSelector,
  TimeRangeSelectorProps,
} from "@phoenix/components";
import { timeRangeFormatter } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "TimeRangeSelector",
  component: TimeRangeSelector,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<TimeRangeSelectorProps> = (args) => {
  const [timeRange, setTimeRange] = useState<OpenTimeRangeWithKey>({
    timeRangeKey: "7d",
    start: new Date(),
  });
  return (
    <div>
      <span>{timeRangeFormatter(timeRange)}</span>
      <TimeRangeSelector
        {...args}
        value={timeRange}
        onChange={(value) => setTimeRange(value)}
      />
    </div>
  );
};

/**
 * Used to specify a time range in a pop up or modal
 */
export const Default = Template.bind({});

Default.args = {};
