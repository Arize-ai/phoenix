import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listSplitsToolByNamesQuery } from "./__generated__/listSplitsToolByNamesQuery.graphql";
import type { DatasetSplitSummary } from "./types";

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
