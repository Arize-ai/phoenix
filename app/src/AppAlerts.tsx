import { Suspense } from "react";

import { StorageAlert } from "./StorageAlert";

export function AppAlerts() {
  // Currently we only show storage alerts. So
  const shouldMountAlerts = window.Config.hasDbThreshold;
  // Wrap in it's on suspense boundary so as to avoid delaying the rendering of the app
  return (
    <Suspense fallback={null}>{shouldMountAlerts && <StorageAlert />}</Suspense>
  );
}
