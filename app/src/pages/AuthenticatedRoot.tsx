import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { ViewerProvider } from "@phoenix/contexts/ViewerContext";
import { authenticatedRootLoader } from "@phoenix/pages/authenticatedRootLoader";

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  const loaderData = useLoaderData<typeof authenticatedRootLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <ViewerProvider query={loaderData}>
      <Outlet />
    </ViewerProvider>
  );
}
