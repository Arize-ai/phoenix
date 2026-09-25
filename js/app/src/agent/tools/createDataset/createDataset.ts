import { commitMutation, graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import { commitAddDatasetExamples } from "@phoenix/agent/tools/datasetExamples";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { createDatasetToolMutation } from "./__generated__/createDatasetToolMutation.graphql";
import type { CreateDatasetInput, CreateDatasetResult } from "./types";

/**
 * Returns every field a mounted surface renders for a dataset so the new
 * record is complete in the Relay store. Mounted dataset lists refetch through
 * the agent data-change bridge after creation.
 */
const mutation = graphql`
  mutation createDatasetToolMutation($input: CreateDatasetInput!) {
    createDataset(input: $input) {
      dataset {
        id
        name
        description
        metadata
        createdAt
        updatedAt
        createdBy {
          username
          profilePictureUrl
        }
        updatedBy {
          username
          profilePictureUrl
        }
        exampleCount
        experimentCount
        evaluatorCount
        labels {
          id
          name
          color
        }
        splits {
          id
          name
          color
        }
        ...DatasetSelect_dataset
      }
    }
  }
`;

type CreatedDataset = { datasetId: string; name: string } | { error: string };

function commitCreate(
  name: string,
  description: string | null
): Promise<CreatedDataset> {
  return new Promise((resolve) => {
    commitMutation<createDatasetToolMutation>(RelayEnvironment, {
      mutation,
      variables: {
        input: { name, description, metadata: {} },
      },
      onCompleted: (response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          resolve({ error: message });
          return;
        }
        const dataset = response.createDataset.dataset;
        emitAgentDataChange({ entity: "datasets" });
        resolve({ datasetId: dataset.id, name: dataset.name });
      },
      onError: (error) => resolve({ error: error.message }),
    });
  });
}

/**
 * Create a new dataset by committing the existing `createDataset` mutation, then
 * — if starting rows were provided — seed them by reusing
 * `commitAddDatasetExamples`. Runs outside React, so it uses the singleton Relay
 * environment. A duplicate name surfaces as an error for the model to retry with
 * a different name.
 */
export async function commitCreateDataset({
  name,
  description,
  examples,
}: CreateDatasetInput): Promise<CreateDatasetResult> {
  const created = await commitCreate(name, description ?? null);
  if ("error" in created) {
    return { ok: false, error: created.error };
  }
  if (examples && examples.length > 0) {
    const added = await commitAddDatasetExamples({
      datasetId: created.datasetId,
      examples,
    });
    if (!added.ok) {
      // The dataset was created; only seeding failed. Report success with a
      // caveat so the model does not retry the create with the same (now
      // taken) name — it should add the rows via dataset.examples.add instead.
      return {
        ok: true,
        output: `Created dataset "${created.name}" (it now exists), but adding the starting rows failed: ${added.error}. Add the rows with the ui.dataset.examples.add operation rather than creating the dataset again.`,
      };
    }
    return {
      ok: true,
      output: `Created dataset "${created.name}" with ${examples.length} example(s).`,
    };
  }
  return { ok: true, output: `Created dataset "${created.name}".` };
}
