import React from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Card } from "@arizeai/components";

import { RetentionPoliciesTable } from "./RetentionPoliciesTable";
import { settingsDataPageLoader } from "./settingsDataPageLoader";

export function SettingsDataPage() {
  const loaderData = useLoaderData<typeof settingsDataPageLoader>();
  invariant(loaderData, "loaderData is required");

  return (
    <Card
      title="Retention Policies"
      bodyStyle={{ padding: 0 }}
      variant="compact"
    >
      <RetentionPoliciesTable query={loaderData} />
    </Card>
  );
}
