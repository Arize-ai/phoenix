import { Meta, StoryFn } from "@storybook/react";
import { Button, Flex, ToastRegion } from "@phoenix/components";
import { ComponentProps } from "react";
import {
  NotificationProvider,
  useNotifyError,
  useNotifySuccess,
} from "@phoenix/contexts";

/**
 * ToastRegion manages the display of one or more queued toasts
 */
const meta: Meta = {
  title: "ToastRegion",
  component: ToastRegion,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const TriggerToasts = () => {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  return (
    <Flex direction="column" gap="size-100">
      <Button
        onClick={() =>
          notifySuccess({
            title: "Success Toast",
            message: "This is a success toast message.",
          })
        }
      >
        Success Toast
      </Button>
      <Button
        onClick={() =>
          notifyError({
            title: "Error Toast",
            message: "This is an error toast message.",
          })
        }
      >
        Error Toast
      </Button>
      <Button
        onClick={() =>
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
        onClick={() =>
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
          })
        }
      >
        Action Toast
      </Button>
    </Flex>
  );
};

export const Template: StoryFn<ComponentProps<typeof ToastRegion>> = (args) => (
  <NotificationProvider>
    <TriggerToasts />
  </NotificationProvider>
);
