import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { isFullStoryEnabled, setIdentity } from "@phoenix/analytics/fullstory";
import { AgentChatWidget } from "@phoenix/components/agent";
import { AgentChatRuntimeProvider } from "@phoenix/contexts/AgentChatRuntimeContext";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ViewerProvider } from "@phoenix/contexts/ViewerContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { authenticatedRootLoaderQuery } from "@phoenix/pages/__generated__/authenticatedRootLoaderQuery.graphql";
import {
  authenticatedRootLoaderQueryNode,
  type AuthenticatedRootLoaderData,
} from "@phoenix/pages/authenticatedRootLoader";

import { AppAlerts } from "./AppAlerts";

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  const loaderData = useLoaderData<AuthenticatedRootLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<authenticatedRootLoaderQuery>({
    query: authenticatedRootLoaderQueryNode,
    queryRef: loaderData.queryRef,
  });

  // Set analytics if enabled
  useEffect(() => {
    // Double check that there is a viewer and that FullStory is enabled
    if (isFullStoryEnabled() && data.viewer) {
      setIdentity({
        uid: data.viewer.id,
        displayName: data.viewer.username,
        email: data.viewer.email,
      });
    }
  }, [data.viewer]);

  return (
    <ViewerProvider query={data}>
      <AgentProvider agentsConfig={data.agentsConfig}>
        <AgentChatRuntimeProvider>
          <AgentChatWidget />
          <AppAlerts />
          <Outlet />
        </AgentChatRuntimeProvider>
      </AgentProvider>
    </ViewerProvider>
  );
}
