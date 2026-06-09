import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listDatasetsToolQuery } from "./__generated__/listDatasetsToolQuery.graphql";
import {
  LIST_DATASETS_DEFAULT_LIMIT,
  LIST_DATASETS_MAX_LIMIT,
} from "./constants";
import type {
  DatasetSummary,
  ListDatasetsInput,
  ListDatasetsResult,
} from "./types";

const query = graphql`
  query listDatasetsToolQuery(
    $first: Int!
    $after: String
    $filter: DatasetFilter
  ) {
    datasets(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
          exampleCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * List datasets (optionally name-filtered, paginated) by running the `datasets`
 * connection through the singleton Relay environment. Replaces hand-written
 * GraphQL the agent would otherwise issue via bash to discover datasets. Runs
 * outside React, so it cannot use Relay hooks.
 */
export async function commitListDatasets({
  nameContains,
  labelNames,
  limit,
  after,
}: ListDatasetsInput): Promise<ListDatasetsResult> {
  const first = Math.min(
    limit ?? LIST_DATASETS_DEFAULT_LIMIT,
    LIST_DATASETS_MAX_LIMIT
  );
  const hasLabelFilter = labelNames != null && labelNames.length > 0;
  const filter =
    nameContains || hasLabelFilter
      ? {
          ...(nameContains
            ? { col: "name" as const, value: nameContains }
            : {}),
          ...(hasLabelFilter ? { filterLabels: labelNames } : {}),
        }
      : null;
  try {
    const data = await fetchQuery<listDatasetsToolQuery>(
      RelayEnvironment,
      query,
      { first, after: after ?? null, filter }
    ).toPromise();
    const connection = data?.datasets;
    if (!connection) {
      return { ok: false, error: "Could not list datasets." };
    }
    const datasets: DatasetSummary[] = connection.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      exampleCount: edge.node.exampleCount,
    }));
    return {
      ok: true,
      output: {
        datasets,
        hasNextPage: connection.pageInfo.hasNextPage,
        endCursor: connection.pageInfo.endCursor ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to list datasets.",
    };
  }
}
