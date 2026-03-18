import { useEffect } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { isFullStoryEnabled, setIdentity } from "@phoenix/analytics/fullstory";
import { AgentChatWidget } from "@phoenix/components/agent";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ViewerProvider } from "@phoenix/contexts/ViewerContext";
import type { AuthenticatedRootLoaderDataResolved } from "@phoenix/pages/authenticatedRootLoader";
import { authenticatedRootLoaderQuery } from "@phoenix/pages/authenticatedRootLoader";

import type { authenticatedRootLoaderQuery as AuthenticatedRootLoaderQueryType } from "./__generated__/authenticatedRootLoaderQuery.graphql";
import { AppAlerts } from "./AppAlerts";

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  // Redirects are handled by React Router before the component mounts, so the
  // loader data here is always the non-redirect branch.
  const loaderData = useLoaderData<AuthenticatedRootLoaderDataResolved>();
  invariant(loaderData, "loaderData is required");

  const queryData = usePreloadedQuery<AuthenticatedRootLoaderQueryType>(
    authenticatedRootLoaderQuery,
    loaderData.queryRef
  );

  // Set analytics if enabled
  useEffect(() => {
    // Double check that there is a viewer and that FullStory is enabled
    if (isFullStoryEnabled() && loaderData.viewer) {
      setIdentity({
        uid: loaderData.viewer.id,
        displayName: loaderData.viewer.username,
        email: loaderData.viewer.email,
      });
    }
  }, [loaderData]);

  return (
    <ViewerProvider query={queryData}>
      <AgentProvider>
        <AgentChatWidget />
        <AppAlerts />
        <Outlet />
      </AgentProvider>
    </ViewerProvider>
  );
}
