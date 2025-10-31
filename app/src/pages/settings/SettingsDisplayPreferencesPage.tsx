import { Flex } from "@phoenix/components";

import { TimezonePreferencesCard } from "./TimezonePreferencesCard";

export function SettingsDisplayPreferencesPage() {
  return (
    <Flex direction="column" gap="size-200" width="100%">
      <TimezonePreferencesCard />
    </Flex>
  );
}
