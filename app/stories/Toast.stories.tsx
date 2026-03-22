import type { Meta } from "@storybook/react";
import type { QueuedToast } from "react-aria-components";

import { Toast } from "@phoenix/components";
import type { NotificationParams } from "@phoenix/contexts";

const meta: Meta = {
  title: "Core/Feedback/Toast",
  component: Toast,
  parameters: {
    layout: "centered",
  },
};

export default meta;

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
