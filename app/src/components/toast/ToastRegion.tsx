import { UNSTABLE_ToastRegion as AriaToastRegion } from "react-aria-components";

import { toastRegionCss } from "@phoenix/components/toast/styles";
import { toastQueue } from "@phoenix/contexts/NotificationContext";

import { Toast } from "./Toast";

export const ToastRegion = () => {
  return (
    <AriaToastRegion
      queue={toastQueue}
      css={toastRegionCss}
      className="react-aria-ToastRegion"
    >
      {({ toast }) => {
        return <Toast toast={toast} />;
      }}
    </AriaToastRegion>
  );
};
