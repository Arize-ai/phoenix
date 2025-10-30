import {
  Button,
  Card,
  Flex,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { DisplayTimezone } from "@phoenix/store/preferencesStore";

export function TimezonePreferencesCard() {
  const { displayTimezone, setDisplayTimezone } = usePreferencesContext(
    (state) => ({
      displayTimezone: state.displayTimezone,
      setDisplayTimezone: state.setDisplayTimezone,
    })
  );

  const timezoneOptions: Array<{
    value: DisplayTimezone;
    label: string;
    description: string;
  }> = [
    {
      value: "local",
      label: "Local Timezone",
      description: "Display timestamps in your browser's local timezone",
    },
    {
      value: "UTC",
      label: "UTC",
      description: "Display all timestamps in UTC (Coordinated Universal Time)",
    },
  ];

  return (
    <Card title="Display Preferences">
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          <Select
            aria-label="Display timezone"
            selectedKey={displayTimezone}
            onSelectionChange={(key) => {
              setDisplayTimezone(key as DisplayTimezone);
            }}
          >
            <Label>Timezone Display</Label>

            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox>
                {timezoneOptions.map((option) => (
                  <ListBoxItem
                    key={option.value}
                    id={option.value}
                    textValue={option.label}
                  >
                    <Flex direction="column" gap="size-50">
                      <Text weight="heavy">{option.label}</Text>
                    </Flex>
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
            <Text slot="description">
              Choose how timestamps are displayed throughout the application
            </Text>
          </Select>
        </Flex>
      </View>
    </Card>
  );
}
