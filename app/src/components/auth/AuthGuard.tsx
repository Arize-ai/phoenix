import { PropsWithChildren, ReactNode } from "react";

import {
  useViewer,
  useViewerCanManageRetentionPolicy,
  useViewerCanModify,
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
 * A high order component that checks if the viewer is a viewer role (e.g. not an admin or member)
 */
export function CanModify(props: PropsWithChildren<AuthGuardProps>) {
  const { fallback = null, children } = props;
  const canModify = useViewerCanModify();
  // If the viewer is simply a viewer role (e.g. not an admin or member)
  // Show the fallback
  if (!canModify) {
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
