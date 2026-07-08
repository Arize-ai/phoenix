import type { Meta, StoryFn } from "@storybook/react";

import { Button, Card, Text, Token } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Layout/Card",
  component: Card,
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
  argTypes: {
    title: {
      control: "text",
      description: "The title displayed in the card header",
    },
    subTitle: {
      control: "text",
      description: "Optional subtitle displayed below the title",
    },
    titleExtra: {
      control: false,
      description: "Additional content displayed next to the title",
    },
    collapsible: {
      control: "boolean",
      description: "Whether the card can be collapsed/expanded",
    },
    width: {
      control: "text",
      description: "Width of the card",
    },
  },
};

export default meta;

const Template: StoryFn = (args) => (
  <Card {...args} title={args.title}>
    <Text>
      This is the card content. You can put any content here including text,
      buttons, forms, or other components.
    </Text>
  </Card>
);

export const Default = {
  render: Template,

  args: {
    title: "Card Title",
    width: "400px",
  },
};

export const WithSubtitle = {
  render: Template,

  args: {
    title: "Card Title",
    subTitle: "This is a subtitle that provides additional context",
    width: "400px",
  },
};

export const Collapsible = {
  render: Template,

  args: {
    title: "Collapsible Card",
    subTitle: "Click the header to expand/collapse",
    collapsible: true,
    width: "400px",
  },
};

export const WithExtra = {
  render: Template,

  args: {
    title: "Card with Extra Content",
    subTitle: "Header contains additional elements",
    extra: <Button size="S">Action</Button>,
    width: "400px",
  },
};

export const WithTitleExtra = {
  render: Template,

  args: {
    title: "Experiment Results",
    titleExtra: (
      <Token color="var(--global-color-yellow-500)" size="S">
        #42
      </Token>
    ),
    width: "400px",
  },
};

export const WithoutTitleSeparator = {
  render: Template,

  args: {
    title: "Card Without Separator",
    subTitle: "This card has no separator between title and content",
    titleSeparator: false,
    width: "400px",
  },
};

export const DefaultClosed = {
  render: Template,

  args: {
    title: "Default Closed Card",
    subTitle: "This card starts in a collapsed state",
    collapsible: true,
    defaultOpen: false,
    width: "400px",
  },
};
