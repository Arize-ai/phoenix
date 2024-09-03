import React from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import {
  ViewerContext_viewer$data,
  ViewerContext_viewer$key,
} from "./__generated__/ViewerContext_viewer.graphql";

export type ViewerContextType = {
  viewer: ViewerContext_viewer$data["viewer"];
};

export const ViewerContext = React.createContext<ViewerContextType>({
  viewer: null,
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
  const [data] = useRefetchableFragment(
    graphql`
      fragment ViewerContext_viewer on Query {
        viewer {
          id
          username
          email
        }
      }
    `,
    query
  );
  return (
    <ViewerContext.Provider value={{ viewer: data.viewer }}>
      {children}
    </ViewerContext.Provider>
  );
}
