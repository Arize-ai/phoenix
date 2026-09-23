import { graphql, useLazyLoadQuery } from "react-relay";

import type { SettingsDatasetsPageQuery } from "@phoenix/pages/settings/datasets/__generated__/SettingsDatasetsPageQuery.graphql";

import { DatasetLabelsSettingsCard } from "./DatasetLabelsSettingsCard";

export function SettingsDatasetsPage() {
  const query = useLazyLoadQuery<SettingsDatasetsPageQuery>(
    graphql`
      query SettingsDatasetsPageQuery {
        ...DatasetLabelsSettingsCardFragment
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <main>
      <DatasetLabelsSettingsCard query={query} />
    </main>
  );
}
