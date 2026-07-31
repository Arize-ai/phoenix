import { Flex } from "@phoenix/components";
import { AISearchSettingsCard } from "@phoenix/components/filter";

import { ViewerPreferences } from "./ViewerPreferences";

export function ProfilePreferencesPage() {
  return (
    <Flex direction="column" gap="size-200">
      <ViewerPreferences />
      <AISearchSettingsCard />
    </Flex>
  );
}
