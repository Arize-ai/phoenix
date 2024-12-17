import React, { startTransition } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import {
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
  const refetchViewer = () => {
    startTransition(() => {
      _refetch(
        {},
        {
          fetchPolicy: "network-only",
        }
      );
    });
  };
  return (
    <ViewerContext.Provider value={{ viewer: data.viewer, refetchViewer }}>
      {children}
    </ViewerContext.Provider>
  );
}
