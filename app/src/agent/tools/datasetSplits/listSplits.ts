import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listSplitsToolQuery } from "./__generated__/listSplitsToolQuery.graphql";
import { LIST_SPLITS_DEFAULT_LIMIT, LIST_SPLITS_MAX_LIMIT } from "./constants";
import type {
  DatasetSplitSummary,
  ListSplitsInput,
  ListSplitsResult,
} from "./types";

/** Per-page size when scanning the full instance-wide split list to resolve names. */
const RESOLUTION_PAGE_SIZE = 200;
/** Safety bound on pages walked during a full scan (RESOLUTION_PAGE_SIZE × this). */
const RESOLUTION_MAX_PAGES = 100;

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
 * Fetch *every* instance-wide split by walking the `datasetSplits` connection to
 * exhaustion. Used to resolve split names to ids for the write tools: splits are
 * global, instance-wide entities (associated with a dataset only through their
 * member examples), so resolution can't assume the dataset in view already
 * carries the split. `datasetSplits` has no name filter, so the full set must be
 * scanned. Capped at RESOLUTION_MAX_PAGES as a runaway guard.
 */
export async function fetchAllSplits(): Promise<
  { ok: true; splits: DatasetSplitSummary[] } | { ok: false; error: string }
> {
  const splits: DatasetSplitSummary[] = [];
  let after: string | null = null;
  try {
    for (let page = 0; page < RESOLUTION_MAX_PAGES; page++) {
      const result = await fetchSplitPage(RESOLUTION_PAGE_SIZE, after);
      if (!result) {
        return { ok: false, error: "Failed to read the dataset's splits." };
      }
      splits.push(...result.splits);
      if (!result.hasNextPage || result.endCursor == null) {
        return { ok: true, splits };
      }
      after = result.endCursor;
    }
    return { ok: true, splits };
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
