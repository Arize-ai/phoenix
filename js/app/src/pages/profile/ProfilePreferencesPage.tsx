import { Flex } from "@phoenix/components";

import { LocalStorageCard } from "./LocalStorageCard";
import { ViewerPreferences } from "./ViewerPreferences";

export function ProfilePreferencesPage() {
  return (
    <Flex direction="column" gap="size-200">
      <ViewerPreferences />
      <LocalStorageCard />
    </Flex>
  );
}
