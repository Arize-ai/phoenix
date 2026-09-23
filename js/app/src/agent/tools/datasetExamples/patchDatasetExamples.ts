import { graphql } from "react-relay";

import {
  runDatasetMutation,
  type DatasetWriteApplyResult,
} from "@phoenix/agent/shared/pendingDatasetWrite";

import type {
  DatasetExampleField,
  DatasetExampleOperation,
  patchDatasetExamplesToolMutation,
} from "./__generated__/patchDatasetExamplesToolMutation.graphql";
import type { PatchDatasetExamplesInput } from "./types";

/** The fields a patch may carry and the GraphQL field each one replaces. */
const REPLACEABLE_FIELDS = [
  ["input", "INPUT"],
  ["output", "OUTPUT"],
  ["metadata", "METADATA"],
] as const satisfies ReadonlyArray<readonly [string, DatasetExampleField]>;

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
 * Edit existing rows via the `patchDatasetExamples` mutation (creates a new
 * dataset version). Each patch becomes one `replace` operation per field it
 * carries. The write is scoped to the dataset in view via `datasetId`, so the
 * server rejects it outright if any example belongs to another dataset. Runs
 * outside React, so it uses the singleton Relay environment.
 */
export function commitPatchDatasetExamples({
  datasetId,
  patches,
  versionDescription,
}: {
  datasetId: string;
} & PatchDatasetExamplesInput): Promise<DatasetWriteApplyResult> {
  return runDatasetMutation<patchDatasetExamplesToolMutation>({
    mutation,
    variables: {
      input: {
        datasetId,
        operations: patches.flatMap((patch): DatasetExampleOperation[] =>
          REPLACEABLE_FIELDS.flatMap(([columnId, field]) =>
            patch[columnId] === undefined
              ? []
              : [
                  {
                    replace: {
                      exampleId: patch.exampleId,
                      field,
                      value: patch[columnId],
                    },
                  },
                ]
          )
        ),
        ...(versionDescription != null ? { versionDescription } : {}),
      },
    },
    onSuccess: () => `Edited ${patches.length} row(s).`,
  });
}
