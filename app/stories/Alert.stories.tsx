import type { Meta, StoryObj } from "@storybook/react";

import { Alert, Button, Icon, Icons } from "@phoenix/components";

const meta: Meta<typeof Alert> = {
  title: "Alert",
  component: Alert,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
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

export const CustomIcon: Story = {
  args: {
    variant: "info",
    children: "This is an alert with a custom icon",
    icon: <Icon svg={<Icons.ArrowBack />} />,
  },
};

export const WithoutIcon: Story = {
  args: {
    variant: "info",
    children: "This is an alert without an icon",
    showIcon: false,
  },
};
