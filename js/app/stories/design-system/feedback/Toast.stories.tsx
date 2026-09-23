import type { Decorator, Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import type { QueuedToast } from "react-aria-components";

import { Button, Flex, Toast } from "@phoenix/components";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import type { NotificationParams } from "@phoenix/contexts";
import { useNotify, useNotifySuccess } from "@phoenix/contexts";

/**
 * Toast is a single transient notification. The first stories render one
 * `Toast` per variant; `Region` renders `ToastRegion`, which displays and
 * stacks the toasts queued through `useNotify` and `useNotifySuccess`, the
 * way the app raises them.
 */
const meta: Meta = {
  title: "Design System/Feedback/Toast",
  tags: ["legacy", "unreviewed"],
  component: Toast,
  parameters: {
    layout: "centered",
  },
};

export default meta;

/**
 * A single Toast positions itself absolutely within the toast region.
 * Provide a relatively-positioned, region-sized container so it renders the
 * way it would inside `ToastRegion`. Applied per story rather than on the
 * meta, because `ToastRegion` is itself absolutely positioned and must not be
 * anchored to this container.
 */
const toastFrame: Decorator = (Story) => (
  <div style={{ position: "relative", width: 400, minHeight: 96 }}>
    <Story />
  </div>
);

const defaultToast: QueuedToast<NotificationParams> = {
  key: "default",
  content: {
    title: "Default Toast",
    message: "This is a default toast message.",
  },
};

/**
 * Default toasts use neutral styling for general notifications.
 */
export const Default = {
  decorators: [toastFrame],
  args: {
    toast: {
      key: "default",
      content: {
        title: "Default Toast",
        message: "This is a default toast message.",
      },
    },
  },
};

/**
 * Success toasts use green to confirm positive outcomes.
 * Use for: saved changes, completed actions, successful operations.
 */
export const Success = {
  decorators: [toastFrame],
  args: {
    toast: {
      ...defaultToast,
      content: {
        ...defaultToast.content,
        title: "Success Toast",
        message: "This is a success toast message.",
        variant: "success",
      },
    },
  },
};

/**
 * Error toasts use red to convey failures or critical issues.
 * Use for: failed operations, network errors, permission denied.
 */
export const Error = {
  decorators: [toastFrame],
  args: {
    toast: {
      ...defaultToast,
      content: {
        ...defaultToast.content,
        title: "Error Toast",
        message: "This is an error toast message.",
        variant: "error",
      },
    },
  },
};

/**
 * Toasts can include an action button for quick follow-up.
 */
export const WithAction = {
  decorators: [toastFrame],
  args: {
    toast: {
      ...defaultToast,
      content: {
        ...defaultToast.content,
        title: "Action Toast",
        message: "This is an action toast message.",
        action: {
          text: "Action",
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log("Action clicked");
          },
        },
      },
    },
  },
};

const TriggerToasts = () => {
  const notify = useNotify();
  const notifySuccess = useNotifySuccess();
  return (
    <Flex direction="column" gap="size-100">
      <Button
        onPress={() => {
          notify({
            title: "Default Toast",
            expireMs: null,
          });
        }}
      >
        Default Toast
      </Button>
      <Button
        onPress={() =>
          notifySuccess({
            title: "Success Toast",
            message: "This is a success toast message.",
            expireMs: null,
          })
        }
      >
        Success Toast
      </Button>
      <Button
        onPress={() =>
          notify({
            title: "Error Toast",
            message: "This is an error toast message.",
            expireMs: null,
          })
        }
      >
        Error Toast
      </Button>
      <Button
        onPress={() =>
          notifySuccess({
            title: "Expiring Toast",
            message: "This toast will expire soon.",
            expireMs: 3000,
          })
        }
      >
        Expiring Toast
      </Button>
      <Button
        onPress={() =>
          notifySuccess({
            title: "Action Toast",
            message:
              "This toast requires user action. It will close 1 second after interaction.",
            action: {
              // Manually close the toast later
              closeOnClick: false,
              text: "Interact",
              onClick: (close) => {
                // Handle interact action
                alert("Interact action triggered");
                setTimeout(() => {
                  close();
                }, 1000);
              },
            },
            expireMs: null,
          })
        }
      >
        Action Toast
      </Button>
    </Flex>
  );
};

/**
 * ToastRegion manages the display of one or more queued toasts. Press a
 * button to queue a toast of that kind.
 */
export const Region: StoryFn<ComponentProps<typeof ToastRegion>> = () => (
  <>
    <ToastRegion />
    <TriggerToasts />
  </>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  ...Success,
  tags: ["!dev", "!autodocs"],
  // `toastFrame`, carried over from `Success`, hosts the toast at the region's 400px width.
  parameters: { thumbnail: { scale: 0.75 } },
};
