import type { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  Card,
  Counter,
  OverflowRow,
  Text,
  Token,
} from "@phoenix/components";

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
      description:
        "Optional subtitle displayed inline after the title in a lesser text color",
    },
    titleExtra: {
      control: false,
      description: "Additional content displayed next to the title",
    },
    collapsible: {
      control: "boolean",
      description: "Whether the card can be collapsed/expanded",
    },
    collapsedPreview: {
      control: "text",
      description:
        "A one-line excerpt of the body shown in the header while the card is collapsed",
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

export const CollapsedPreview = {
  render: Template,

  args: {
    title: "assistant",
    collapsible: true,
    defaultOpen: false,
    collapsedPreview:
      "Hi, I am your friendly assistant. I can look up the weather, search your documents, and answer questions about them.",
    width: "400px",
  },
};

export const CollapsedToolCallPreview = {
  render: Template,

  args: {
    title: "assistant",
    collapsible: true,
    defaultOpen: false,
    collapsedPreview:
      'get_weather({"city":"San Francisco","units":"celsius"}), get_time({"tz":"America/Los_Angeles"})',
    width: "400px",
  },
};

export const CollapsedRecordPreview = {
  render: Template,

  args: {
    title: "Invocation Params",
    collapsible: true,
    defaultOpen: false,
    collapsedPreview:
      "temperature: 0.7, max_tokens: 1000, model: gpt-4, top_p: 1",
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

/**
 * `headerContent` shrinks to whatever the header's fixed parts leave it —
 * resize the story to watch the tokens clip while the title and the action keep
 * their size. Paired with `interactiveTitle`, since the tokens are clickable.
 */
export const WithHeaderContent = {
  render: Template,

  args: {
    title: "Annotations",
    titleExtra: <Counter variant="quiet">4</Counter>,
    collapsible: true,
    interactiveTitle: true,
    collapseButtonLabel: "Annotations",
    headerContent: (
      <OverflowRow>
        <Token size="S">hallucination</Token>
        <Token size="S">correctness</Token>
        <Token size="S">relevance</Token>
        <Token size="S">toxicity</Token>
      </OverflowRow>
    ),
    extra: <Button size="S">Action</Button>,
    width: "480px",
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
