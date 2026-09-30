import { graphql, useLazyLoadQuery } from "react-relay";

import { useAgentDataChangeFetchKey } from "@phoenix/hooks";
import type { SettingsDatasetsPageQuery } from "@phoenix/pages/settings/datasets/__generated__/SettingsDatasetsPageQuery.graphql";

import { DatasetLabelsSettingsCard } from "./DatasetLabelsSettingsCard";

const REFRESH_ON = ["datasetLabels"] as const;

export function SettingsDatasetsPage() {
  const fetchKey = useAgentDataChangeFetchKey(REFRESH_ON);
  const query = useLazyLoadQuery<SettingsDatasetsPageQuery>(
    graphql`
      query SettingsDatasetsPageQuery {
        ...DatasetLabelsSettingsCardFragment
      }
    `,
    {},
    { fetchKey, fetchPolicy: "network-only" }
  );
  return (
    <main>
      <DatasetLabelsSettingsCard query={query} />
    </main>
  );
}
