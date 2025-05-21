import { PropsWithChildren, ReactNode } from "react";

import {
  useViewer,
  useViewerCanManageRetentionPolicy,
} from "@phoenix/contexts";

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

/**
 * Users can access retention policy settings if:
 * - Authentication is disabled
 * - Authentication is enabled and the user is an admin
 */
export function CanManageRetentionPolicy(
  props: PropsWithChildren<AuthGuardProps>
) {
  const { fallback = null, children } = props;
  const canManageRetentionPolicy = useViewerCanManageRetentionPolicy();
  if (!canManageRetentionPolicy) {
    return <>{fallback}</>;
  }
  return children;
}
