import type { Meta } from "@storybook/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  PageHeader,
  Token,
} from "@phoenix/components";

const meta: Meta = {
  title: "Core/Layout/Page Header",
  component: PageHeader,
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    title: {
      control: "text",
      description: "The title of the page header (string or ReactNode)",
    },
    subTitle: {
      control: "text",
      description: "Optional subtitle displayed below the title",
    },
    extra: {
      control: false,
      description: "Additional content displayed on the right side",
    },
  },
};

export default meta;

export const Default = {
  args: {
    title: "Page Title",
  },
};

export const WithSubtitle = {
  args: {
    title: "Support",
    subTitle:
      "We are here to help. Pick a channel below to get in touch with us.",
  },
};

export const WithActions = {
  args: {
    title: "Dashboards",
    extra: (
      <Button
        variant="primary"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
      >
        Create Dashboard
      </Button>
    ),
  },
};

export const WithMultipleActions = {
  args: {
    title: "Playground",
    extra: (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Button>Settings</Button>
        <Button variant="primary">Run</Button>
      </Flex>
    ),
  },
};

export const Complete = {
  args: {
    title: "Experiments",
    subTitle: "Run and compare experiments on your datasets",
    extra: (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Button leadingVisual={<Icon svg={<Icons.DownloadOutline />} />} />
        <Button variant="primary">Run Experiment</Button>
      </Flex>
    ),
  },
};

export const CustomTitleContent = {
  render: () => (
    <PageHeader
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          My Dataset
          <Token color="var(--global-color-primary)">production</Token>
          <Token color="var(--global-color-yellow-500)">v2.1</Token>
        </Flex>
      }
      subTitle="A dataset for training and evaluation"
      extra={<Button variant="primary">Run Experiment</Button>}
    />
  ),

  parameters: {
    docs: {
      description: {
        story:
          "When passing a ReactNode as the title, it renders as-is without wrapping in a Heading component.",
      },
    },
  },
};
