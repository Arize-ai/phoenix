import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  DATASET_LABEL_CONNECTION_KEYS,
  getRootConnectionIds,
} from "@phoenix/agent/shared/relayConnections";

import type { createDatasetLabelToolMutation } from "./__generated__/createDatasetLabelToolMutation.graphql";
import { DEFAULT_DATASET_LABEL_COLOR } from "./constants";
import type { CreateDatasetLabelInput } from "./types";

/**
 * Mirrors `useDatasetLabelMutations`: the new label is prepended to every
 * mounted label list, and the datasets it was attached to come back with
 * their full `labels` so the dataset page header and table chips update.
 */
const mutation = graphql`
  mutation createDatasetLabelToolMutation(
    $input: CreateDatasetLabelInput!
    $connections: [ID!]!
  ) {
    createDatasetLabel(input: $input) {
      datasetLabel
        @prependNode(
          connections: $connections
          edgeTypeName: "DatasetLabelEdge"
        ) {
        id
        name
        description
        color
        usageCount
      }
      datasets {
        id
        labels {
          id
          name
          color
        }
      }
    }
  }
`;

/**
 * Create a dataset label via the existing `createDatasetLabel` mutation,
 * optionally attaching it to the in-context dataset. Label names are unique
 * instance-wide; a duplicate surfaces as an error for the model to retry with a
 * different name. Runs outside React, so it uses the singleton Relay
 * environment.
 */
export function commitCreateDatasetLabel({
  datasetId,
  name,
  description,
  color,
  attachToDataset,
}: {
  datasetId: string;
} & CreateDatasetLabelInput): Promise<DatasetWriteApplyResult> {
  const attach = attachToDataset !== false;
  return runDatasetMutation<createDatasetLabelToolMutation>({
    mutation,
    variables: {
      input: {
        name,
        description: description ?? null,
        color: color ?? DEFAULT_DATASET_LABEL_COLOR,
        datasetIds: attach ? [datasetId] : null,
      },
      connections: getRootConnectionIds(DATASET_LABEL_CONNECTION_KEYS),
    },
    onSuccess: (response) => {
      const labelName = response.createDatasetLabel.datasetLabel.name;
      return attach
        ? `Created label "${labelName}" and attached it to this dataset.`
        : `Created label "${labelName}".`;
    },
  });
}
