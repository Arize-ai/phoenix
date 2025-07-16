import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumbs, Item } from "@phoenix/components";

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
      <Item>Home</Item>
      <Item>Dashboard</Item>
      <Item>Projects</Item>
      <Item>Current Project</Item>
    </Breadcrumbs>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <Breadcrumbs>
      <Item>Home</Item>
      <Item>Dashboard</Item>
      <Item>Current Page</Item>
    </Breadcrumbs>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumbs>
      <Item>Home</Item>
    </Breadcrumbs>
  ),
};

export const LongPath: Story = {
  render: () => (
    <Breadcrumbs onAction={() => {/* Handle breadcrumb click */}}>
      <Item>Root</Item>
      <Item>Organization</Item>
      <Item>Department</Item>
      <Item>Team</Item>
      <Item>Project</Item>
      <Item>Sub Project</Item>
      <Item>Current Location</Item>
    </Breadcrumbs>
  ),
}; 