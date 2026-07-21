import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import type { Annotation } from "@phoenix/components/annotation";
import {
  AnnotationLabel,
  AnnotationSummaryRow,
} from "@phoenix/components/annotation";

/**
 * The annotation summary row is a full-width band that sits between an
 * entity header (e.g. a span header) and its tab bar. It presents the
 * annotations applied to the entity as a single line of inline tokens —
 * scrolling horizontally when they overflow — with a ghost "+ Annotation"
 * affordance at the trailing edge.
 */
const meta = {
  title: "Annotation/AnnotationSummaryRow",
  component: AnnotationSummaryRow,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AnnotationSummaryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const annotations: Annotation[] = [
  { id: "1", name: "correctness", label: "correct", score: 1 },
  { id: "2", name: "hallucination", label: "factual", score: 0.98 },
  { id: "3", name: "relevance", score: 0.72 },
  { id: "4", name: "session.tag", label: "dataset_mgmt" },
  { id: "5", name: "toxicity", label: "non-toxic", score: 0 },
  { id: "6", name: "conciseness", score: 0.51 },
  { id: "7", name: "helpfulness", label: "helpful", score: 0.87 },
  { id: "8", name: "sentiment", label: "positive" },
];

const tokensCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

function Tokens({ items }: { items: Annotation[] }) {
  return (
    <div css={tokensCSS}>
      {items.map((annotation) => (
        <AnnotationLabel
          key={annotation.id}
          annotation={annotation}
          annotationDisplayPreference="score-and-label"
          clickable
        />
      ))}
    </div>
  );
}

/**
 * A typical band: a handful of annotation tokens with the add affordance at
 * the trailing edge.
 */
export const Default: Story = {
  args: {
    children: <Tokens items={annotations.slice(0, 3)} />,
  },
};

/**
 * With no annotations applied, the band shows a "None yet" placeholder and
 * the add button gains a border for extra affordance.
 */
export const Empty: Story = {
  args: {
    isEmpty: true,
  },
};

/**
 * When there are more annotations than fit, the band stays a single line and
 * scrolls horizontally — it never grows vertically.
 */
export const ManyAnnotationsScrolling: Story = {
  args: {
    children: <Tokens items={annotations} />,
  },
  render: (args) => (
    <div style={{ maxWidth: 500 }}>
      <AnnotationSummaryRow {...args} />
    </div>
  ),
};
