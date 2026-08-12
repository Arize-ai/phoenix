import type { Meta, StoryFn } from "@storybook/react";
import type { ComponentProps } from "react";

import { Button, Flex } from "@phoenix/components";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import { useNotify, useNotifySuccess } from "@phoenix/contexts";

/**
 * ToastRegion manages the display of one or more queued toasts
 */
const meta: Meta = {
  title: "Core/Feedback/Toast Region",
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
