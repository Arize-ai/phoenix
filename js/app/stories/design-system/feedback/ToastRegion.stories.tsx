import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { useEffect } from "react";

import { Button, Flex } from "@phoenix/components";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import { toastQueue, useNotify, useNotifySuccess } from "@phoenix/contexts";

/**
 * ToastRegion manages the display of one or more queued toasts
 */
const meta: Meta = {
  title: "Design System/Feedback/Toast Region",
  tags: ["legacy", "unreviewed"],
  component: ToastRegion,
  parameters: {
    layout: "centered",
  },
};

export default meta;

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

export const Template: StoryFn<ComponentProps<typeof ToastRegion>> = () => (
  <>
    <ToastRegion />
    <TriggerToasts />
  </>
);

/** Queues a stack of toasts on mount, as the app does after an action. */
const QueuedToasts = () => {
  const notify = useNotify();
  const notifySuccess = useNotifySuccess();
  useEffect(() => {
    const keys = [
      notify({
        title: "Error Toast",
        message: "This is an error toast message.",
        expireMs: null,
      }),
      notifySuccess({
        title: "Success Toast",
        message: "This is a success toast message.",
        expireMs: null,
      }),
    ];
    return () => keys.forEach((key) => toastQueue.close(key));
  }, [notify, notifySuccess]);
  return null;
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <>
      <ToastRegion />
      <QueuedToasts />
    </>
  ),
};
