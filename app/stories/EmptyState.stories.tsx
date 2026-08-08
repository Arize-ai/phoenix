import type { Meta, StoryObj } from "@storybook/react";

import { Icon, Icons } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { ExternalLink } from "@phoenix/components/core/ExternalLink";

const meta: Meta<typeof EmptyState> = {
  title: "Core/Feedback/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "padded",
    // Light/dark panes sit side by side (row) in "Both" mode. The wide
    // two-column card stories override this to stacked (column) below.
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

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
    graphic: <EmptyStateGraphic variant="trace" />,
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
      type: "strip",
      items: [
        { kind: "link", label: "Docs", href: "https://docs.arize.com/phoenix" },
      ],
    },
  },
};

// Mixed strip — the common product pattern: a "Docs" link (external) sits beside
// the primary "Create X" button (in-product). Convention: links for external
// destinations, buttons for in-product behaviors; no leading icons on buttons.
export const TitleDescriptionAndActions: Story = {
  name: "Title + description + actions (link + button)",
  args: {
    title: "No evaluators yet",
    description:
      "Create your first evaluator to start scoring AI outputs automatically.",
    action: {
      type: "strip",
      items: [
        { kind: "link", label: "Docs", href: "https://docs.arize.com/phoenix" },
        {
          kind: "button",
          variant: "primary",
          children: "Create Evaluator",
          onPress: () => {},
        },
      ],
    },
  },
};

export const GraphicTitleDescriptionAndButton: Story = {
  name: "Graphic + title + description + button",
  args: {
    graphic: <EmptyStateGraphic variant="experiment" />,
    title: "No experiments yet",
    description:
      "Run your first experiment to compare how different prompt variations affect your model's output.",
    action: {
      type: "strip",
      items: [
        {
          kind: "button",
          variant: "primary",
          children: "Create Experiment",
          onPress: () => {},
        },
      ],
    },
  },
};

export const ButtonWithDescriptionLink: Story = {
  name: "Button with docs link in description",
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
      type: "strip",
      items: [
        {
          kind: "button",
          variant: "primary",
          children: "Create Prompt",
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
    icon: <Icon svg={<Icons.LLMOutput />} />,
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
  parameters: { themeLayout: "column" },
  args: {
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 2 },
  },
};

export const GraphicTwoCardsOneColumn: Story = {
  name: "Graphic + two cards — 1 column (vertical layout)",
  args: {
    graphic: <EmptyStateGraphic variant="evaluator" />,
    title: "Get started with evaluators",
    description: "Choose the evaluator type that fits your use case.",
    action: { type: "cards", items: twoCards, columns: 1 },
  },
};

export const GraphicTwoCardsTwoColumns: Story = {
  name: "Graphic + two cards — 2 columns (vertical layout)",
  parameters: { themeLayout: "column" },
  args: {
    graphic: <EmptyStateGraphic variant="evaluator" />,
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
    icon: <Icon svg={<Icons.LLMOutput />} />,
    title: "correctness",
    description:
      "Assess general correctness and completeness of model outputs.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.LLMOutput />} />,
    title: "tool_selection",
    description:
      "Determine if the correct tool was selected for a given context.",
    href: "https://docs.arize.com/phoenix",
    external: true,
  },
  {
    icon: <Icon svg={<Icons.LLMOutput />} />,
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
  parameters: { themeLayout: "column" },
  args: {
    title: "Automate evaluation of your AI outputs",
    description:
      "Choose from LLM evaluator templates or built-in code evaluators to score experiment runs.",
    action: { type: "cards", items: sixCards, columns: 2 },
  },
};

export const GraphicSixCardsTwoColumns: Story = {
  name: "Graphic + six cards — 2 columns (auto horizontal layout)",
  parameters: { themeLayout: "column" },
  args: {
    graphic: <EmptyStateGraphic variant="evaluator" />,
    title: "Automate evaluation of your AI outputs",
    description:
      "Choose from LLM evaluator templates or built-in code evaluators to score experiment runs.",
    action: { type: "cards", items: sixCards, columns: 2 },
  },
};

// Same six-card case, but forcing the graphic above the content instead of
// letting "auto" switch to the side-by-side (horizontal) layout.
export const GraphicSixCardsTwoColumnsVertical: Story = {
  name: "Graphic + six cards — 2 columns (vertical layout)",
  parameters: { themeLayout: "column" },
  args: {
    graphic: <EmptyStateGraphic variant="evaluator" />,
    title: "Automate evaluation of your AI outputs",
    description:
      "Choose from LLM evaluator templates or built-in code evaluators to score experiment runs.",
    action: { type: "cards", items: sixCards, columns: 2 },
    orientation: "vertical",
  },
};
