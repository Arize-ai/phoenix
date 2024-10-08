import React, { PropsWithChildren, ReactNode } from "react";

import { useViewer } from "@phoenix/contexts/ViewerContext";

type AuthGuardProps = {
  fallback?: ReactNode;
};
export function IsAuthenticated(props: PropsWithChildren<AuthGuardProps>) {
  const { fallback = null, children } = props;
  const { viewer } = useViewer();
  if (!viewer) {
    return <>{fallback}</>;
  }
  return children;
}

export function IsAdmin(props: PropsWithChildren<AuthGuardProps>) {
  const { fallback = null, children } = props;
  const { viewer } = useViewer();
  // If the viewer is not an admin, show the fallback
  if (!viewer || viewer.role.name !== "ADMIN") {
    return <>{fallback}</>;
  }
  return children;
}
