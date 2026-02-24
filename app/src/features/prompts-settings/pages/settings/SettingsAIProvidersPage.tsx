import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { CustomProvidersCard } from "@phoenix/features/prompts-settings/pages/settings/CustomProvidersCard";
import { GenerativeProvidersCard } from "@phoenix/features/prompts-settings/pages/settings/GenerativeProvidersCard";
import type { settingsAIProvidersPageLoader } from "@phoenix/features/prompts-settings/pages/settings/settingsAIProvidersPageLoader";

export function SettingsAIProvidersPage() {
  const loaderData = useLoaderData<typeof settingsAIProvidersPageLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <Flex direction="column" gap="size-200">
      <GenerativeProvidersCard query={loaderData} />
      <CustomProvidersCard query={loaderData} />
    </Flex>
  );
}
