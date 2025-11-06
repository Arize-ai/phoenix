import { useMemo } from "react";
import { getLocalTimeZone } from "@internationalized/date";

import {
  Card,
  ComboBox,
  ComboBoxItem,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { DisplayTimezone } from "@phoenix/store/preferencesStore";
import { getTimeZoneShortName } from "@phoenix/utils/timeFormatUtils";
import { getLocale, getSupportedTimezones } from "@phoenix/utils/timeUtils";

export function ViewerPreferences() {
  const { displayTimezone, setDisplayTimezone } = usePreferencesContext(
    (state) => ({
      displayTimezone: state.displayTimezone,
      setDisplayTimezone: state.setDisplayTimezone,
    })
  );

  const timeZoneOptions = useMemo(() => {
    const supportedTimezones = getSupportedTimezones();
    const locale = getLocale();

    return [
      {
        value: "local" as const,
        label: `Local (${getLocalTimeZone()})`,
      },
      ...supportedTimezones.map((timezone) => ({
        value: timezone,
        label: `${timezone} (${getTimeZoneShortName({ locale, timeZone: timezone })})`,
      })),
    ];
  }, []);

  const selectedTimezone = displayTimezone ?? "local";
  return (
    <Card title="Preferences">
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <ComboBox
            aria-label="Display Time Zone"
            label="Timezone"
            description="Choose how timestamps are displayed throughout the application"
            placeholder="Search timezones..."
            selectedKey={selectedTimezone}
            onSelectionChange={(value) => {
              if (value === "local") {
                setDisplayTimezone(undefined);
              } else {
                setDisplayTimezone(value as DisplayTimezone);
              }
            }}
          >
            {timeZoneOptions.map((option) => (
              <ComboBoxItem
                key={option.value}
                id={option.value}
                textValue={option.label}
              >
                <Flex direction="column" gap="size-50">
                  <Text weight="heavy">{option.label}</Text>
                </Flex>
              </ComboBoxItem>
            ))}
          </ComboBox>
        </Flex>
      </View>
    </Card>
  );
}
