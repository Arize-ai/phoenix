import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Text } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import type { ExpandableContentProps } from "@phoenix/components/core/content/ExpandableContent";
import { ExpandableContent } from "@phoenix/components/core/content/ExpandableContent";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A region that clips content taller than `height` behind a gradient and an
 * expand button. Content that fits shows no button.
 *
 * With the default `expandedBehavior="scroll"` the region keeps its height
 * and scrolls once expanded, which suits table cells. With `"grow"`, `height`
 * is a maximum and the expanded region grows to its content and offers a
 * collapse button, which avoids a scroll area nested in a scrolling page.
 *
 * The gradient fades to `overlayBackgroundColor`, which must match the
 * surface the region sits on. Pass `isExpanded` and `onExpandedChange` to own
 * the expanded state.
 */
const meta: Meta = {
  title: "Design System/Layout/Expandable Content",
  tags: ["updated", "unreviewed", "incomplete"],
  component: ExpandableContent,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const shortContent = "The retrieved documents answer the question directly.";

const longContent = `The assistant retrieved four documents about the refund policy and cited two of them in its answer.

The first citation quotes the thirty-day return window accurately. The second paraphrases the exception for opened items, but omits that the exception applies only to electronics.

The answer does not mention the restocking fee described in the third document, which a customer asking about refunds would need to know.

The fourth document, an outdated version of the policy, was retrieved but not cited.`;

const jsonContent = JSON.stringify(
  {
    model: "gpt-4o",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You answer questions about refunds." },
      { role: "user", content: "Can I return opened headphones?" },
    ],
    tools: [{ type: "function", function: { name: "search_policy" } }],
  },
  null,
  2
);

const Frame = ({
  width = 240,
  background = "var(--global-background-color-default)",
  children,
}: {
  width?: number;
  background?: string;
  children: ReactNode;
}) => (
  <div
    css={css`
      width: ${width}px;
      border: 1px solid var(--global-border-color-default);
      border-radius: var(--global-rounding-small);
      background: ${background};
      padding: var(--global-dimension-size-100);
      box-sizing: border-box;
    `}
  >
    {children}
  </div>
);

function Region({
  initiallyExpanded = false,
  ...props
}: Omit<ExpandableContentProps, "isExpanded" | "onExpandedChange"> & {
  initiallyExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  return (
    <ExpandableContent
      {...props}
      isExpanded={isExpanded}
      onExpandedChange={setIsExpanded}
    />
  );
}

export const Default: StoryFn = () => (
  <Frame width={400}>
    <ExpandableContent height={100}>
      <Text>{longContent}</Text>
    </ExpandableContent>
  </Frame>
);
Default.tags = ["!dev"];

const BEHAVIORS: {
  label: string;
  code: true;
  expandedBehavior: ExpandableContentProps["expandedBehavior"];
}[] = [
  { label: '"scroll"', code: true, expandedBehavior: "scroll" },
  { label: '"grow"', code: true, expandedBehavior: "grow" },
];

const STATES = [
  { label: "Fits", content: shortContent, initiallyExpanded: false },
  { label: "Collapsed", content: longContent, initiallyExpanded: false },
  { label: "Expanded", content: longContent, initiallyExpanded: true },
];

export const BehaviorsAndStates: StoryFn = () => (
  <OptionGrid
    rows={BEHAVIORS}
    columns={STATES}
    alignRows="start"
    renderCell={(row, column) =>
      column ? (
        <Frame>
          <Region
            height={120}
            expandedBehavior={row.expandedBehavior}
            initiallyExpanded={column.initiallyExpanded}
          >
            <Text>{column.content}</Text>
          </Region>
        </Frame>
      ) : null
    }
  />
);
BehaviorsAndStates.storyName = "Behaviors and States";
BehaviorsAndStates.tags = ["!dev"];
BehaviorsAndStates.parameters = { themeLayout: "column" };

const CONTENT_TYPES = [
  { label: "Text", content: <Text>{longContent}</Text> },
  { label: "JSON", content: <JSONBlock value={jsonContent} /> },
];

export const ContentTypes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT_TYPES}
    renderCell={(row) => (
      <Frame width={320}>
        <Region height={140}>{row.content}</Region>
      </Frame>
    )}
  />
);
ContentTypes.storyName = "Content types";
ContentTypes.tags = ["!dev"];
ContentTypes.parameters = { themeLayout: "row" };

const TINTED_SURFACE = "var(--global-color-blue-100)";

const OVERLAY_COLORS = [
  { label: "Default", code: false, props: {} },
  {
    label: `overlayBackgroundColor="${TINTED_SURFACE}"`,
    code: true,
    props: { overlayBackgroundColor: TINTED_SURFACE },
  },
];

export const OverlayBackground: StoryFn = () => (
  <OptionGrid
    rows={OVERLAY_COLORS}
    renderCell={(row) => (
      <Frame width={260} background={TINTED_SURFACE}>
        <Region height={100} expandedBehavior="grow" {...row.props}>
          <Text>{longContent}</Text>
        </Region>
      </Frame>
    )}
  />
);
OverlayBackground.storyName = "Overlay Background";
OverlayBackground.tags = ["!dev"];
OverlayBackground.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Frame width={288}>
      <ExpandableContent height={100}>
        <Text>{longContent}</Text>
      </ExpandableContent>
    </Frame>
  ),
};
