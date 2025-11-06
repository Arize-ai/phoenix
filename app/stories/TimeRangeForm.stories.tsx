import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  TimeRangeForm,
  TimeRangeFormProps,
  View,
} from "@phoenix/components";
import { createTimeRangeFormatter } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "TimeRangeForm",
  component: TimeRangeForm,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<TimeRangeFormProps> = (args) => (
  <TimeRangeForm {...args} />
);

/**
 * Used to specify a time range in a pop up or modal
 */
export const Default = Template.bind({});

Default.args = {};

const timeRangeFormatter = createTimeRangeFormatter({
  locale: "en-US",
  timeZone: "UTC",
});
export const InAPopOver = () => {
  const [timeRange, setTimeRange] = useState<OpenTimeRange>({
    start: new Date("2024-01-15T10:00:00Z"),
  });
  const timeRangeString = timeRangeFormatter(timeRange);
  return (
    <DialogTrigger isOpen>
      <Button size="S" leadingVisual={<Icon svg={<Icons.CalendarOutline />} />}>
        {timeRangeString}
      </Button>
      <Popover placement="bottom end">
        <Dialog>
          <PopoverArrow />
          <View padding="size-100">
            <TimeRangeForm
              initialValue={timeRange}
              onSubmit={(timeRange) => {
                setTimeRange(timeRange);
              }}
            />
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
