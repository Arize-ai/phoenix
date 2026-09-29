import type { Meta, StoryObj } from "@storybook/react";

import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { SpanAnnotationBadges } from "@phoenix/components/trace/SpanAnnotationBadges";

import {
  annotationConfigsByName,
  spanAnnotationsBySpanId,
  summarizeSpanAnnotations,
} from "../../constants/annotationFixtures";
import { OptionGrid } from "../../utils/OptionGrid";

const draftSummaries = summarizeSpanAnnotations(
  spanAnnotationsBySpanId["llm-draft"] ?? []
);
const finalSummaries = summarizeSpanAnnotations(
  spanAnnotationsBySpanId["llm-final"] ?? []
);
const retrieveSummaries = summarizeSpanAnnotations(
  spanAnnotationsBySpanId.retrieve ?? []
);

/** Seven evals on one span. */
const manySummaries: AnnotationSummary[] = [
  ...finalSummaries,
  {
    name: "qa_correctness",
    count: 1,
    meanScore: 0,
    labelFractions: [{ label: "incorrect", fraction: 1 }],
  },
  {
    name: "user_feedback",
    count: 1,
    meanScore: 1,
    labelFractions: [{ label: "positive", fraction: 1 }],
  },
  {
    name: "tool_success",
    count: 1,
    meanScore: 1,
    labelFractions: [{ label: "pass", fraction: 1 }],
  },
];

/**
 * The widths a trace tree row's content column takes: a wide tree, the
 * default tree panel, and a tree dragged narrow.
 */
const widths = [
  { label: "420px", code: true, width: 420 },
  { label: "220px", code: true, width: 220 },
  { label: "140px", code: true, width: 140 },
];

/**
 * The line of annotation badges under a trace tree row's metrics, one per
 * annotation name, unfavorable first. What the row has no room for is
 * clipped whole behind a "+N" badge that opens the rest in a popover, so a
 * narrow tree still shows the result that flagged the span. A pure view of
 * the summaries and configs it is given; `Trace Tree` shows it in rows.
 */
const meta: Meta<typeof SpanAnnotationBadges> = {
  title: "Domains/Tracing/Span Annotation Badges",
  tags: ["updated", "complete", "unreviewed"],
  component: SpanAnnotationBadges,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanAnnotationBadges>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <div style={{ width: 420 }}>
      <SpanAnnotationBadges
        summaries={draftSummaries}
        annotationConfigsByName={annotationConfigsByName}
      />
    </div>
  ),
};

/**
 * Rows of different lengths at each width. The single badge always shows;
 * past the width, badges clip behind "+N", and the first badge truncates its
 * name only when it alone is wider than the row.
 */
export const ContentLength: Story = {
  name: "Content Length",
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={[
        { label: "One eval", summaries: retrieveSummaries },
        { label: "Four evals", summaries: draftSummaries },
        { label: "Seven evals", summaries: manySummaries },
      ]}
      columns={widths}
      alignRows="start"
      renderCell={(row, column) => (
        <div style={{ width: column?.width }}>
          <SpanAnnotationBadges
            summaries={row.summaries}
            annotationConfigsByName={annotationConfigsByName}
          />
        </div>
      )}
    />
  ),
};

/**
 * The same summaries judged with and without the project's configs.
 * Without them there is no direction to judge by, so every badge is plain
 * and the order falls back to name.
 */
export const Configs: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={[
        { label: "With configs", configs: annotationConfigsByName },
        { label: "Without configs", configs: new Map() },
      ]}
      renderCell={(row) => (
        <div style={{ width: 420 }}>
          <SpanAnnotationBadges
            summaries={draftSummaries}
            annotationConfigsByName={row.configs}
          />
        </div>
      )}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[draftSummaries, finalSummaries, retrieveSummaries].map(
        (summaries, index) => (
          <div key={index} style={{ width: 300 }}>
            <SpanAnnotationBadges
              summaries={summaries}
              annotationConfigsByName={annotationConfigsByName}
            />
          </div>
        )
      )}
    </div>
  ),
};
