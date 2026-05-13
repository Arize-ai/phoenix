import { fetchQuery, graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { ROOT_ID } from "relay-runtime";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetEvaluatorDetailsLoaderQuery } from "./__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";

export const datasetEvaluatorDetailsLoaderGQL = graphql`
  query datasetEvaluatorDetailsLoaderQuery(
    $datasetId: ID!
    $datasetEvaluatorId: ID!
    $timeRange: TimeRange
    $orphanSpanAsRootSpan: Boolean!
    $canManageSandboxes: Boolean!
  ) {
    dataset: node(id: $datasetId) {
      id
      ... on Dataset {
        id
        datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
          id
          name
          description
          evaluator {
            __typename
            kind
            description
            ... on CodeEvaluator {
              versionCount
            }
          }
          project {
            id
            ...DatasetEvaluatorSpans_project
          }
          ...BuiltInDatasetEvaluatorDetails_datasetEvaluator
          ...CodeDatasetEvaluatorDetails_datasetEvaluator
            @arguments(canManageSandboxes: $canManageSandboxes)
          ...LLMDatasetEvaluatorDetails_datasetEvaluator
        }
      }
    }
    sandboxBackends @include(if: $canManageSandboxes) {
      backendType
      displayName
      supportsEnvVars
      internetAccess
      dependenciesLanguage
    }
  }
`;

/**
 * Mirror of `useViewerCanManageSandboxes()` for use outside React contexts
 * (e.g. React Router loaders). Reads the cached viewer record from the Relay
 * store and returns true when the viewer is an admin or when auth is disabled
 * (no viewer record). This is the loader-side gate that ensures the page's
 * top-level query never asks the server for admin-only `sandboxBackends` from
 * a non-admin viewer, which would otherwise crash the page load.
 */
function readCanManageSandboxesFromStore(): boolean {
  const source = RelayEnvironment.getStore().getSource();
  const root = source.get(ROOT_ID);
  if (root == null) {
    // Root record not populated yet (very-first-load before the auth
    // bootstrap query has run). Default to non-admin so the loader does
    // NOT ask the server for admin-gated `sandboxBackends` from a viewer
    // we cannot yet confirm is admin — a non-admin cold-cache hard
    // refresh would otherwise reintroduce the fatal Unauthorized page
    // load that the `@include(if: $canManageSandboxes)` gates exist to
    // prevent. Trade-off: an admin's very-first-load briefly renders the
    // "admin only" affordance until the next render after the viewer is
    // cached — a single-frame UX cost paid for the safe default.
    return false;
  }
  const viewerLink = (root as Record<string, unknown>)["viewer"] as
    | { __ref?: string }
    | null
    | undefined;
  const viewerId = viewerLink?.__ref;
  if (viewerId == null) {
    // Auth disabled: no viewer record means everyone is admin-equivalent,
    // matching `useViewerCanManageSandboxes()`.
    return true;
  }
  const viewer = source.get(viewerId);
  if (viewer == null) {
    return true;
  }
  const roleLink = (viewer as Record<string, unknown>)["role"] as
    | { __ref?: string }
    | null
    | undefined;
  const roleId = roleLink?.__ref;
  if (roleId == null) {
    return false;
  }
  const role = source.get(roleId);
  const roleName =
    role == null ? undefined : (role as Record<string, unknown>)["name"];
  return roleName === "ADMIN";
}

export type DatasetEvaluatorDetailsLoaderData = Awaited<
  ReturnType<typeof datasetEvaluatorDetailsLoader>
>;

/**
 * Loads the data required for the dataset evaluator details page
 */
export async function datasetEvaluatorDetailsLoader(
  args: LoaderFunctionArgs
): Promise<{
  queryRef: ReturnType<typeof loadQuery<datasetEvaluatorDetailsLoaderQuery>>;
  evaluatorDisplayName: string | null;
  projectId: string | null;
}> {
  const { datasetId, evaluatorId } = args.params;
  invariant(datasetId, "datasetId is required");
  invariant(evaluatorId, "evaluatorId is required");

  const canManageSandboxes = readCanManageSandboxesFromStore();
  const variables = {
    datasetId,
    datasetEvaluatorId: evaluatorId,
    orphanSpanAsRootSpan: true,
    canManageSandboxes,
  };

  const data = await fetchQuery<datasetEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorDetailsLoaderGQL,
    variables
  ).toPromise();

  const queryRef = loadQuery<datasetEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    datasetEvaluatorDetailsLoaderGQL,
    variables
  );

  const evaluatorDisplayName = data?.dataset?.datasetEvaluator?.name ?? null;

  const projectId = data?.dataset?.datasetEvaluator?.project?.id ?? null;

  return {
    queryRef,
    evaluatorDisplayName,
    projectId,
  };
}
