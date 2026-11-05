import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { fn } from "storybook/test";

import type { StatusCategory, StatusMarker } from "@phoenix/components/core/v2";
import { MarkerTrigger, StatusIndicator } from "@phoenix/components/core/v2";

import { OptionGrid } from "../../../utils/OptionGrid";

/**
 * The lifecycle or health of a thing, drawn as a glyph and a word with no
 * container. The category picks the glyph and its tone; the domain supplies
 * the word. The glyph carries the meaning, so the status still reads in
 * grayscale.
 *
 * - **Under way**: `pending` (accepted, not started), `active` (in
 *   progress), `needs-input` (halted by the system until a person acts: an
 *   approval, an answer, credentials), `paused` (held by a person on purpose
 *   and resumable; nothing is required)
 * - **Settled**: `succeeded` (finished, or ready), `failed` (ended
 *   abnormally, or cannot be used), `stopped` (ended early on purpose, for
 *   good: cancelled, denied, skipped)
 * - **No outcome**: `warning` (works, but needs attention), `off` (disabled,
 *   not installed, or does not apply), `unknown` (no value was reported)
 *
 * `paused` and `needs-input` both stand still, but only `needs-input` waits
 * on someone, so only it takes the warning tone. Categories are closed and
 * labels are open: a new runner adds words, never a glyph. A value that fits
 * no category is usually two axes, such as a lifecycle and an outcome, each
 * in its own slot. Extra facts go in `detail`, never in a new category.
 *
 * `marker="dot"` trades the glyph for a dot in the category's tone, for a
 * status set among other dots. Five tones cannot tell ten categories apart,
 * and the word always shows. A dot in an identity color that judges nothing,
 * such as an experiment's series color, is a `Swatched Name`, not a status.
 *
 * The word is never hidden: the glyphs alone do not tell the categories
 * apart. Where space is tight, mark only the statuses worth noticing, as a
 * trace tree row marks a failed span and leaves the rest unmarked. A status
 * is never its own hit target.
 */
const meta: Meta = {
  title: "Design System/Badges/V2/Status Indicator",
  component: StatusIndicator,
  tags: ["updated", "unreviewed", "complete", "unused"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const CATEGORIES: {
  label: StatusCategory;
  code: true;
  text: string;
}[] = [
  { label: "pending", code: true, text: "Queued" },
  { label: "active", code: true, text: "Running" },
  { label: "needs-input", code: true, text: "Awaiting approval" },
  { label: "paused", code: true, text: "Paused" },
  { label: "succeeded", code: true, text: "Completed" },
  { label: "failed", code: true, text: "Error" },
  { label: "stopped", code: true, text: "Denied" },
  { label: "warning", code: true, text: "Degraded" },
  { label: "off", code: true, text: "Not installed" },
  { label: "unknown", code: true, text: "Unset" },
];

const MARKERS: { label: StatusMarker; code: true }[] = [
  { label: "glyph", code: true },
  { label: "dot", code: true },
];

const CONTENT: {
  label: string;
  category: StatusCategory;
  text: string;
  detail?: string;
}[] = [
  { label: "Bare", category: "active", text: "Running" },
  {
    label: "Progress",
    category: "active",
    text: "Running",
    detail: "12 of 40",
  },
  {
    label: "Reason",
    category: "failed",
    text: "Error",
    detail: "Rate limited",
  },
];

const LENGTHS: {
  label: string;
  category: StatusCategory;
  text: string;
  detail?: string;
}[] = [
  { label: "Empty", category: "unknown", text: "" },
  { label: "Regular", category: "needs-input", text: "Awaiting approval" },
  {
    label: "Long",
    category: "needs-input",
    text: "Authentication required",
    detail: "Missing an API key for the sandbox provider",
  },
];

const constrainedCSS = css`
  width: 160px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const Default: StoryFn = () => (
  <StatusIndicator category="active" label="Running" />
);
Default.tags = ["!dev"];

export const Categories: StoryFn = () => (
  <OptionGrid
    rows={CATEGORIES}
    renderCell={(category) => (
      <StatusIndicator category={category.label} label={category.text} />
    )}
  />
);
Categories.tags = ["!dev"];
Categories.parameters = { themeLayout: "row" };

type DomainStatus = { category: StatusCategory; text: string };

const domainStatusesCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
`;

function DomainStatuses({ statuses }: { statuses: DomainStatus[] }) {
  return (
    <div css={domainStatusesCSS}>
      {statuses.map((status) => (
        <StatusIndicator
          key={status.text}
          category={status.category}
          label={status.text}
        />
      ))}
    </div>
  );
}

export const DomainSpan: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "succeeded", text: "OK" },
      { category: "failed", text: "Error" },
      { category: "unknown", text: "Unset" },
    ]}
  />
);
DomainSpan.storyName = "Domain: Span";
DomainSpan.tags = ["!dev"];
DomainSpan.parameters = { themeLayout: "row" };

export const DomainExperiment: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "active", text: "Running" },
      { category: "succeeded", text: "Completed" },
      { category: "failed", text: "Error" },
      { category: "stopped", text: "Stopped" },
    ]}
  />
);
DomainExperiment.storyName = "Domain: Experiment";
DomainExperiment.tags = ["!dev"];
DomainExperiment.parameters = { themeLayout: "row" };

export const DomainPlaygroundRun: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "pending", text: "Queued" },
      { category: "active", text: "Generating" },
      { category: "needs-input", text: "Missing variables" },
      { category: "stopped", text: "Cancelled" },
    ]}
  />
);
DomainPlaygroundRun.storyName = "Domain: Playground run";
DomainPlaygroundRun.tags = ["!dev"];
DomainPlaygroundRun.parameters = { themeLayout: "row" };

export const DomainPxiToolCall: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "active", text: "Preparing" },
      { category: "active", text: "Running" },
      { category: "needs-input", text: "Awaiting approval" },
      { category: "active", text: "Approval received" },
      { category: "succeeded", text: "Completed" },
      { category: "failed", text: "Error" },
      { category: "stopped", text: "Denied" },
    ]}
  />
);
DomainPxiToolCall.storyName = "Domain: PXI tool call";
DomainPxiToolCall.tags = ["!dev"];
DomainPxiToolCall.parameters = { themeLayout: "row" };

/**
 * Error and Canceled are stored as the same value, `output-error`; the
 * category follows the meaning, not the value.
 */
export const DomainPxiQuestion: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "active", text: "Preparing questions" },
      { category: "needs-input", text: "Awaiting response" },
      { category: "succeeded", text: "Answered" },
      { category: "failed", text: "Error" },
      { category: "stopped", text: "Canceled" },
      { category: "stopped", text: "Skipped" },
    ]}
  />
);
DomainPxiQuestion.storyName = "Domain: PXI question";
DomainPxiQuestion.tags = ["!dev"];
DomainPxiQuestion.parameters = { themeLayout: "row" };

export const DomainFileUpload: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "pending", text: "Pending" },
      { category: "active", text: "Uploading" },
      { category: "active", text: "Parsing" },
      { category: "succeeded", text: "Complete" },
      { category: "failed", text: "Error" },
    ]}
  />
);
DomainFileUpload.storyName = "Domain: File upload";
DomainFileUpload.tags = ["!dev"];
DomainFileUpload.parameters = { themeLayout: "row" };

export const DomainSandboxBackend: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "succeeded", text: "Available" },
      { category: "needs-input", text: "Authentication required" },
      { category: "failed", text: "Unavailable" },
      { category: "off", text: "Not installed" },
      { category: "off", text: "Disabled" },
    ]}
  />
);
DomainSandboxBackend.storyName = "Domain: Sandbox backend";
DomainSandboxBackend.tags = ["!dev"];
DomainSandboxBackend.parameters = { themeLayout: "row" };

export const DomainBrowserModel: StoryFn = () => (
  <DomainStatuses
    statuses={[
      { category: "pending", text: "Downloads on first use" },
      { category: "active", text: "Downloading" },
      { category: "succeeded", text: "Ready" },
      { category: "off", text: "Not supported in this browser" },
    ]}
  />
);
DomainBrowserModel.storyName = "Domain: Browser model";
DomainBrowserModel.tags = ["!dev"];
DomainBrowserModel.parameters = { themeLayout: "row" };

export const Markers: StoryFn = () => (
  <OptionGrid
    rows={CATEGORIES}
    columns={MARKERS}
    renderCell={(category, marker) => (
      <StatusIndicator
        category={category.label}
        marker={marker?.label}
        label={category.text}
      />
    )}
  />
);
Markers.tags = ["!dev"];
Markers.parameters = { themeLayout: "column" };

export const Content: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    renderCell={(content) => (
      <StatusIndicator
        category={content.category}
        label={content.text}
        detail={content.detail}
      />
    )}
  />
);
Content.tags = ["!dev"];
Content.parameters = { themeLayout: "row" };

const CONSTRAINTS: { label: string; code?: true; isProp: boolean }[] = [
  { label: "160px container", isProp: false },
  { label: "maxWidth 160px", code: true, isProp: true },
];

/**
 * A status truncates when its container is narrow. `maxWidth` caps it
 * anywhere, and the full label and detail become its native tooltip.
 */
export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={CONSTRAINTS}
    renderCell={(length, constraint) =>
      constraint?.isProp ? (
        <StatusIndicator
          category={length.category}
          label={length.text}
          detail={length.detail}
          maxWidth="160px"
        />
      ) : (
        <div css={constrainedCSS}>
          <StatusIndicator
            category={length.category}
            label={length.text}
            detail={length.detail}
          />
        </div>
      )
    }
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

const TRIGGERS: {
  label: string;
  render: (isDisabled: boolean) => ReactNode;
}[] = [
  {
    label: "Explanation",
    render: (isDisabled) => (
      <MarkerTrigger
        explanation="Disabled on the server."
        isDisabled={isDisabled}
      >
        <StatusIndicator category="off" label="Disabled" />
      </MarkerTrigger>
    ),
  },
  {
    label: "Action",
    render: (isDisabled) => (
      <MarkerTrigger
        aria-label="Show backend status details"
        onPress={fn()}
        isDisabled={isDisabled}
      >
        <StatusIndicator category="failed" label="Unavailable" />
      </MarkerTrigger>
    ),
  },
];

const TRIGGER_STATES: { label: string; isDisabled: boolean }[] = [
  { label: "Enabled", isDisabled: false },
  { label: "Disabled", isDisabled: true },
];

/**
 * A status that explains itself or opens detail goes inside a
 * `MarkerTrigger`. The label takes a dotted underline when it carries an
 * explanation, and a solid one while hovered or pressed. Hover, focus or
 * press the explanation to show it.
 */
export const InATrigger: StoryFn = () => (
  <OptionGrid
    rows={TRIGGERS}
    columns={TRIGGER_STATES}
    renderCell={(trigger, state) => trigger.render(state?.isDisabled ?? false)}
  />
);
InATrigger.tags = ["!dev"];
InATrigger.parameters = { themeLayout: "row" };

const thumbnailCSS = css`
  display: grid;
  grid-template-columns: auto auto;
  gap: var(--global-dimension-size-150) var(--global-dimension-size-400);
`;

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div css={thumbnailCSS}>
      <StatusIndicator category="pending" label="Queued" />
      <StatusIndicator category="succeeded" label="Completed" />
      <StatusIndicator category="active" label="Running" />
      <StatusIndicator category="failed" label="Error" />
      <StatusIndicator category="needs-input" label="Awaiting approval" />
      <StatusIndicator category="paused" label="Paused" />
    </div>
  ),
};
