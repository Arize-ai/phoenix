import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { LIST_LABELS_DEFAULT_LIMIT, LIST_LABELS_MAX_LIMIT } from "./constants";
import type { listLabelsToolQuery } from "./__generated__/listLabelsToolQuery.graphql";
import type {
  DatasetLabelSummary,
  ListLabelsInput,
  ListLabelsResult,
} from "./types";

/** Per-page size when scanning the full instance-wide label list to resolve names. */
const RESOLUTION_PAGE_SIZE = 200;
/** Safety bound on pages walked during a full scan (RESOLUTION_PAGE_SIZE × this). */
const RESOLUTION_MAX_PAGES = 100;

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
 * Fetch *every* instance-wide label by walking the `datasetLabels` connection to
 * exhaustion. Used to resolve label names to ids for the write tools, which
 * can't assume a single page covers the vocabulary (`datasetLabels` has no name
 * filter, so the full set must be scanned). Capped at RESOLUTION_MAX_PAGES as a
 * runaway guard.
 */
export async function fetchAllAvailableLabels(): Promise<
  { ok: true; labels: DatasetLabelSummary[] } | { ok: false; error: string }
> {
  const labels: DatasetLabelSummary[] = [];
  let after: string | null = null;
  try {
    for (let page = 0; page < RESOLUTION_MAX_PAGES; page++) {
      const result = await fetchLabelPage(RESOLUTION_PAGE_SIZE, after);
      if (!result) {
        return { ok: false, error: "Failed to read dataset labels." };
      }
      labels.push(...result.labels);
      if (!result.hasNextPage || result.endCursor == null) {
        return { ok: true, labels };
      }
      after = result.endCursor;
    }
    return { ok: true, labels };
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
