import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { fn } from "storybook/test";

import type { StatusCategory } from "@phoenix/components";
import { MarkerTrigger, StatusIndicator } from "@phoenix/components";
import { ExperimentStatus } from "@phoenix/components/experiment";
import { SpanStatusIndicator } from "@phoenix/components/trace";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The lifecycle or health of a thing, drawn as a glyph and a word with no
 * container. The category picks the glyph and its color; the domain supplies
 * the word. The glyph carries the meaning, so the status still reads in
 * grayscale.
 *
 * - **Under way**: `running` (work under way: executing, downloading),
 *   `recording` (work under way whose results are being kept: an experiment
 *   recorded from the playground), `needs-input` (halted partway until a person answers: an approval, a
 *   question)
 * - **Settled**: `succeeded` (finished, or ready), `failed` (ended
 *   abnormally, or cannot be used), `stopped` (ended early on purpose, for
 *   good: cancelled, skipped), `denied` (a person declined a request, for
 *   any reason: a rejected tool call or approval)
 * - **No outcome**: `needs-credentials` (cannot be used until someone supplies
 *   credentials: an API key, a token), `disabled` (turned off by a person or a
 *   policy), `unavailable` (cannot be used here yet or at all, though nobody
 *   turned it off: not installed, not downloaded, not supported in this
 *   browser), `unset` (nothing has been set or recorded)
 *
 * `unavailable` and `unset` share the dash: a reader responds to both the
 * same way, and the label tells them apart. Any other two categories differ
 * in glyph, so a status still reads in grayscale.
 *
 * **Adding a category.** Categories are shared vocabulary, not a closed
 * list. Add one when a meaning recurs in more than one domain, asks the
 * same of the reader each time, and would be misdescribed by every existing
 * category. One domain's vocabulary is a label, not a category. Name the
 * category for what is true of the thing, and give it a glyph whose
 * metaphor holds in every use: a key fits missing credentials everywhere,
 * but would not fit setup in general. A value that fits no category is
 * often two axes, such as a lifecycle and an outcome, each in its own slot;
 * extra facts go in `detail`.
 *
 * **Color.** Color belongs to the category and matches how the status reads
 * in a list of everything. `needs-credentials` is gray, because a page of
 * providers nobody has set up is not an alarm. `needs-input` uses the
 * warning color, because an approval or a question only arises inside a
 * task under way. When a status stands between the viewer and what they
 * are trying to do, the task's own surface says so — an alert beside the
 * action, a disabled action with its reason, a trigger that opens the fix
 * — rather than a recolored status.
 *
 * **Glyph placement.** The glyph leads the word. In a column of statuses —
 * sibling rows shown together, each with a status against the same end
 * edge and changing state independently, as the tool calls in an agent
 * turn do — `glyphPlacement="end"` puts it after the word, so the glyphs
 * line up along that edge instead of shifting with each word's length. A
 * status that merely sits at the end of its row, menu item or card keeps
 * the glyph first.
 *
 * **Hiding the word.** `isLabelHidden` draws the glyph alone, with the
 * word as its accessible name and native tooltip. Inside a `MarkerTrigger`
 * with an explanation, the explanation is the only tooltip. Use it where the surface already
 * says what the status is about: a table's status column, a trace tree row
 * or an experiment's name cell, and an agent turn's tool calls. A card or
 * header that names the thing keeps the word.
 *
 * **Glyph size.** The glyph is always 1.2 times the font size it is drawn
 * in, the ratio `Icon` uses. With the word shown, the status sets its own
 * 12px text, so the glyph is always 14.4px. With the word hidden, it takes
 * the font size of the text around it, so in a 14px table cell it is 16.8px,
 * the size of the cell's other icons. Size a hidden-label glyph by setting
 * its container's font size, never by overriding the glyph.
 *
 * **Quiet.** In a dense list of routine statuses, such as an agent turn's
 * tool calls, `isQuiet` draws `running`, `recording` and `succeeded` in the
 * neutral glyph color, so a failure or a question stands out.
 *
 * A status is never its own hit target. One that explains itself or acts
 * goes inside a `MarkerTrigger`, which draws only a focus ring; the status
 * draws the trigger's state. An explained status takes a dotted underline,
 * and any triggered status takes a solid one while hovered or pressed; a
 * glyph with its word hidden takes a tinted backing instead. A status that
 * opens a page goes in a link `MarkerTrigger` (`href`), never one whose
 * `onPress` navigates.
 * Hover is not shown here, since these stories cannot hold it.
 */
const meta: Meta = {
  title: "Design System/Badges/Status Indicator",
  component: StatusIndicator,
  subcomponents: { MarkerTrigger, SpanStatusIndicator, ExperimentStatus },
  tags: ["updated", "unreviewed", "incomplete"],
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
  { label: "running", code: true, text: "Running" },
  { label: "recording", code: true, text: "Recording" },
  { label: "needs-input", code: true, text: "Awaiting approval" },
  { label: "succeeded", code: true, text: "Completed" },
  { label: "failed", code: true, text: "Error" },
  { label: "stopped", code: true, text: "Stopped" },
  { label: "denied", code: true, text: "Denied" },
  { label: "needs-credentials", code: true, text: "Needs credentials" },
  { label: "disabled", code: true, text: "Disabled" },
  { label: "unavailable", code: true, text: "Not installed" },
  { label: "unset", code: true, text: "Unset" },
];

const CONTENT: {
  label: string;
  category: StatusCategory;
  text: string;
  detail?: string;
}[] = [
  { label: "Bare", category: "running", text: "Downloading" },
  {
    label: "Detail",
    category: "running",
    text: "Downloading",
    detail: "42%",
  },
];

const LENGTHS: {
  label: string;
  category: StatusCategory;
  text: string;
  detail?: string;
}[] = [
  { label: "Empty", category: "unset", text: "" },
  { label: "Regular", category: "needs-input", text: "Awaiting approval" },
  {
    label: "Long",
    category: "needs-credentials",
    text: "Needs credentials",
    detail: "Missing an API key for the sandbox provider",
  },
];

const constrainedCSS = css`
  width: 160px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const Default: StoryFn = () => (
  <StatusIndicator category="running" label="Running" />
);
Default.tags = ["!dev"];

const APPEARANCES: {
  label: string;
  code?: true;
  isLabelHidden: boolean;
  isQuiet: boolean;
}[] = [
  { label: "Default", isLabelHidden: false, isQuiet: false },
  { label: "isLabelHidden", code: true, isLabelHidden: true, isQuiet: false },
  { label: "isQuiet", code: true, isLabelHidden: false, isQuiet: true },
];

export const Categories: StoryFn = () => (
  <OptionGrid
    rows={CATEGORIES}
    columns={APPEARANCES}
    renderCell={(category, appearance) => (
      <StatusIndicator
        category={category.label}
        label={category.text}
        isLabelHidden={appearance?.isLabelHidden}
        isQuiet={appearance?.isQuiet}
      />
    )}
  />
);
Categories.tags = ["!dev"];
Categories.parameters = { themeLayout: "column" };

const domainStatusesCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
`;

export const DomainSpan: StoryFn = () => (
  <div css={domainStatusesCSS}>
    <SpanStatusIndicator statusCode="OK" />
    <SpanStatusIndicator statusCode="ERROR" />
    <SpanStatusIndicator statusCode="UNSET" />
  </div>
);
DomainSpan.storyName = "Domain: Span";
DomainSpan.tags = ["!dev"];
DomainSpan.parameters = { themeLayout: "row" };

export const DomainExperiment: StoryFn = () => (
  <div css={domainStatusesCSS}>
    <ExperimentStatus status="RUNNING" />
    <ExperimentStatus status="COMPLETED" />
    <ExperimentStatus status="ERROR" />
    <ExperimentStatus status="STOPPED" />
    <ExperimentStatus status={null} />
  </div>
);
DomainExperiment.storyName = "Domain: Experiment";
DomainExperiment.tags = ["!dev"];
DomainExperiment.parameters = { themeLayout: "row" };

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

const PLACEMENTS: { label: "start" | "end"; code: true }[] = [
  { label: "start", code: true },
  { label: "end", code: true },
];

const COLUMN_STATUSES: { category: StatusCategory; label: string }[] = [
  { category: "succeeded", label: "Done" },
  { category: "failed", label: "Failed" },
  { category: "running", label: "Running" },
  { category: "needs-input", label: "Awaiting approval" },
  { category: "denied", label: "Denied" },
];

const statusColumnCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--global-dimension-size-100);
  width: 160px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const GlyphPlacement: StoryFn = () => (
  <OptionGrid
    columns={PLACEMENTS}
    renderCell={(_, placement) => (
      <div css={statusColumnCSS}>
        {COLUMN_STATUSES.map((status) => (
          <StatusIndicator
            key={status.category}
            category={status.category}
            label={status.label}
            glyphPlacement={placement?.label}
          />
        ))}
      </div>
    )}
  />
);
GlyphPlacement.tags = ["!dev"];
GlyphPlacement.parameters = { themeLayout: "column" };

const TRIGGERS: {
  label: string;
  render: (isDisabled: boolean) => ReactNode;
}[] = [
  {
    label: "Explanation",
    render: (isDisabled) => (
      <MarkerTrigger
        explanation="Install Phoenix with the `e2b` extra."
        isDisabled={isDisabled}
      >
        <StatusIndicator category="unavailable" label="Not installed" />
      </MarkerTrigger>
    ),
  },
  {
    label: "Action",
    render: (isDisabled) => (
      <MarkerTrigger
        aria-label="Show error details"
        onPress={fn()}
        isDisabled={isDisabled}
      >
        <StatusIndicator category="failed" label="Error" />
      </MarkerTrigger>
    ),
  },
  {
    label: "Link",
    render: (isDisabled) =>
      isDisabled ? null : (
        <MarkerTrigger
          aria-label="Error: view experiment details"
          href="/"
          explanation="Experiment encountered an error during execution"
        >
          <StatusIndicator category="failed" label="Error" />
        </MarkerTrigger>
      ),
  },
];

const TRIGGER_STATES: { label: string; isDisabled: boolean }[] = [
  { label: "Enabled", isDisabled: false },
  { label: "Disabled", isDisabled: true },
];

/**
 * An explanation's open state belongs to its trigger, so it cannot be held
 * open here: hover, focus or press an explanation to show it. A link has no
 * disabled state.
 */
export const InATrigger: StoryFn = () => (
  <OptionGrid
    rows={TRIGGERS}
    columns={TRIGGER_STATES}
    renderCell={(trigger, state) => trigger.render(state?.isDisabled ?? false)}
  />
);
InATrigger.storyName = "In a Trigger";
InATrigger.tags = ["!dev"];
InATrigger.parameters = { themeLayout: "column" };

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
      <StatusIndicator category="stopped" label="Stopped" />
      <StatusIndicator category="succeeded" label="Completed" />
      <StatusIndicator category="running" label="Running" />
      <StatusIndicator category="failed" label="Error" />
      <StatusIndicator category="needs-input" label="Awaiting approval" />
      <StatusIndicator category="disabled" label="Disabled" />
    </div>
  ),
};
