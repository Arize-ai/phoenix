import { ComponentProps } from "react";
import { QueuedToast } from "react-aria-components";
import { Meta, StoryFn } from "@storybook/react";

import { Toast } from "@phoenix/components";
import { NotificationParams } from "@phoenix/contexts";

const meta: Meta = {
  title: "Toast",
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

const Template: StoryFn<ComponentProps<typeof Toast>> = (args) => (
  <Toast {...args} />
);

/**
 * Toasts are used to display brief messages to the user.
 */
export const Default = Template.bind({});

Default.args = {
  toast: {
    key: "default",
    content: {
      title: "Default Toast",
      message: "This is a default toast message.",
    },
  },
};

/**
 * Use the `variant` prop to change the appearance of the toast
 */
export const SuccessToast = Template.bind({});

SuccessToast.args = {
  toast: {
    ...defaultToast,
    content: {
      ...defaultToast.content,
      title: "Success Toast",
      message: "This is a success toast message.",
      variant: "success",
    },
  },
};

/**
 * Use the `variant` prop to change the appearance of the toast
 */
export const ErrorToast = Template.bind({});

ErrorToast.args = {
  toast: {
    ...defaultToast,
    content: {
      ...defaultToast.content,
      title: "Error Toast",
      message: "This is an error toast message.",
      variant: "error",
    },
  },
};

/**
 * Include an `action` with callback
 */
export const ActionToast = Template.bind({});

ActionToast.args = {
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
};
