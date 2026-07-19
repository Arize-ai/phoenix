import { ConnectionHandler, graphql, useFragment } from "react-relay";

import { Card } from "@phoenix/components";
import { NewDatasetLabelButton } from "@phoenix/components/dataset/NewDatasetLabelButton";

import { SettingsDocumentationHelp } from "../SettingsDocumentationHelp";
import type { DatasetLabelsSettingsCardFragment$key } from "./__generated__/DatasetLabelsSettingsCardFragment.graphql";
import { DatasetLabelsTable } from "./DatasetLabelsTable";

export function DatasetLabelsSettingsCard({
  query,
}: {
  query: DatasetLabelsSettingsCardFragment$key;
}) {
  const data = useFragment<DatasetLabelsSettingsCardFragment$key>(
    graphql`
      fragment DatasetLabelsSettingsCardFragment on Query {
        ...DatasetLabelsTableFragment
      }
    `,
    query
  );
  return (
    <Card
      title="Dataset Labels"
      titleExtra={
        <SettingsDocumentationHelp topic="datasetLabels">
          Create reusable labels for organizing and filtering datasets.
        </SettingsDocumentationHelp>
      }
      extra={
        <NewDatasetLabelButton
          updateConnectionIds={[
            ConnectionHandler.getConnectionID(
              "client:root",
              "DatasetLabelsTable__datasetLabels"
            ),
          ]}
        />
      }
    >
      <DatasetLabelsTable query={data} />
    </Card>
  );
}
