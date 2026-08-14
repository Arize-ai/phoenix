import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listSplitsToolByNamesQuery } from "./__generated__/listSplitsToolByNamesQuery.graphql";
import type { listSplitsToolQuery } from "./__generated__/listSplitsToolQuery.graphql";
import { LIST_SPLITS_DEFAULT_LIMIT, LIST_SPLITS_MAX_LIMIT } from "./constants";
import type {
  DatasetSplitSummary,
  ListSplitsInput,
  ListSplitsResult,
} from "./types";

const query = graphql`
  query listSplitsToolQuery($first: Int!, $after: String) {
    datasetSplits(first: $first, after: $after) {
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
  query listSplitsToolByNamesQuery($names: [String!]!, $first: Int!) {
    datasetSplits(names: $names, first: $first) {
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

export function toSplitSummary(split: {
  id: string;
  name: string;
  description: string | null;
  color: string;
}): DatasetSplitSummary {
  return {
    id: split.id,
    name: split.name,
    description: split.description ?? null,
    color: split.color,
  };
}

/** One page of the instance-wide split connection, or `null` if it couldn't be read. */
async function fetchSplitPage(
  first: number,
  after: string | null
): Promise<{
  splits: DatasetSplitSummary[];
  hasNextPage: boolean;
  endCursor: string | null;
} | null> {
  const data = await fetchQuery<listSplitsToolQuery>(RelayEnvironment, query, {
    first,
    after,
  }).toPromise();
  const connection = data?.datasetSplits;
  if (!connection) {
    return null;
  }
  return {
    splits: connection.edges.map((edge) => toSplitSummary(edge.node)),
    hasNextPage: connection.pageInfo.hasNextPage,
    endCursor: connection.pageInfo.endCursor ?? null,
  };
}

/**
 * List a page of the instance-wide split vocabulary (`Query.datasetSplits`),
 * which can be large, hence paginated with `limit`/`after`. Runs outside React,
 * so it uses the singleton Relay environment.
 */
export async function commitListSplits({
  limit,
  after,
}: ListSplitsInput): Promise<ListSplitsResult> {
  const first = Math.min(
    limit ?? LIST_SPLITS_DEFAULT_LIMIT,
    LIST_SPLITS_MAX_LIMIT
  );
  try {
    const page = await fetchSplitPage(first, after ?? null);
    if (!page) {
      return { ok: false, error: "Failed to read splits." };
    }
    return {
      ok: true,
      output: {
        splits: page.splits,
        hasNextPage: page.hasNextPage,
        endCursor: page.endCursor,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read splits.",
    };
  }
}

/**
 * Fetch the instance-wide splits matching the given names exactly. Used to
 * resolve split names to ids for the write tools: splits are global,
 * instance-wide entities (associated with a dataset only through their member
 * examples), so resolution can't assume the dataset in view already carries
 * the split. Returns only the names that matched; callers diff against their
 * request to report unknown names.
 */
export async function fetchSplitsByNames(
  names: string[]
): Promise<
  { ok: true; splits: DatasetSplitSummary[] } | { ok: false; error: string }
> {
  const uniqueNames = Array.from(new Set(names));
  try {
    const data = await fetchQuery<listSplitsToolByNamesQuery>(
      RelayEnvironment,
      byNamesQuery,
      { names: uniqueNames, first: uniqueNames.length }
    ).toPromise();
    const connection = data?.datasetSplits;
    if (!connection) {
      return { ok: false, error: "Failed to read splits." };
    }
    return {
      ok: true,
      splits: connection.edges.map((edge) => toSplitSummary(edge.node)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read splits.",
    };
  }
}
