import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listDatasetSplitsToolQuery } from "./__generated__/listDatasetSplitsToolQuery.graphql";
import type { DatasetSplitSummary, ListDatasetSplitsResult } from "./types";

const query = graphql`
  query listDatasetSplitsToolQuery($datasetId: ID!) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        name
        splits {
          id
          name
          description
          color
        }
      }
    }
  }
`;

/**
 * List the in-context dataset's splits by reading `Dataset.splits` through the
 * singleton Relay environment. Replaces hand-written GraphQL. Runs outside
 * React, so it cannot use Relay hooks.
 */
export async function commitListDatasetSplits({
  datasetId,
}: {
  datasetId: string;
}): Promise<ListDatasetSplitsResult> {
  try {
    const data = await fetchQuery<listDatasetSplitsToolQuery>(
      RelayEnvironment,
      query,
      { datasetId }
    ).toPromise();
    const dataset = data?.dataset;
    if (!dataset || dataset.__typename !== "Dataset") {
      return { ok: false, error: "The dataset in view could not be read." };
    }
    const splits: DatasetSplitSummary[] = dataset.splits.map((split) => ({
      id: split.id,
      name: split.name,
      description: split.description ?? null,
      color: split.color,
    }));
    return { ok: true, output: { datasetName: dataset.name, splits } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to read the dataset's splits.",
    };
  }
}
