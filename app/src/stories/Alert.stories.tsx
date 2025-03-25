import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "@phoenix/components/alert";
import { Button } from "@phoenix/components/button";

const meta: Meta<typeof Alert> = {
  title: "Alert",
  component: Alert,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: {
        type: "select",
        options: ["info", "warning", "danger", "success"],
      },
      description: "The severity level of the alert",
      table: {
        defaultValue: { summary: "info" },
      },
    },
    title: {
      control: { type: "text" },
      description: "Optional title of the alert",
    },
    icon: {
      control: { type: "text" },
      description: "A custom icon to show",
    },
    showIcon: {
      control: { type: "boolean" },
      description: "Whether or not an icon is shown on the left",
    },
    dismissable: {
      control: { type: "boolean" },
      description: "If set to true, a close button is rendered",
    },
    banner: {
      control: { type: "boolean" },
      description:
        "If set to true, this alert is being placed at the top of a page",
    },
    extra: {
      control: { type: "object" },
      description: "Extra content (typically a button) added to the alert",
    },
    children: {
      control: { type: "text" },
      description: "The content of the alert",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: "info",
    children: "This is an info alert",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "This is a warning alert",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "This is a danger alert",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    children: "This is a success alert",
  },
};

export const WithTitle: Story = {
  args: {
    variant: "info",
    title: "Alert Title",
    children: "This is an alert with a title",
  },
};

export const Dismissable: Story = {
  args: {
    variant: "info",
    children: "This is a dismissable alert",
    dismissable: true,
    onDismissClick: () => {},
  },
};

export const Banner: Story = {
  args: {
    variant: "info",
    children: "This is a banner alert",
    banner: true,
  },
  parameters: {
    layout: "fullscreen",
  },
};

export const WithExtraContent: Story = {
  args: {
    variant: "info",
    children: "This is an alert with extra content",
    extra: <Button size="S">Action</Button>,
  },
};

export const WithoutIcon: Story = {
  args: {
    variant: "info",
    children: "This is an alert without an icon",
    showIcon: false,
  },
};
