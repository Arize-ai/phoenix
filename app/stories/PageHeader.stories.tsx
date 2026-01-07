import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  PageHeader,
  PageHeaderProps,
  Token,
} from "@phoenix/components";

const meta: Meta = {
  title: "PageHeader",
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

const Template: StoryFn<PageHeaderProps> = (args) => <PageHeader {...args} />;

/**
 * Basic page header with just a title
 */
export const Default = Template.bind({});

Default.args = {
  title: "Page Title",
};

/**
 * Page header with subtitle
 */
export const WithSubtitle = Template.bind({});

WithSubtitle.args = {
  title: "Support",
  subTitle:
    "We are here to help. Pick a channel below to get in touch with us.",
};

/**
 * Page header with action buttons
 */
export const WithActions = Template.bind({});

WithActions.args = {
  title: "Dashboards",
  extra: (
    <Button
      variant="primary"
      leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
    >
      Create Dashboard
    </Button>
  ),
};

/**
 * Page header with multiple action buttons
 */
export const WithMultipleActions = Template.bind({});

WithMultipleActions.args = {
  title: "Playground",
  extra: (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Button>Settings</Button>
      <Button variant="primary">Run</Button>
    </Flex>
  ),
};

/**
 * Page header with subtitle and actions
 */
export const Complete = Template.bind({});

Complete.args = {
  title: "Experiments",
  subTitle: "Run and compare experiments on your datasets",
  extra: (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Button leadingVisual={<Icon svg={<Icons.DownloadOutline />} />} />
      <Button variant="primary">Run Experiment</Button>
    </Flex>
  ),
};

/**
 * Page header with custom title content (ReactNode)
 */
export const CustomTitleContent = () => (
  <PageHeader
    title={
      <Flex direction="row" gap="size-100" alignItems="center">
        My Dataset
        <Token color="var(--ac-global-color-primary)">production</Token>
        <Token color="var(--ac-global-color-yellow-500)">v2.1</Token>
      </Flex>
    }
    subTitle="A dataset for training and evaluation"
    extra={<Button variant="primary">Run Experiment</Button>}
  />
);

CustomTitleContent.parameters = {
  docs: {
    description: {
      story:
        "When passing a ReactNode as the title, it renders as-is without wrapping in a Heading component.",
    },
  },
};
