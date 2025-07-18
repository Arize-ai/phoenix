import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";

const meta: Meta<typeof Breadcrumbs> = {
  title: "Breadcrumbs",
  component: Breadcrumbs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumbs onAction={() => {/* Handle breadcrumb click */}}>
      <Breadcrumb href="/">Home</Breadcrumb>
      <Breadcrumb href="/dashboard">Dashboard</Breadcrumb>
      <Breadcrumb href="/projects">Projects</Breadcrumb>
      <Breadcrumb isCurrent>Current Project</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb href="/">Home</Breadcrumb>
      <Breadcrumb href="/dashboard">Dashboard</Breadcrumb>
      <Breadcrumb isCurrent>Current Page</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb isCurrent>Home</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const LongPath: Story = {
  render: () => (
    <Breadcrumbs onAction={() => {/* Handle breadcrumb click */}}>
      <Breadcrumb href="/">Root</Breadcrumb>
      <Breadcrumb href="/org">Organization</Breadcrumb>
      <Breadcrumb href="/org/team">Team</Breadcrumb>
      <Breadcrumb href="/org/team/project">Project</Breadcrumb>
      <Breadcrumb href="/org/team/project/sub">SubProject</Breadcrumb>
      <Breadcrumb isCurrent>Current Item</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const WithClickHandlers: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb onPress={() => alert("Home clicked")}>Home</Breadcrumb>
      <Breadcrumb onPress={() => alert("Dashboard clicked")}>Dashboard</Breadcrumb>
      <Breadcrumb isCurrent>Current Page</Breadcrumb>
    </Breadcrumbs>
  ),
}; 