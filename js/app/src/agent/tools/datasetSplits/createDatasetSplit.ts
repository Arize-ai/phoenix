import { commitMutation, graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import type { DatasetWriteApplyResult } from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  DATASET_SPLIT_CONNECTION_KEYS,
  getRootConnectionIds,
} from "@phoenix/agent/shared/relayConnections";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { createDatasetSplitToolMutation } from "./__generated__/createDatasetSplitToolMutation.graphql";
import type { createDatasetSplitToolWithExamplesMutation } from "./__generated__/createDatasetSplitToolWithExamplesMutation.graphql";
import { DEFAULT_DATASET_SPLIT_COLOR } from "./constants";
import { refreshDatasetSplits } from "./refreshDatasetSplits";
import type { CreateDatasetSplitInput } from "./types";

/**
 * Both mutations mirror `useDatasetSplitMutations`: the new split is
 * prepended to the manage-splits dialog list. The with-examples variant also
 * returns each seeded example's `datasetSplits`, which is what the examples
 * table renders as split chips. The root `datasetSplits` list (the Splits
 * filter and assign-to-split menus) is refetched separately on success; see
 * {@link refreshDatasetSplits} for why a payload-level `query { }` cannot do it.
 */
const createMutation = graphql`
  mutation createDatasetSplitToolMutation(
    $input: CreateDatasetSplitInput!
    $connections: [ID!]!
  ) {
    createDatasetSplit(input: $input) {
      datasetSplit
        @prependNode(
          connections: $connections
          edgeTypeName: "DatasetSplitEdge"
        ) {
        id
        name
        description
        color
      }
    }
  }
`;

const createWithExamplesMutation = graphql`
  mutation createDatasetSplitToolWithExamplesMutation(
    $input: CreateDatasetSplitWithExamplesInput!
    $connections: [ID!]!
  ) {
    createDatasetSplitWithExamples(input: $input) {
      datasetSplit
        @prependNode(
          connections: $connections
          edgeTypeName: "DatasetSplitEdge"
        ) {
        id
        name
        description
        color
      }
      examples {
        id
        datasetSplits {
          id
          name
          color
        }
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
  const connections = getRootConnectionIds(DATASET_SPLIT_CONNECTION_KEYS);
  return new Promise((resolve) => {
    const onCompleted = async (
      datasetSplitName: string | undefined,
      errors: readonly { message?: string }[] | null | undefined
    ) => {
      const message = errors?.find((error) => error.message)?.message;
      if (message) {
        resolve({ ok: false, error: message });
        return;
      }
      await refreshDatasetSplits();
      emitAgentDataChange({ entity: "datasetSplits" });
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
            connections,
          },
          onCompleted: (response, errors) =>
            void onCompleted(
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
        connections,
      },
      onCompleted: (response, errors) =>
        void onCompleted(response.createDatasetSplit.datasetSplit.name, errors),
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}
