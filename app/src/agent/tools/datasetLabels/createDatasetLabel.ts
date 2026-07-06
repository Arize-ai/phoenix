import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { createDatasetLabelToolMutation } from "./__generated__/createDatasetLabelToolMutation.graphql";
import { DEFAULT_DATASET_LABEL_COLOR } from "./constants";
import type { CreateDatasetLabelInput } from "./types";

const mutation = graphql`
  mutation createDatasetLabelToolMutation($input: CreateDatasetLabelInput!) {
    createDatasetLabel(input: $input) {
      datasetLabel {
        id
        name
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
    },
    onSuccess: (response) => {
      const labelName = response.createDatasetLabel.datasetLabel.name;
      return attach
        ? `Created label "${labelName}" and attached it to this dataset.`
        : `Created label "${labelName}".`;
    },
  });
}
