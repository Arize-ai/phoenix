import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { isFullStoryEnabled, setItentity } from "@phoenix/analytics/fullstory";
import { ViewerProvider } from "@phoenix/contexts/ViewerContext";
import { authenticatedRootLoader } from "@phoenix/pages/authenticatedRootLoader";

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  const loaderData = useLoaderData<typeof authenticatedRootLoader>();
  invariant(loaderData, "loaderData is required");

  // Set analytics if enabled
  useEffect(() => {
    // Double check that there is a viewer and that FullStory is enabled
    if (isFullStoryEnabled() && loaderData.viewer) {
      setItentity({
        uid: loaderData.viewer.id,
        displayName: loaderData.viewer.username,
        email: loaderData.viewer.email,
      });
    }
  }, [loaderData]);

  return (
    <ViewerProvider query={loaderData}>
      <Outlet />
    </ViewerProvider>
  );
}
