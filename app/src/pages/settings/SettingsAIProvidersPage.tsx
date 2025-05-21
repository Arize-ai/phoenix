import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { GenerativeProvidersCard } from "@phoenix/pages/settings/GenerativeProvidersCard";
import { settingsAIProvidersPageLoader } from "@phoenix/pages/settings/settingsAIProvidersPageLoader";

export function SettingsAIProvidersPage() {
  const loaderData = useLoaderData<typeof settingsAIProvidersPageLoader>();
  invariant(loaderData, "loaderData is required");
  return <GenerativeProvidersCard query={loaderData} />;
}
