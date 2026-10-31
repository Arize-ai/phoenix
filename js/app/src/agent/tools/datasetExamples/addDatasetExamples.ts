import { graphql } from "react-relay";

import { emitAgentDataChange } from "@phoenix/agent/shared/agentDataChanges";
import { runDatasetMutation } from "@phoenix/agent/shared/pendingDatasetWrite";

import type { addDatasetExamplesToolMutation } from "./__generated__/addDatasetExamplesToolMutation.graphql";
import type {
  AddDatasetExamplesInput,
  AddDatasetExamplesResult,
} from "./types";

/**
 * Returns the dataset's row count and audit fields so the dataset page header
 * and the datasets table row update from the normalized store. The examples
 * table itself refetches on the version change signalled through the agent
 * data-change bridge, exactly as the UI's add-example form triggers it.
 */
const mutation = graphql`
  mutation addDatasetExamplesToolMutation($input: AddExamplesToDatasetInput!) {
    addExamplesToDataset(input: $input) {
      dataset {
        id
        name
        exampleCount
        updatedAt
      }
    }
  }
`;

/**
 * Append examples to a dataset by committing the existing
 * `addExamplesToDataset` GraphQL mutation against the singleton Relay
 * environment. Runs outside React (in the AI SDK tool runtime), so it cannot
 * use Relay hooks. `DatasetExampleInput` requires input/output/metadata, so an
 * omitted output or metadata is sent as an empty object.
 */
export function commitAddDatasetExamples({
  datasetId,
  examples,
}: {
  datasetId: string;
  examples: AddDatasetExamplesInput["examples"];
}): Promise<AddDatasetExamplesResult> {
  const preparedExamples = examples.map((example) => ({
    input: example.input,
    output: example.output ?? {},
    metadata: example.metadata ?? {},
  }));
  return runDatasetMutation<addDatasetExamplesToolMutation>({
    mutation,
    variables: {
      input: {
        datasetId,
        examples: preparedExamples,
        datasetVersionDescription: `Added ${preparedExamples.length} example(s) via the assistant`,
      },
    },
    onSuccess: (response) => {
      const dataset = response.addExamplesToDataset.dataset;
      emitAgentDataChange({ entity: "datasetExamples", datasetId: dataset.id });
      return `Added ${preparedExamples.length} example(s) to "${dataset.name}". The dataset now has ${dataset.exampleCount} example(s).`;
    },
  });
}
