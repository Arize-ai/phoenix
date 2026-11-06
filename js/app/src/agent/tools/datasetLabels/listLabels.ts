import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { listLabelsToolByNamesQuery } from "./__generated__/listLabelsToolByNamesQuery.graphql";
import type { DatasetLabelSummary } from "./types";

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
