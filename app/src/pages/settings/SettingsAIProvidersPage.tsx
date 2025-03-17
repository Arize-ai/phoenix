import React from "react";
import { useLoaderData } from "react-router";

import { GenerativeProvidersCard } from "@phoenix/pages/settings/GenerativeProvidersCard";

import { settingsAIProvidersPageLoaderQuery$data } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export function SettingsAIProvidersPage() {
  const data = useLoaderData() as settingsAIProvidersPageLoaderQuery$data;

  return <GenerativeProvidersCard query={data} />;
}
