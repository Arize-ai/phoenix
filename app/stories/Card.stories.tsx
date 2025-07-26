import { Meta, StoryFn } from "@storybook/react";

import { Button, Card, Text } from "@phoenix/components";

const meta: Meta = {
  title: "Card",
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
    variant: {
      control: "select",
      options: ["default", "compact"],
      description: "The visual variant of the card",
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

/**
 * Basic card with default styling and simple content
 */
export const Default = Template.bind({});

Default.args = {
  title: "Card Title",
  width: "400px",
};

/**
 * Card with subtitle
 */
export const WithSubtitle = Template.bind({});

WithSubtitle.args = {
  title: "Card Title",
  subTitle: "This is a subtitle that provides additional context",
  width: "400px",
};

/**
 * Compact variant card
 */
export const Compact = Template.bind({});

Compact.args = {
  title: "Compact Card",
  subTitle: "Compact variant with smaller header",
  variant: "compact",
  width: "400px",
};

/**
 * Collapsible card
 */
export const Collapsible = Template.bind({});

Collapsible.args = {
  title: "Collapsible Card",
  subTitle: "Click the header to expand/collapse",
  collapsible: true,
  width: "400px",
};

/**
 * Card with extra content in header
 */
export const WithExtra = Template.bind({});

WithExtra.args = {
  title: "Card with Extra Content",
  subTitle: "Header contains additional elements",
  extra: <Button size="S">Action</Button>,
  width: "400px",
};

/**
 * Card with custom body styling
 */
export const WithCustomBodyStyle = Template.bind({});

WithCustomBodyStyle.args = {
  title: "Custom Body Style",
  width: "400px",
  bodyStyle: {
    backgroundColor: "light",
    padding: "size-300",
    borderRadius: "small",
  },
};
