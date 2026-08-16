import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { patchDatasetToolMutation } from "./__generated__/patchDatasetToolMutation.graphql";
import type { PatchDatasetInput } from "./types";

const mutation = graphql`
  mutation patchDatasetToolMutation($input: PatchDatasetInput!) {
    patchDataset(input: $input) {
      dataset {
        id
        name
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
    onSuccess: (response) =>
      `Updated dataset "${response.patchDataset.dataset.name}".`,
  });
}
