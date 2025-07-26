import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";

const meta: Meta<typeof Breadcrumbs> = {
  title: "Breadcrumbs",
  component: Breadcrumbs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
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
