import { css } from "@emotion/react";
import { Suspense } from "react";

import { APP_NOTIFICATION_Z_INDEX } from "@phoenix/components/core/zIndex";

import { StorageAlert } from "./StorageAlert";

const alertsContainerCSS = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${APP_NOTIFICATION_Z_INDEX};
`;

export function AppAlerts() {
  // Currently we only show storage alerts. So
  const shouldMountAlerts = window.Config.hasDbThreshold;
  // Wrap in it's on suspense boundary so as to avoid delaying the rendering of the app
  return (
    <div css={alertsContainerCSS}>
      <Suspense fallback={null}>
        {shouldMountAlerts && <StorageAlert />}
      </Suspense>
    </div>
  );
}
