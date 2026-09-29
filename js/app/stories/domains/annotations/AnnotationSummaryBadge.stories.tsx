import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

import { AnnotationSummaryBadge } from "@phoenix/components/annotation/AnnotationSummaryBadge";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";

import { annotationConfigsByName } from "../../constants/annotationFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

const hallucination = annotationConfigsByName.get("hallucination");
const faithfulness = annotationConfigsByName.get("faithfulness");
const undirected: AnnotationOptimizationConfig = {
  annotationType: "CATEGORICAL",
  optimizationDirection: "NONE",
};

const scored = (name: string, meanScore: number): AnnotationSummary => ({
  name,
  meanScore,
  labelFractions: [],
});

const labeled = (
  name: string,
  label: string,
  meanScore: number | null
): AnnotationSummary => ({
  name,
  meanScore,
  labelFractions: [{ label, fraction: 1 }],
});

const longSummary = labeled(
  "answer-completeness-against-reference",
  "partially-complete-with-omissions",
  0.5
);

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
};

const meta: Meta<typeof AnnotationSummaryBadge> = {
  title: "Domains/Annotations/Annotation Summary Badge",
  tags: ["updated", "complete", "unreviewed"],
  component: AnnotationSummaryBadge,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationSummaryBadge>;

export const Default: Story = {
  tags: ["!dev"],
  args: {
    summary: labeled("hallucination", "hallucinated", 1),
    annotationConfig: hallucination,
  },
};

export const Directions: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={[{ label: "Labeled" }, { label: "Scored" }]}
      columns={[
        {
          label: "Favorable",
          labeled: labeled("hallucination", "factual", 0),
          labeledConfig: hallucination,
          scored: scored("faithfulness", 0.97),
          scoredConfig: faithfulness,
        },
        {
          label: "Unfavorable",
          labeled: labeled("hallucination", "hallucinated", 1),
          labeledConfig: hallucination,
          scored: scored("faithfulness", 0.31),
          scoredConfig: faithfulness,
        },
        {
          label: "Undirected",
          labeled: labeled("hallucination", "hallucinated", null),
          labeledConfig: undirected,
          scored: scored("faithfulness", 0.31),
          scoredConfig: undefined,
        },
      ]}
      renderCell={(row, column) =>
        row.label === "Labeled" ? (
          <AnnotationSummaryBadge
            summary={column!.labeled}
            annotationConfig={column!.labeledConfig}
          />
        ) : (
          <AnnotationSummaryBadge
            summary={column!.scored}
            annotationConfig={column!.scoredConfig}
          />
        )
      }
    />
  ),
};

export const ContentLength: Story = {
  tags: ["!dev"],
  render: () => (
    <div style={stackStyle}>
      <AnnotationSummaryBadge
        summary={scored("ok", 1)}
        annotationConfig={faithfulness}
      />
      <AnnotationSummaryBadge
        summary={{ name: "reviewed", labelFractions: [] }}
      />
      <AnnotationSummaryBadge
        summary={longSummary}
        annotationConfig={faithfulness}
      />
      <div style={{ width: 160 }}>
        <AnnotationSummaryBadge
          summary={longSummary}
          annotationConfig={faithfulness}
        />
      </div>
    </div>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={stackStyle}>
      <AnnotationSummaryBadge
        summary={labeled("hallucination", "hallucinated", 1)}
        annotationConfig={hallucination}
      />
      <AnnotationSummaryBadge
        summary={scored("faithfulness", 0.97)}
        annotationConfig={faithfulness}
      />
      <AnnotationSummaryBadge summary={labeled("tone", "formal", null)} />
    </div>
  ),
};
