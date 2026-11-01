import { graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { patchDatasetToolMutation } from "./__generated__/patchDatasetToolMutation.graphql";
import type { PatchDatasetInput } from "./types";

/**
 * Returns the editable fields plus the audit fields the datasets table row
 * and the dataset page header render, so both update from the normalized
 * store without a reload (the UI's `EditDatasetForm` returns the same set).
 */
const mutation = graphql`
  mutation patchDatasetToolMutation($input: PatchDatasetInput!) {
    patchDataset(input: $input) {
      dataset {
        id
        name
        description
        metadata
        updatedAt
        updatedBy {
          username
          profilePictureUrl
        }
      }
    }
  }
`;

/**
 * Edit the in-context dataset's name/description/metadata via the existing
 * `patchDataset` mutation. Only provided fields are sent. Runs outside React, so
 * it uses the singleton Relay environment.
 */
export function commitPatchDataset({
  datasetId,
  name,
  description,
  metadata,
}: {
  datasetId: string;
} & PatchDatasetInput): Promise<DatasetWriteApplyResult> {
  return runDatasetMutation<patchDatasetToolMutation>({
    mutation,
    variables: {
      input: {
        datasetId,
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    },
    onSuccess: (response) => {
      emitAgentDataChange({ entity: "datasets" });
      return `Updated dataset "${response.patchDataset.dataset.name}".`;
    },
  });
}
