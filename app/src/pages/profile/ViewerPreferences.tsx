import { useMemo } from "react";
import { getLocalTimeZone } from "@internationalized/date";

import {
  Card,
  ComboBox,
  ComboBoxItem,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import {
  isProviderThemeMode,
  usePreferencesContext,
  useTheme,
} from "@phoenix/contexts";
import { DisplayTimezone } from "@phoenix/store/preferencesStore";
import {
  isProgrammingLanguage,
  programmingLanguages,
} from "@phoenix/types/code";
import { getTimeZoneShortName } from "@phoenix/utils/timeFormatUtils";
import { getLocale, getSupportedTimezones } from "@phoenix/utils/timeUtils";

export function ViewerPreferences() {
  const { systemTheme, themeMode, setThemeMode } = useTheme();
  const {
    displayTimezone,
    setDisplayTimezone,
    programmingLanguage,
    setProgrammingLanguage,
  } = usePreferencesContext((state) => ({
    displayTimezone: state.displayTimezone,
    setDisplayTimezone: state.setDisplayTimezone,
    programmingLanguage: state.programmingLanguage,
    setProgrammingLanguage: state.setProgrammingLanguage,
  }));

  const themeOptions = useMemo(() => {
    return [
      {
        id: "system" as const,
        label: `Auto (${systemTheme})`,
        icon: <Icons.HalfMoonHalfSunOutline />,
      },
      {
        id: "dark" as const,
        label: "Dark",
        icon: <Icons.MoonOutline />,
      },
      {
        id: "light" as const,
        label: "Light",
        icon: <Icons.SunOutline />,
      },
    ];
  }, [systemTheme]);

  const timeZoneOptions = useMemo(() => {
    const supportedTimezones = [...getSupportedTimezones()];
    const locale = getLocale();
    // Sort the timezones so that UTC is first
    supportedTimezones.sort((a, b) => {
      if (a === "UTC") return -1;
      if (b === "UTC") return 1;
      return 0;
    });
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
        <Flex direction="column" gap="size-200">
          <ComboBox
            aria-label="Theme"
            label="Theme"
            description="Choose the color theme for the application"
            selectedKey={themeMode}
            onSelectionChange={(value) => {
              if (value && isProviderThemeMode(value)) {
                setThemeMode(value);
              }
            }}
          >
            {themeOptions.map((option) => (
              <ComboBoxItem
                key={option.id}
                id={option.id}
                textValue={option.label}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Icon svg={option.icon} />
                  <Text weight="heavy">{option.label}</Text>
                </Flex>
              </ComboBoxItem>
            ))}
          </ComboBox>
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
          <ComboBox
            aria-label="Programming Language"
            label="Programming Language"
            description="Choose the default language for code snippets"
            selectedKey={programmingLanguage}
            onSelectionChange={(value) => {
              if (value && isProgrammingLanguage(value)) {
                setProgrammingLanguage(value);
              }
            }}
          >
            {programmingLanguages.map((lang) => (
              <ComboBoxItem key={lang} id={lang} textValue={lang}>
                <Text weight="heavy">{lang}</Text>
              </ComboBoxItem>
            ))}
          </ComboBox>
        </Flex>
      </View>
    </Card>
  );
}
