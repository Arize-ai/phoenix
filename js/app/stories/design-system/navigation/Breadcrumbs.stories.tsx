import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";

const meta: Meta<typeof Breadcrumbs> = {
  title: "Design System/Navigation/Breadcrumbs",
  component: Breadcrumbs,
  parameters: {
    layout: "centered",
  },
  tags: ["legacy", "unreviewed"],
  argTypes: {
    size: {
      control: "select",
      options: ["S", "M", "L"],
      description: "The size of the breadcrumb text and separator spacing",
      defaultValue: "M",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "M",
  },
  render: (args) => (
    <Breadcrumbs
      {...args}
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
  args: {
    size: "M",
  },
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumb>Home</Breadcrumb>
      <Breadcrumb>Dashboard</Breadcrumb>
      <Breadcrumb>Current Page</Breadcrumb>
    </Breadcrumbs>
  ),
};

export const SingleItem: Story = {
  args: {
    size: "M",
  },
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumb>Home</Breadcrumb>
    </Breadcrumbs>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  ...WithoutAction,
  tags: ["!dev", "!autodocs"],
};
