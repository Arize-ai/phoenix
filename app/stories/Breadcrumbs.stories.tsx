import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumbs } from "@phoenix/components";

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
      <span>Home</span>
      <span>Dashboard</span>
      <span>Projects</span>
      <span>Current Project</span>
    </Breadcrumbs>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <Breadcrumbs>
      <span>Home</span>
      <span>Dashboard</span>
      <span>Current Page</span>
    </Breadcrumbs>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumbs>
      <span>Home</span>
    </Breadcrumbs>
  ),
};

export const LongPath: Story = {
  render: () => (
    <Breadcrumbs onAction={() => {/* Handle breadcrumb click */}}>
      <span>Root</span>
      <span>Organization</span>
      <span>Team</span>
      <span>Project</span>
      <span>SubProject</span>
      <span>Current Item</span>
    </Breadcrumbs>
  ),
}; 