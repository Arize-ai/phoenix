import { Flex } from "@phoenix/components";

import { SettingsGroupsPage } from "./SettingsGroupsPage";
import { SettingsRolesPage } from "./SettingsRolesPage";
import { SettingsTagGrantsPage } from "./SettingsTagGrantsPage";

export function SettingsAccessPage() {
  return (
    <Flex direction="column" gap="size-200" width="100%">
      <SettingsGroupsPage />
      <SettingsRolesPage />
      <SettingsTagGrantsPage />
    </Flex>
  );
}
