import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Identifier, TitleWithID } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * An Identifier: the machine name of a thing, such as a trace ID, set in
 * monospace. It sits beside the badge family rather than in it: it has no
 * container, no color and no tone, because an ID classifies, counts and
 * judges nothing. It takes its size and color from the surrounding text.
 *
 * A long value truncates in the middle and keeps its last six characters,
 * which usually tell it apart from its neighbors; the full value stays in
 * the native tooltip. `copyNoun` makes it a quiet button that copies the
 * value ("Copy trace ID"), and the copy icon turns into a check once
 * copied; that state lasts two seconds after a press and cannot be held
 * here. An empty value renders nothing.
 *
 * Inside another control, such as a menu item or a select option, it is
 * plain text: leave out `copyNoun`, since the control owns the press.
 * `TitleWithID` sets a copyable Identifier beside a dialog or page title.
 *
 * A position such as an experiment's `#3` or a version's `v2` is not an
 * Identifier: nobody pastes it anywhere, so it is ordinary text.
 */
const meta: Meta = {
  title: "Design System/Badges/Identifier",
  component: Identifier,
  subcomponents: { TitleWithID },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const SPAN_ID = "a1f3c09b7e2d4458";
const TRACE_ID = "5b8aa5a2d2c872e8321cf37308d69df2";
const GLOBAL_ID = "UHJvamVjdDox";
const EXTERNAL_ID = "support-ticket-escalation-2026-11-05-eu-west-1";

const LENGTHS: { label: string; value: string }[] = [
  { label: "Empty", value: "" },
  { label: "Global ID", value: GLOBAL_ID },
  { label: "Span ID", value: SPAN_ID },
  { label: "Trace ID", value: TRACE_ID },
  { label: "External ID", value: EXTERNAL_ID },
];

const FORMS: { label: string; copyNoun?: string }[] = [
  { label: "Plain" },
  { label: "Copyable", copyNoun: "ID" },
];

const constrainedCSS = css`
  width: 180px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const Default: StoryFn = () => (
  <Identifier value={TRACE_ID} copyNoun="trace ID" />
);
Default.tags = ["!dev"];

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={FORMS}
    renderCell={(length, form) => (
      <div css={constrainedCSS}>
        <Identifier value={length.value} copyNoun={form?.copyNoun} />
      </div>
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

/**
 * `maxWidth` caps the value without a narrow container.
 */
export const MaxWidth: StoryFn = () => (
  <Identifier value={TRACE_ID} copyNoun="trace ID" maxWidth="140px" />
);
MaxWidth.tags = ["!dev"];

/**
 * A dialog or page title with the ID of the thing it names.
 */
export const BesideATitle: StoryFn = () => (
  <TitleWithID title="Trace" id={TRACE_ID} />
);
BesideATitle.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <Identifier value={TRACE_ID} copyNoun="trace ID" maxWidth="200px" />
      <Identifier value={SPAN_ID} />
    </div>
  ),
};
