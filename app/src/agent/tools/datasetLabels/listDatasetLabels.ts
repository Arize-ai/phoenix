import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listDatasetLabelsToolQuery } from "./__generated__/listDatasetLabelsToolQuery.graphql";
import { toLabelSummary } from "./listLabels";
import type { ListDatasetLabelsResult } from "./types";

const query = graphql`
  query listDatasetLabelsToolQuery($datasetId: ID!) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        name
        labels {
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
 * List the labels applied to the in-view dataset (`Dataset.labels`, a bounded
 * per-dataset set — not paginated). For the instance-wide vocabulary, use
 * `list_labels` (commitListLabels). Runs outside React, so it uses the singleton
 * Relay environment.
 */
export async function commitListDatasetLabels({
  datasetId,
}: {
  datasetId: string;
}): Promise<ListDatasetLabelsResult> {
  try {
    const data = await fetchQuery<listDatasetLabelsToolQuery>(
      RelayEnvironment,
      query,
      { datasetId }
    ).toPromise();
    const dataset = data?.dataset;
    if (!dataset || dataset.__typename !== "Dataset") {
      return { ok: false, error: "The dataset in view could not be read." };
    }
    return {
      ok: true,
      output: {
        datasetName: dataset.name,
        labels: dataset.labels.map(toLabelSummary),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to read dataset labels.",
    };
  }
}
