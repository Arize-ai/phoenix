import React, { startTransition, useCallback } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import type {
  ViewerContext_viewer$data,
  ViewerContext_viewer$key,
} from "./__generated__/ViewerContext_viewer.graphql";

export type ViewerContextType = {
  viewer: ViewerContext_viewer$data["viewer"];
  refetchViewer: () => void;
};

export const ViewerContext = React.createContext<ViewerContextType>({
  viewer: null,
  refetchViewer: () => {},
});

export function useViewer() {
  const context = React.useContext(ViewerContext);
  if (context == null) {
    throw new Error("useViewer must be used within a ViewerProvider");
  }
  return context;
}

/**
 * Returns true if the viewer can modify entities in the application
 */
export function useViewerCanModify() {
  const { viewer } = useViewer();
  if (viewer && viewer.role.name === "VIEWER") {
    return false;
  }
  return true;
}

/**
 * Returns true if the viewer is an admin.
 * Note: when the app is not configured with auth, we assume the user is an admin
 * (matching IsAdminIfAuthEnabled server-side)
 */
export function useIsAdmin() {
  const { viewer } = useViewer();
  return !viewer || viewer.role?.name === "ADMIN";
}

/**
 * Returns true if the viewer can manage retention policies
 */
export function useViewerCanManageRetentionPolicy() {
  return useIsAdmin();
}

/**
 * Returns true if the viewer can manage sandboxes
 */
export function useViewerCanManageSandboxes() {
  return useIsAdmin();
}

/**
 * Returns true if the viewer can manage secrets
 */
export function useViewerCanManageSecrets() {
  return useIsAdmin();
}

/**
 * Returns true if the viewer should be shown platform version update notices
 */
export function useViewerCanSeeVersionUpdates() {
  return useIsAdmin();
}

/**
 * Returns true if the viewer can bulk-delete a project's annotations
 */
export function useViewerCanDeleteProjectAnnotations() {
  return useIsAdmin();
}

export function ViewerProvider({
  query,
  children,
}: React.PropsWithChildren<{
  query: ViewerContext_viewer$key;
}>) {
  const [data, _refetch] = useRefetchableFragment(
    graphql`
      fragment ViewerContext_viewer on Query
      @refetchable(queryName: "ViewerContextRefetchQuery") {
        viewer {
          id
          username
          email
          profilePictureUrl
          isManagementUser
          role {
            name
          }
          authMethod
          ...APIKeysTableFragment
        }
      }
    `,
    query
  );
  const refetchViewer = useCallback(() => {
    startTransition(() => {
      _refetch(
        {},
        {
          fetchPolicy: "network-only",
        }
      );
    });
  }, [_refetch]);
  return (
    <ViewerContext.Provider value={{ viewer: data.viewer, refetchViewer }}>
      {children}
    </ViewerContext.Provider>
  );
}
