import { UNSTABLE_ToastRegion as AriaToastRegion } from "react-aria-components";

import { toastRegionCss } from "@phoenix/components/toast/styles";
import { useNotificationQueue } from "@phoenix/contexts/NotificationContext";

import { Toast } from "./Toast";

export const ToastRegion = () => {
  const queue = useNotificationQueue();
  return (
    <AriaToastRegion
      queue={queue}
      css={toastRegionCss}
      className="react-aria-ToastRegion"
    >
      {({ toast }) => {
        return <Toast toast={toast} queue={queue} />;
      }}
    </AriaToastRegion>
  );
};
