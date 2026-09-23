import type { Meta, StoryObj } from "@storybook/react";

import { Alert, Button, Icon, Icons } from "@phoenix/components";

const meta: Meta<typeof Alert> = {
  title: "Design System/Feedback/Alert",
  component: Alert,
  parameters: {
    inset: true,
    width: "intrinsic",
  },
  tags: ["legacy", "unreviewed"],
};

export default meta;
type Story = StoryObj<typeof Alert>;

/**
 * Informative alerts use blue to convey neutral or contextual information.
 * Use for: tips, onboarding hints, general notices.
 */
export const Info: Story = {
  args: {
    variant: "info",
    children: "This is an info alert",
  },
};

/**
 * Success alerts use green to convey positive outcomes.
 * Use for: completed actions, saved changes, successful operations.
 */
export const Success: Story = {
  args: {
    variant: "success",
    children: "This is a success alert",
  },
};

/**
 * Warning alerts use orange to convey caution or pending action.
 * Use for: degraded state, approaching limits, non-blocking issues.
 */
export const Warning: Story = {
  args: {
    variant: "warning",
    children: "This is a warning alert",
  },
};

/**
 * Danger alerts use red to convey errors or critical states.
 * Use for: failed operations, blocking errors, destructive confirmations.
 */
export const Danger: Story = {
  args: {
    variant: "danger",
    children: "This is a danger alert",
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
    inset: false,
    width: "fill",
    themeLayout: "column",
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
    icon: <Icon svg={<Icons.ArrowLeft />} />,
  },
};

export const WithoutIcon: Story = {
  args: {
    variant: "info",
    children: "This is an alert without an icon",
    showIcon: false,
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
      }}
    >
      <Alert variant="info" title="Alert Title">
        This is an alert with a title
      </Alert>
      <Alert variant="danger">This is a danger alert</Alert>
    </div>
  ),
};
