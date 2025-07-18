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
    <Breadcrumbs
      onAction={() => {
        /* Handle breadcrumb click */
      }}
    >
      <Breadcrumb>Home</Breadcrumb>
      <Breadcrumb>Dashboard</Breadcrumb>
      <Breadcrumb>Projects</Breadcrumb>
      <Breadcrumb>Current Project</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb>Home</Breadcrumb>
      <Breadcrumb>Dashboard</Breadcrumb>
      <Breadcrumb>Current Page</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumbs>
      <Breadcrumb>Home</Breadcrumb>
    </Breadcrumbs>
  ),
};
