import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { StatusCategory } from "@phoenix/components";
import { StatusIndicator } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

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
 * labels are open: a new domain adds words, never a glyph. A value that fits
 * no category is usually two axes, such as a lifecycle and an outcome, each
 * in its own slot. Extra facts go in `detail`, never in a new category.
 *
 * The word is never hidden: the glyphs alone do not tell the categories
 * apart. Where space is tight, mark only the statuses worth noticing, as a
 * trace tree row marks a failed span and leaves the rest unmarked.
 */
const meta: Meta = {
  title: "Design System/Badges/Status Indicator",
  component: StatusIndicator,
  tags: ["updated", "unreviewed", "complete"],
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
  { label: "needs-input", code: true, text: "Authentication required" },
  { label: "paused", code: true, text: "Paused" },
  { label: "succeeded", code: true, text: "Completed" },
  { label: "failed", code: true, text: "Error" },
  { label: "stopped", code: true, text: "Stopped" },
  { label: "warning", code: true, text: "Degraded" },
  { label: "off", code: true, text: "Not installed" },
  { label: "unknown", code: true, text: "Unset" },
];

const CONTENT: {
  label: string;
  category: StatusCategory;
  text: string;
  detail?: string;
}[] = [
  { label: "Bare", category: "active", text: "Downloading" },
  {
    label: "Detail",
    category: "active",
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
