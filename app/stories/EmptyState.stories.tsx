import type { Meta, StoryObj } from "@storybook/react";

import { Icon, Icons } from "@phoenix/components";
import { ExternalLink } from "@phoenix/components/core/ExternalLink";
import { EmptyState } from "@phoenix/components/empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Core/Feedback/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "padded",
    themeLayout: "column",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

// ---------------------------------------------------------------------------
// Placeholder graphic used across stories
// ---------------------------------------------------------------------------
const PlaceholderGraphic = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      width="120"
      height="120"
      rx="12"
      fill="var(--global-color-gray-100)"
    />
    <rect
      x="24"
      y="24"
      width="72"
      height="72"
      rx="8"
      fill="var(--global-color-gray-200)"
    />
    <circle cx="60" cy="60" r="20" fill="var(--global-color-gray-400)" />
  </svg>
);

// ---------------------------------------------------------------------------
// 1. Non-actionable
// ---------------------------------------------------------------------------

export const DescriptionOnly: Story = {
  args: {
    description: "No data has been recorded yet. Check back later.",
  },
};

export const TitleAndDescription: Story = {
  args: {
    title: "No experiments found",
    description:
      "Run your first experiment to start comparing model outputs across prompt variations.",
  },
};

export const GraphicTitleAndDescription: Story = {
  args: {
    graphic: <PlaceholderGraphic />,
    title: "No traces yet",
    description:
      "Instrument your application with Phoenix tracing to see spans and traces appear here.",
  },
};

export const DescriptionWithInlineLink: Story = {
  name: "Description with inline link",
  args: {
    title: "No annotations found",
    description: (
      <>
        Annotations let you attach human feedback to spans.{" "}
        <ExternalLink href="https://docs.arize.com/phoenix">
          Learn more in the docs.
        </ExternalLink>
      </>
    ),
  },
};

// ---------------------------------------------------------------------------
// 2. Simple actions
// ---------------------------------------------------------------------------

export const TitleDescriptionAndLink: Story = {
  name: "Title + description + link",
  args: {
    title: "No datasets yet",
    description: "Upload a dataset to start running evaluations.",
    action: {
      type: "link",
      label: "View documentation",
      href: "https://docs.arize.com/phoenix",
    },
  },
};

export const TitleDescriptionAndButtons: Story = {
  name: "Title + description + buttons",
  args: {
    title: "No evaluators found",
    description:
      "Create your first evaluator to start scoring AI outputs automatically.",
    action: {
      type: "buttons",
      buttons: [
        {
          variant: "primary",
          children: "Create evaluator",
          onPress: () => {},
        },
        {
          children: "View datasets",
          onPress: () => {},
        },
      ],
    },
  },
};

export const GraphicTitleDescriptionAndButtons: Story = {
  name: "Graphic + title + description + buttons",
  args: {
    graphic: <PlaceholderGraphic />,
    title: "No experiments yet",
    description:
      "Run your first experiment to compare how different prompt variations affect your model's output.",
    action: {
      type: "buttons",
      buttons: [
        {
          variant: "primary",
          children: "New experiment",
          onPress: () => {},
        },
      ],
    },
  },
};

export const ButtonsWithDescriptionLink: Story = {
  name: "Buttons with docs link in description",
  args: {
    title: "No prompts yet",
    description: (
      <>
        Save prompt templates to iterate and version them over time.{" "}
        <ExternalLink href="https://docs.arize.com/phoenix">
          Read the docs
        </ExternalLink>{" "}
        to learn more.
      </>
    ),
    action: {
      type: "buttons",
      buttons: [
        {
          variant: "primary",
          children: "Create prompt",
          onPress: () => {},
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// 3a. Action cards — few (2 cards)
// ---------------------------------------------------------------------------

const twoCards = [
  {
    icon: <Icon svg={<Icons.TemplateOutline />} />,
    title: "LLM Evaluators",
    description: "Use AI to assess correctness, relevance, and tone.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.Code />} />,
    title: "Code Evaluators",
    description: "Deterministic checks like exact_match, contains, and regex.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
];

export const TwoCardsOneColumn: Story = {
  name: "Two cards — 1 column (vertical layout)",
  args: {
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 1 },
  },
};

export const TwoCardsTwoColumns: Story = {
  name: "Two cards — 2 columns (vertical layout)",
  args: {
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 2 },
  },
};

export const GraphicTwoCardsOneColumn: Story = {
  name: "Graphic + two cards — 1 column (vertical layout)",
  args: {
    graphic: <PlaceholderGraphic />,
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 1 },
  },
};

export const GraphicTwoCardsTwoColumns: Story = {
  name: "Graphic + two cards — 2 columns (vertical layout)",
  args: {
    graphic: <PlaceholderGraphic />,
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 2 },
  },
};

// ---------------------------------------------------------------------------
// 3b. Action cards — many (6 cards, 3×2 grid → auto horizontal layout)
// ---------------------------------------------------------------------------

const sixCards = [
  {
    icon: <Icon svg={<Icons.TemplateOutline />} />,
    title: "correctness",
    description:
      "Assess general correctness and completeness of model outputs.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.TemplateOutline />} />,
    title: "tool_selection",
    description:
      "Determine if the correct tool was selected for a given context.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.TemplateOutline />} />,
    title: "tool_invocation",
    description:
      "Verify a tool was invoked correctly with proper arguments and formatting.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.Code />} />,
    title: "exact_match",
    description:
      "Evaluates whether the actual text exactly matches the expected text.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.Code />} />,
    title: "contains",
    description:
      "Check whether the output contains any of the specified words or phrases.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.Code />} />,
    title: "regex",
    description: "Evaluates whether the output matches a regex pattern.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
];

export const SixCardsTwoColumns: Story = {
  name: "Six cards — 2 columns, title + desc (auto horizontal layout)",
  args: {
    title: "Automate evaluation of your AI outputs",
    description:
      "Choose from LLM evaluator templates or built-in code evaluators to score experiment runs.",
    action: { type: "cards", items: sixCards, columns: 2 },
  },
};

export const GraphicSixCardsTwoColumns: Story = {
  name: "Graphic + six cards — 2 columns (auto horizontal layout)",
  args: {
    graphic: <PlaceholderGraphic />,
    title: "Automate evaluation of your AI outputs",
    description:
      "Choose from LLM evaluator templates or built-in code evaluators to score experiment runs.",
    action: { type: "cards", items: sixCards, columns: 2 },
  },
};
