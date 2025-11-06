import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Card,
  Flex,
  Heading,
  OpenTimeRangeWithKey,
  Text,
  TimeRangeSelector,
  View,
} from "@phoenix/components";
import { PreferencesProvider } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { ViewerPreferences } from "@phoenix/pages/profile/ViewerPreferences";

const meta: Meta = {
  title: "Timezone Preferences",
  parameters: {
    layout: "centered",
  },
};

export default meta;

/**
 * Demonstrates how timezone preferences affect time formatting across the application.
 * The ViewerPreferences component allows changing the display timezone, and the
 * TimeRangeSelector and time formatters respond to those changes.
 */
export const TimezoneDemo: StoryFn = () => {
  const [timeRange, setTimeRange] = useState<OpenTimeRangeWithKey>({
    timeRangeKey: "7d",
    start: new Date("2024-01-15T10:00:00Z"),
  });

  return (
    <PreferencesProvider>
      <Flex direction="column" gap="size-200" width="600px">
        <ViewerPreferences />
        <Card title="Time Range Selection">
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text>Select a time range:</Text>
                <TimeRangeSelector
                  value={timeRange}
                  onChange={(value) => setTimeRange(value)}
                />
              </Flex>
              <FormattedTimeDisplay timeRange={timeRange} />
            </Flex>
          </View>
        </Card>
      </Flex>
    </PreferencesProvider>
  );
};

/**
 * Component that displays formatted times using the useTimeFormatters hook.
 * This demonstrates how the formatters automatically respond to timezone preference changes.
 */
function FormattedTimeDisplay({
  timeRange,
}: {
  timeRange: OpenTimeRangeWithKey;
}) {
  const {
    fullTimeFormatter,
    shortTimeFormatter,
    shortDateTimeFormatter,
    timeRangeFormatter,
  } = useTimeFormatters();

  const sampleDate = new Date("2024-01-15T14:30:00Z");

  return (
    <Card title="Formatted Times">
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={3}>Sample Date: 2024-01-15T14:30:00Z</Heading>
          <Flex direction="column" gap="size-50">
            <Text>
              <strong>Full Time:</strong> {fullTimeFormatter(sampleDate)}
            </Text>
            <Text>
              <strong>Short Time:</strong> {shortTimeFormatter(sampleDate)}
            </Text>
            <Text>
              <strong>Short Date Time:</strong>{" "}
              {shortDateTimeFormatter(sampleDate)}
            </Text>
          </Flex>
          <Heading level={3}>Selected Time Range</Heading>
          <Text>
            <strong>Time Range:</strong> {timeRangeFormatter(timeRange)}
          </Text>
        </Flex>
      </View>
    </Card>
  );
}
