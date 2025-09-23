import {
  QueuedToast,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue as AriaToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Button } from "@phoenix/components/button";
import { Text } from "@phoenix/components/content";
import { Icon, Icons } from "@phoenix/components/icon";
import { toastCss, toastRegionCss } from "@phoenix/components/toast/styles";
import { NotificationParams, useTheme } from "@phoenix/contexts";

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

const colorFromVariant = (
  variant: "success" | "error" | "default" | undefined
) => {
  switch (variant) {
    case "success":
      return "var(--ac-global-color-success)";
    case "error":
      return "var(--ac-global-color-danger)";
    default:
      return "var(--ac-global-background-color-dark)";
  }
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
  const { theme } = useTheme();
  return (
    <AriaToast
      toast={toast}
      css={toastCss}
      className="react-aria-Toast"
      style={{
        viewTransitionName: toast.key,
        // @ts-expect-error incorrect react types
        "--ac-internal-token-color": colorFromVariant(toast.content.variant),
      }}
      data-variant={toast.content.variant}
      data-theme={theme}
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
