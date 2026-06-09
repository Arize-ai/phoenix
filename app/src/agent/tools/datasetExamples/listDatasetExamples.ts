import { fetchQuery, graphql } from "react-relay";

import { resolveNamesToIds } from "@phoenix/agent/shared/resolveNamesToIds";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listDatasetExamplesToolQuery } from "./__generated__/listDatasetExamplesToolQuery.graphql";
import type { listDatasetExamplesToolSplitsQuery } from "./__generated__/listDatasetExamplesToolSplitsQuery.graphql";
import {
  LIST_DATASET_EXAMPLES_DEFAULT_LIMIT,
  LIST_DATASET_EXAMPLES_MAX_LIMIT,
} from "./constants";
import type {
  DatasetExampleRow,
  ListDatasetExamplesInput,
  ListDatasetExamplesResult,
} from "./types";

const splitsQuery = graphql`
  query listDatasetExamplesToolSplitsQuery($datasetId: ID!) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        splits {
          id
          name
        }
      }
    }
  }
`;

const examplesQuery = graphql`
  query listDatasetExamplesToolQuery(
    $datasetId: ID!
    $first: Int!
    $after: String
    $splitIds: [ID!]
  ) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        name
        splits {
          id
          name
        }
        examples(first: $first, after: $after, splitIds: $splitIds) {
          edges {
            node {
              id
              revision {
                input
                output
                metadata
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

/**
 * List a page of the in-context dataset's rows by running the dataset
 * `examples` connection through the singleton Relay environment — optionally
 * filtered to named splits and paginated. Replaces the hand-written GraphQL the
 * agent would otherwise issue via bash. Runs outside React, so it cannot use
 * Relay hooks. When `splitNames` are given they are resolved to ids first; an
 * unknown name returns an error listing the available splits.
 */
export async function commitListDatasetExamples({
  datasetId,
  limit,
  after,
  splitNames,
}: {
  datasetId: string;
} & Pick<
  ListDatasetExamplesInput,
  "limit" | "after" | "splitNames"
>): Promise<ListDatasetExamplesResult> {
  const first = Math.min(
    limit ?? LIST_DATASET_EXAMPLES_DEFAULT_LIMIT,
    LIST_DATASET_EXAMPLES_MAX_LIMIT
  );
  try {
    let splitIds: string[] | null = null;
    if (splitNames && splitNames.length > 0) {
      const splitsData = await fetchQuery<listDatasetExamplesToolSplitsQuery>(
        RelayEnvironment,
        splitsQuery,
        { datasetId }
      ).toPromise();
      const splitsDataset = splitsData?.dataset;
      if (!splitsDataset || splitsDataset.__typename !== "Dataset") {
        return { ok: false, error: "The dataset in view could not be read." };
      }
      const { ids, unknown } = resolveNamesToIds(
        splitsDataset.splits,
        splitNames
      );
      if (unknown.length > 0) {
        const available =
          splitsDataset.splits.map((split) => split.name).join(", ") ||
          "(none)";
        return {
          ok: false,
          error: `Unknown split(s): ${unknown.join(", ")}. Available splits: ${available}.`,
        };
      }
      splitIds = ids;
    }

    const data = await fetchQuery<listDatasetExamplesToolQuery>(
      RelayEnvironment,
      examplesQuery,
      { datasetId, first, after: after ?? null, splitIds }
    ).toPromise();
    const dataset = data?.dataset;
    if (!dataset || dataset.__typename !== "Dataset") {
      return { ok: false, error: "The dataset in view could not be read." };
    }
    const examples: DatasetExampleRow[] = dataset.examples.edges.map(
      (edge) => ({
        id: edge.node.id,
        input: edge.node.revision.input,
        output: edge.node.revision.output,
        metadata: edge.node.revision.metadata,
      })
    );
    return {
      ok: true,
      output: {
        datasetName: dataset.name,
        availableSplits: dataset.splits.map((split) => split.name),
        examples,
        hasNextPage: dataset.examples.pageInfo.hasNextPage,
        endCursor: dataset.examples.pageInfo.endCursor ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to read the dataset.",
    };
  }
}
