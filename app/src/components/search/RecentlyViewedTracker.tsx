import { useEffect } from "react";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { matchPath, useLocation } from "react-router";

import type { RecentlyViewedResource } from "@phoenix/store/recentlyViewedStore";
import { useRecentlyViewedStore } from "@phoenix/store/recentlyViewedStore";

import type { RecentlyViewedTrackerNodeQuery } from "./__generated__/RecentlyViewedTrackerNodeQuery.graphql";

const nodeQuery = graphql`
  query RecentlyViewedTrackerNodeQuery($id: ID!) {
    node(id: $id) {
      __typename
      id
      ... on Project {
        name
        description
      }
      ... on Dataset {
        name
        description
      }
      ... on Experiment {
        name
        description
      }
      ... on Prompt {
        promptName: name
        description
      }
    }
  }
`;

type EntityNodeFields = {
  name: string;
  description?: string;
};

type EntityRouteMatch = {
  id: string;
  toResource: (node: EntityNodeFields) => RecentlyViewedResource;
};

function experimentResource(
  datasetId: string,
  experimentId: string
): EntityRouteMatch {
  return {
    id: experimentId,
    toResource: ({ name, description }) => ({
      id: experimentId,
      type: "experiment",
      name,
      description,
      path: `/datasets/${datasetId}/compare?experimentId=${experimentId}`,
    }),
  };
}

/**
 * Extracts the most specific entity (project, dataset, experiment, or prompt)
 * from the current location, if any.
 */
function matchEntityRoute(
  pathname: string,
  search: string
): EntityRouteMatch | null {
  const experimentMatch = matchPath(
    { path: "/datasets/:datasetId/experiments/:experimentId", end: false },
    pathname
  );
  if (experimentMatch?.params.experimentId) {
    const { datasetId, experimentId } = experimentMatch.params;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- datasetId is guaranteed present by the matched :datasetId route segment
    return experimentResource(datasetId as string, experimentId);
  }
  // The experiment compare route carries the experiment(s) in the query string,
  // e.g. /datasets/:datasetId/compare?experimentId=Y — record the experiment,
  // not the parent dataset (which the /datasets/:datasetId match below would
  // otherwise capture).
  const compareMatch = matchPath(
    { path: "/datasets/:datasetId/compare", end: false },
    pathname
  );
  if (compareMatch?.params.datasetId) {
    const experimentId = new URLSearchParams(search).get("experimentId");
    return experimentId
      ? experimentResource(compareMatch.params.datasetId, experimentId)
      : null;
  }
  const datasetMatch = matchPath(
    { path: "/datasets/:datasetId", end: false },
    pathname
  );
  if (datasetMatch?.params.datasetId) {
    const { datasetId } = datasetMatch.params;
    return {
      id: datasetId,
      toResource: ({ name, description }) => ({
        id: datasetId,
        type: "dataset",
        name,
        description,
        path: `/datasets/${datasetId}`,
      }),
    };
  }
  const projectMatch = matchPath(
    { path: "/projects/:projectId", end: false },
    pathname
  );
  if (projectMatch?.params.projectId) {
    const { projectId } = projectMatch.params;
    return {
      id: projectId,
      toResource: ({ name, description }) => ({
        id: projectId,
        type: "project",
        name,
        description,
        path: `/projects/${projectId}`,
      }),
    };
  }
  const promptMatch = matchPath(
    { path: "/prompts/:promptId", end: false },
    pathname
  );
  if (promptMatch?.params.promptId) {
    const { promptId } = promptMatch.params;
    return {
      id: promptId,
      toResource: ({ name, description }) => ({
        id: promptId,
        type: "prompt",
        name,
        description,
        path: `/prompts/${promptId}`,
      }),
    };
  }
  return null;
}

/**
 * Watches the current location and records visits to entity pages (projects,
 * datasets, experiments, prompts) in the recently viewed store so they can be
 * surfaced in the search palette. Renders nothing.
 */
export function RecentlyViewedTracker() {
  const { pathname, search } = useLocation();
  const environment = useRelayEnvironment();
  const recordResourceView = useRecentlyViewedStore(
    (state) => state.recordResourceView
  );

  useEffect(() => {
    const match = matchEntityRoute(pathname, search);
    if (!match) {
      return undefined;
    }
    const subscription = fetchQuery<RecentlyViewedTrackerNodeQuery>(
      environment,
      nodeQuery,
      { id: match.id },
      { fetchPolicy: "store-or-network" }
    ).subscribe({
      next: (data) => {
        const node = data.node;
        const name =
          "name" in node && typeof node.name === "string"
            ? node.name
            : "promptName" in node && typeof node.promptName === "string"
              ? node.promptName
              : null;
        const description =
          "description" in node && typeof node.description === "string"
            ? node.description
            : undefined;
        if (name) {
          recordResourceView(match.toResource({ name, description }));
        }
      },
      // A dangling URL (e.g. a deleted entity) is not worth surfacing
      error: () => {},
    });
    return () => subscription.unsubscribe();
  }, [pathname, search, environment, recordResourceView]);

  return null;
}
