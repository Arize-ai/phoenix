import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

import type {
  OpenTimeRangeWithKey,
  TimeRangeSelectorProps,
} from "@phoenix/components";
import { TimeRangeSelector } from "@phoenix/components";
import { PreferencesProvider } from "@phoenix/contexts";
import { createTimeRangeFormatter } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "DateTime/Time Range Selector",
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

const Template: StoryFn<
  TimeRangeSelectorProps & { initialValue: OpenTimeRangeWithKey }
> = ({ initialValue, ...args }) => {
  const [timeRange, setTimeRange] =
    useState<OpenTimeRangeWithKey>(initialValue);
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
 * The default state shows an open-ended preset. The leading badge surfaces the
 * preset shorthand and the end reads as the current time.
 */
export const Preset = {
  render: Template,
  args: {
    initialValue: {
      timeRangeKey: "7d",
      start: new Date("2024-01-15T10:00:00Z"),
    },
  },
};

/**
 * A custom, closed range. Editing either date inline forks a preset into this
 * state automatically.
 */
export const Custom = {
  render: Template,
  args: {
    initialValue: {
      timeRangeKey: "custom",
      start: new Date("2024-01-15T10:00:00Z"),
      end: new Date("2024-01-22T18:30:00Z"),
    },
  },
};

export const Disabled = {
  render: Template,
  args: {
    isDisabled: true,
    initialValue: {
      timeRangeKey: "1h",
      start: new Date("2024-01-15T10:00:00Z"),
    },
  },
};
