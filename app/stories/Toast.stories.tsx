import type { Meta, StoryFn } from "@storybook/react";
import type { ComponentProps } from "react";
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

export const SuccessToast = {
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

export const ErrorToast = {
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

export const ActionToast = {
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
