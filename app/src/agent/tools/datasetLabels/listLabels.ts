import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listLabelsToolByNamesQuery } from "./__generated__/listLabelsToolByNamesQuery.graphql";
import type { listLabelsToolQuery } from "./__generated__/listLabelsToolQuery.graphql";
import { LIST_LABELS_DEFAULT_LIMIT, LIST_LABELS_MAX_LIMIT } from "./constants";
import type {
  DatasetLabelSummary,
  ListLabelsInput,
  ListLabelsResult,
} from "./types";

const query = graphql`
  query listLabelsToolQuery($first: Int!, $after: String) {
    datasetLabels(first: $first, after: $after) {
      edges {
        node {
          id
          name
          description
          color
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const byNamesQuery = graphql`
  query listLabelsToolByNamesQuery($names: [String!]!, $first: Int!) {
    datasetLabels(names: $names, first: $first) {
      edges {
        node {
          id
          name
          description
          color
        }
      }
    }
  }
`;

export function toLabelSummary(label: {
  id: string;
  name: string;
  description: string | null;
  color: string;
}): DatasetLabelSummary {
  return {
    id: label.id,
    name: label.name,
    description: label.description ?? null,
    color: label.color,
  };
}

/** One page of the instance-wide label connection, or `null` if it couldn't be read. */
async function fetchLabelPage(
  first: number,
  after: string | null
): Promise<{
  labels: DatasetLabelSummary[];
  hasNextPage: boolean;
  endCursor: string | null;
} | null> {
  const data = await fetchQuery<listLabelsToolQuery>(RelayEnvironment, query, {
    first,
    after,
  }).toPromise();
  const connection = data?.datasetLabels;
  if (!connection) {
    return null;
  }
  return {
    labels: connection.edges.map((edge) => toLabelSummary(edge.node)),
    hasNextPage: connection.pageInfo.hasNextPage,
    endCursor: connection.pageInfo.endCursor ?? null,
  };
}

/**
 * List a page of the instance-wide label vocabulary (`Query.datasetLabels`),
 * which can be large, hence paginated with `limit`/`after`. Runs outside React,
 * so it uses the singleton Relay environment.
 */
export async function commitListLabels({
  limit,
  after,
}: ListLabelsInput): Promise<ListLabelsResult> {
  const first = Math.min(
    limit ?? LIST_LABELS_DEFAULT_LIMIT,
    LIST_LABELS_MAX_LIMIT
  );
  try {
    const page = await fetchLabelPage(first, after ?? null);
    if (!page) {
      return { ok: false, error: "Failed to read labels." };
    }
    return {
      ok: true,
      output: {
        labels: page.labels,
        hasNextPage: page.hasNextPage,
        endCursor: page.endCursor,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read labels.",
    };
  }
}

/**
 * Fetch the instance-wide labels matching the given names exactly. Used to
 * resolve label names to ids for the write tools. Returns only the names that
 * matched; callers diff against their request to report unknown names.
 */
export async function fetchLabelsByNames(
  names: string[]
): Promise<
  { ok: true; labels: DatasetLabelSummary[] } | { ok: false; error: string }
> {
  const uniqueNames = Array.from(new Set(names));
  try {
    const data = await fetchQuery<listLabelsToolByNamesQuery>(
      RelayEnvironment,
      byNamesQuery,
      { names: uniqueNames, first: uniqueNames.length }
    ).toPromise();
    const connection = data?.datasetLabels;
    if (!connection) {
      return { ok: false, error: "Failed to read dataset labels." };
    }
    return {
      ok: true,
      labels: connection.edges.map((edge) => toLabelSummary(edge.node)),
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
