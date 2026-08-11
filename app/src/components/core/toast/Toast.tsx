import { css } from "@emotion/react";
import { useContext } from "react";
import type { QueuedToast } from "react-aria-components";
import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastStateContext as ToastStateContext,
} from "react-aria-components";

import { Button, IconButton } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { toastCSS } from "@phoenix/components/core/toast/styles";
import { ToastPositioner } from "@phoenix/components/core/toast/ToastPositioner";
import {
  type NotificationParams,
  toastQueue,
} from "@phoenix/contexts/NotificationContext";
import { useTheme } from "@phoenix/contexts/ThemeContext";

const iconFromVariant = (
  variant: "success" | "error" | "default" | undefined
) => {
  switch (variant) {
    case "success":
      return <Icon svg={<Icons.CheckmarkCircleFilled />} />;
    case "error":
      return <Icon svg={<Icons.AlertCircleFilled />} />;
    default:
      return null;
  }
};

const colorFromVariant = (
  variant: "success" | "error" | "default" | undefined
) => {
  switch (variant) {
    case "success":
      return "var(--global-color-success)";
    case "error":
      return "var(--global-color-danger)";
    default:
      return "var(--global-color-gray-600)";
  }
};

export const Toast = <T extends QueuedToast<NotificationParams>>({
  toast,
}: {
  toast: T;
}) => {
  const { theme } = useTheme();
  const state = useContext(ToastStateContext);
  // 0 = front / newest toast in the stack.
  const stackIndex = Math.max(
    0,
    state?.visibleToasts.findIndex((t) => t.key === toast.key) ?? 0
  );
  const icon = iconFromVariant(toast.content.variant);
  return (
    <ToastPositioner stackIndex={stackIndex}>
      <AriaToast
        toast={toast}
        css={toastCSS}
        className="react-aria-Toast"
        style={{
          // @ts-expect-error incorrect react types
          "--internal-token-color": colorFromVariant(toast.content.variant),
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
            <Text slot="title" size="M">
              {icon}
              {toast.content.title}
            </Text>
            <Text slot="description">{toast.content.message}</Text>
          </AriaToastContent>
          <IconButton
            slot="close"
            size="S"
            color="inherit"
            type="button"
            aria-label="Close notification"
          >
            <Icon svg={<Icons.Close />} />
          </IconButton>
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
                      toastQueue?.close(toast.key);
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
    </ToastPositioner>
  );
};
