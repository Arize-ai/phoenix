import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { verifyExamplesInDatasetQuery } from "./__generated__/verifyExamplesInDatasetQuery.graphql";

const query = graphql`
  query verifyExamplesInDatasetQuery(
    $datasetId: ID!
    $filterIds: [ID!]!
    $first: Int!
  ) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        name
        examples(filterIds: $filterIds, first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }
`;

/** How many missing ids to spell out in the error before truncating. */
const MAX_LISTED_MISSING_IDS = 20;

export type VerifyExamplesInDatasetResult =
  | { ok: true; datasetName: string }
  | { ok: false; error: string };

/**
 * Preflight for example-targeted writes: confirm every requested example id is
 * a row of the dataset in view before an approval is staged or a mutation runs.
 * Example ids are global, so without this check a stale or mistyped id would
 * silently target another dataset. Returns the dataset's name on success so
 * approval previews can say which dataset is being written to. Runs outside
 * React, so it uses the singleton Relay environment.
 */
export async function verifyExamplesInDataset({
  datasetId,
  exampleIds,
}: {
  datasetId: string;
  exampleIds: string[];
}): Promise<VerifyExamplesInDatasetResult> {
  const uniqueIds = Array.from(new Set(exampleIds));
  try {
    const data = await fetchQuery<verifyExamplesInDatasetQuery>(
      RelayEnvironment,
      query,
      { datasetId, filterIds: uniqueIds, first: uniqueIds.length }
    ).toPromise();
    const dataset = data?.dataset;
    if (!dataset || dataset.__typename !== "Dataset") {
      return { ok: false, error: "The dataset in view could not be read." };
    }
    const memberIds = new Set(
      dataset.examples.edges.map((edge) => edge.node.id)
    );
    const missing = uniqueIds.filter((id) => !memberIds.has(id));
    if (missing.length > 0) {
      const listed = missing.slice(0, MAX_LISTED_MISSING_IDS).join(", ");
      const suffix =
        missing.length > MAX_LISTED_MISSING_IDS
          ? ` (and ${missing.length - MAX_LISTED_MISSING_IDS} more)`
          : "";
      return {
        ok: false,
        error: `${missing.length} example id(s) are not rows of the dataset in view ("${dataset.name}"): ${listed}${suffix}. Get current row ids from list_dataset_examples.`,
      };
    }
    return { ok: true, datasetName: dataset.name };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify the example ids against the dataset in view.",
    };
  }
}
