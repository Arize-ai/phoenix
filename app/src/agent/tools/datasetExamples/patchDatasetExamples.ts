import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type { patchDatasetExamplesToolMutation } from "./__generated__/patchDatasetExamplesToolMutation.graphql";
import type { PatchDatasetExamplesInput } from "./types";

const mutation = graphql`
  mutation patchDatasetExamplesToolMutation(
    $input: PatchDatasetExamplesInput!
  ) {
    patchDatasetExamples(input: $input) {
      dataset {
        id
        name
      }
    }
  }
`;

/**
 * Edit existing rows via the existing `patchDatasetExamples` mutation (creates a
 * new dataset version). Runs outside React, so it uses the singleton Relay
 * environment.
 */
export function commitPatchDatasetExamples({
  patches,
  versionDescription,
}: PatchDatasetExamplesInput): Promise<DatasetWriteApplyResult> {
  return runDatasetMutation<patchDatasetExamplesToolMutation>({
    mutation,
    variables: {
      input: {
        patches: patches.map((patch) => ({
          exampleId: patch.exampleId,
          ...(patch.input !== undefined ? { input: patch.input } : {}),
          ...(patch.output !== undefined ? { output: patch.output } : {}),
          ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        })),
        ...(versionDescription != null ? { versionDescription } : {}),
      },
    },
    onSuccess: () => `Edited ${patches.length} row(s).`,
  });
}
