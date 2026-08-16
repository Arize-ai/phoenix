import { commitMutation, graphql } from "react-relay";

import type { DatasetWriteApplyResult } from "@phoenix/agent/shared/pendingDatasetWrite";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { createDatasetSplitToolMutation } from "./__generated__/createDatasetSplitToolMutation.graphql";
import type { createDatasetSplitToolWithExamplesMutation } from "./__generated__/createDatasetSplitToolWithExamplesMutation.graphql";
import { DEFAULT_DATASET_SPLIT_COLOR } from "./constants";
import type { CreateDatasetSplitInput } from "./types";

const createMutation = graphql`
  mutation createDatasetSplitToolMutation($input: CreateDatasetSplitInput!) {
    createDatasetSplit(input: $input) {
      datasetSplit {
        id
        name
      }
    }
  }
`;

const createWithExamplesMutation = graphql`
  mutation createDatasetSplitToolWithExamplesMutation(
    $input: CreateDatasetSplitWithExamplesInput!
  ) {
    createDatasetSplitWithExamples(input: $input) {
      datasetSplit {
        id
        name
      }
    }
  }
`;

/**
 * Create a dataset split via the existing `createDatasetSplit` /
 * `createDatasetSplitWithExamples` mutations. Split names are unique
 * instance-wide; a duplicate surfaces as an error for the model to retry with a
 * different name. Runs outside React, so it uses the singleton Relay
 * environment.
 */
export function commitCreateDatasetSplit({
  name,
  description,
  color,
  exampleIds,
}: CreateDatasetSplitInput): Promise<DatasetWriteApplyResult> {
  const resolvedColor = color ?? DEFAULT_DATASET_SPLIT_COLOR;
  const seedCount = exampleIds?.length ?? 0;
  return new Promise((resolve) => {
    const onCompleted = (
      datasetSplitName: string | undefined,
      errors: readonly { message?: string }[] | null | undefined
    ) => {
      const message = errors?.find((error) => error.message)?.message;
      if (message) {
        resolve({ ok: false, error: message });
        return;
      }
      resolve({
        ok: true,
        output:
          seedCount > 0
            ? `Created split "${datasetSplitName}" with ${seedCount} example(s).`
            : `Created split "${datasetSplitName}".`,
      });
    };
    if (exampleIds && exampleIds.length > 0) {
      commitMutation<createDatasetSplitToolWithExamplesMutation>(
        RelayEnvironment,
        {
          mutation: createWithExamplesMutation,
          variables: {
            input: {
              name,
              description: description ?? null,
              color: resolvedColor,
              exampleIds,
            },
          },
          onCompleted: (response, errors) =>
            onCompleted(
              response.createDatasetSplitWithExamples.datasetSplit.name,
              errors
            ),
          onError: (error) => resolve({ ok: false, error: error.message }),
        }
      );
      return;
    }
    commitMutation<createDatasetSplitToolMutation>(RelayEnvironment, {
      mutation: createMutation,
      variables: {
        input: { name, description: description ?? null, color: resolvedColor },
      },
      onCompleted: (response, errors) =>
        onCompleted(response.createDatasetSplit.datasetSplit.name, errors),
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}
