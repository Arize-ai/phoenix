import { useEffect } from "react";
import { graphql, useFragment, usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";

import { isFullStoryEnabled, setIdentity } from "@phoenix/analytics/fullstory";
import { AgentChatWidget } from "@phoenix/components/agent";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ViewerProvider } from "@phoenix/contexts/ViewerContext";
import type { AuthenticatedRootLoaderData } from "@phoenix/pages/authenticatedRootLoader";
import { authenticatedRootLoaderQuery } from "@phoenix/pages/authenticatedRootLoader";

import type { AuthenticatedRoot_viewer$key } from "./__generated__/AuthenticatedRoot_viewer.graphql";
import type { authenticatedRootLoaderQuery as AuthenticatedRootLoaderQueryType } from "./__generated__/authenticatedRootLoaderQuery.graphql";
import { AppAlerts } from "./AppAlerts";

function FullStoryIdentifier({
  query,
}: {
  query: AuthenticatedRoot_viewer$key;
}) {
  const { viewer } = useFragment(
    graphql`
      fragment AuthenticatedRoot_viewer on Query {
        viewer {
          id
          username
          email
        }
      }
    `,
    query
  );
  useEffect(() => {
    if (isFullStoryEnabled() && viewer) {
      setIdentity({
        uid: viewer.id,
        displayName: viewer.username,
        email: viewer.email,
      });
    }
  }, [viewer]);
  return null;
}

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  const loaderData = useLoaderData<AuthenticatedRootLoaderData>();
  const queryData = usePreloadedQuery<AuthenticatedRootLoaderQueryType>(
    authenticatedRootLoaderQuery,
    loaderData.queryRef
  );

  return (
    <ViewerProvider query={queryData}>
      <FullStoryIdentifier query={queryData} />
      <AgentProvider>
        <AgentChatWidget />
        <AppAlerts />
        <Outlet />
      </AgentProvider>
    </ViewerProvider>
  );
}
