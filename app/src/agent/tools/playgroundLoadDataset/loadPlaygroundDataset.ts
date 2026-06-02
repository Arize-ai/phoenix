import { fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { loadPlaygroundDatasetExampleCountQuery } from "./__generated__/loadPlaygroundDatasetExampleCountQuery.graphql";
import type { loadPlaygroundDatasetResolveQuery } from "./__generated__/loadPlaygroundDatasetResolveQuery.graphql";
import type {
  DatasetSelectionSnapshot,
  DatasetTargetResolution,
  ExpectedSelection,
  LoadDatasetInput,
  ResolvedDatasetTarget,
} from "./types";

// `datasets(filter:)` is a substring `ilike` match, so a name can return multiple rows;
// the page size only guards against an exact match being pushed past the first page.
const DATASET_RESOLVE_PAGE_SIZE = 100;

const resolveDatasetQuery = graphql`
  query loadPlaygroundDatasetResolveQuery($name: String!, $first: Int!) {
    datasets(filter: { col: name, value: $name }, first: $first) {
      edges {
        node {
          id
          name
          exampleCount
          splits {
            id
            name
          }
        }
      }
    }
  }
`;

const datasetExampleCountQuery = graphql`
  query loadPlaygroundDatasetExampleCountQuery($id: ID!, $splitIds: [ID!]!) {
    node(id: $id) {
      ... on Dataset {
        exampleCount(splitIds: $splitIds)
      }
    }
  }
`;

type ResolvedDatasetRow = {
  id: string;
  name: string;
  exampleCount: number;
  splits: ReadonlyArray<{ id: string; name: string }>;
};

// Emptiness is split-scoped: a supplied split's example count is checked, not the dataset total.
export async function resolveLoadDatasetTarget(
  input: LoadDatasetInput
): Promise<DatasetTargetResolution> {
  let datasetRow: ResolvedDatasetRow | null;
  try {
    datasetRow = await resolveDatasetRowByName(input.datasetName);
  } catch (error) {
    return { ok: false, error: getResolveFailureMessage(error) };
  }
  if (!datasetRow) {
    return {
      ok: false,
      error: `No dataset named "${input.datasetName}" was found.`,
    };
  }

  if (input.splitName === undefined) {
    if (datasetRow.exampleCount <= 0) {
      return {
        ok: false,
        error: `Dataset "${datasetRow.name}" has no examples to load.`,
      };
    }
    return {
      ok: true,
      output: {
        datasetId: datasetRow.id,
        datasetName: datasetRow.name,
        splitId: null,
        splitName: null,
      },
    };
  }

  const split = datasetRow.splits.find(
    (candidate) => candidate.name === input.splitName
  );
  if (!split) {
    return {
      ok: false,
      error: `Dataset "${datasetRow.name}" has no split named "${input.splitName}".`,
    };
  }

  let splitExampleCount: number;
  try {
    splitExampleCount = await fetchDatasetExampleCount({
      datasetId: datasetRow.id,
      splitIds: [split.id],
    });
  } catch (error) {
    return { ok: false, error: getResolveFailureMessage(error) };
  }
  if (splitExampleCount <= 0) {
    return {
      ok: false,
      error: `Split "${split.name}" in dataset "${datasetRow.name}" has no examples to load.`,
    };
  }

  return {
    ok: true,
    output: {
      datasetId: datasetRow.id,
      datasetName: datasetRow.name,
      splitId: split.id,
      splitName: split.name,
    },
  };
}

async function resolveDatasetRowByName(
  name: string
): Promise<ResolvedDatasetRow | null> {
  const data = await fetchQuery<loadPlaygroundDatasetResolveQuery>(
    RelayEnvironment,
    resolveDatasetQuery,
    { name, first: DATASET_RESOLVE_PAGE_SIZE }
  ).toPromise();
  const edges = data?.datasets.edges ?? [];
  const exactMatches = edges
    .map((edge) => edge.node)
    .filter((node) => node.name === name);
  if (exactMatches.length === 0) {
    if (edges.length >= DATASET_RESOLVE_PAGE_SIZE) {
      throw new Error(
        `Too many datasets match "${name}" to resolve an exact name; rename the dataset or use a more specific name.`
      );
    }
    return null;
  }
  // Dataset names are unique, so an exact-name match is singular.
  return {
    id: exactMatches[0]!.id,
    name: exactMatches[0]!.name,
    exampleCount: exactMatches[0]!.exampleCount,
    splits: exactMatches[0]!.splits.map((split) => ({
      id: split.id,
      name: split.name,
    })),
  };
}

async function fetchDatasetExampleCount({
  datasetId,
  splitIds,
}: {
  datasetId: string;
  splitIds: string[];
}): Promise<number> {
  const data = await fetchQuery<loadPlaygroundDatasetExampleCountQuery>(
    RelayEnvironment,
    datasetExampleCountQuery,
    { id: datasetId, splitIds }
  ).toPromise();
  return data?.node?.exampleCount ?? 0;
}

function getResolveFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to resolve dataset.";
}

export function buildDatasetSelectionSnapshot(
  target: ResolvedDatasetTarget
): DatasetSelectionSnapshot {
  return {
    datasetId: target.datasetId,
    splitIds: target.splitId != null ? [target.splitId] : [],
    datasetName: target.datasetName,
    ...(target.splitName != null ? { splitNames: [target.splitName] } : {}),
  };
}

export function buildSelectionRevision(selection: ExpectedSelection): string {
  const serialized = JSON.stringify({
    datasetId: selection.datasetId,
    // Sorted so the revision is order-independent.
    splitIds: [...selection.splitIds].sort(),
  });
  let hash = 5381;
  for (let index = 0; index < serialized.length; index++) {
    hash = (hash * 33) ^ serialized.charCodeAt(index);
  }
  return `load-dataset-${(hash >>> 0).toString(16)}`;
}
