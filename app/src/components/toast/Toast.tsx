import { css } from "@emotion/react";
import { Button } from "@phoenix/components/button";
import { Text } from "@phoenix/components/content";
import { Icon, Icons } from "@phoenix/components/icon";
import { toastCss, toastRegionCss } from "@phoenix/components/toast/styles";
import { NotificationParams, useNotificationQueue } from "@phoenix/contexts";
import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastQueue as AriaToastQueue,
  QueuedToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from "react-aria-components";

export const ToastRegion = <Q extends AriaToastQueue<NotificationParams>>({
  queue,
}: {
  queue: Q;
}) => {
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

export const Toast = <
  T extends QueuedToast<NotificationParams>,
  Q extends AriaToastQueue<NotificationParams>,
>({
  toast,
  queue,
}: {
  toast: T;
  queue?: Q;
}) => {
  return (
    <AriaToast
      toast={toast}
      css={toastCss}
      className="react-aria-Toast"
      style={{ viewTransitionName: toast.key }}
      data-variant={toast.content.variant}
    >
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          width: 100%;
        `}
      >
        <AriaToastContent>
          <Text slot="title">
            {toast.content.icon}
            {toast.content.title}
          </Text>
          <Text slot="description">{toast.content.message}</Text>
        </AriaToastContent>
        <Button
          slot="close"
          size="S"
          type="button"
          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
        />
      </div>
      {toast.content.action ? (
        <div className="toast-action-container">
          {typeof toast.content.action === "object" &&
          "text" in toast.content.action ? (
            <Button
              className="toast-action-button"
              onPress={() => {
                const action = toast.content.action;
                if (
                  typeof action === "object" &&
                  action &&
                  "onClick" in action
                ) {
                  // close on click by default
                  const closeOnClick = action.closeOnClick ?? true;
                  const close = () => {
                    queue?.close(toast.key);
                  };
                  // pass close callback to action for manual close ability
                  action.onClick(close);
                  if (closeOnClick) {
                    close();
                  }
                }
              }}
              size="S"
            >
              {toast.content.action.text}
            </Button>
          ) : (
            toast.content.action
          )}
        </div>
      ) : null}
    </AriaToast>
  );
};
