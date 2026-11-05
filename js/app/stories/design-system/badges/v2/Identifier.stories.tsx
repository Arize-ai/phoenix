import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Icon, Icons } from "@phoenix/components";
import {
  Identifier,
  Tag,
  TagGroup,
  type TagGroupItem,
} from "@phoenix/components/core/v2";

import { OptionGrid } from "../../../utils/OptionGrid";

/**
 * An Identifier: the machine name of a thing, such as a trace ID, set in
 * monospace. It sits beside the badge family rather than in it: it has no
 * container, no color and no tone, because an ID classifies, counts and
 * judges nothing.
 *
 * A long value truncates in the middle and keeps its last six characters,
 * which usually tell it apart from its neighbors; the full value stays in
 * the native tooltip. `copyNoun` makes it a quiet button that copies the
 * value ("Copy trace ID"), and the copy icon turns into a check once
 * copied; that state lasts two seconds after a press and cannot be held
 * here. An empty value renders nothing.
 *
 * Inside another control it is plain text: a `Tag` for an object with no
 * name of its own, such as a trace in the assistant's context, takes the
 * identifier as its name (`isIdentifier` on a `TagGroup` item), and the tag
 * owns the press.
 */
const meta: Meta = {
  title: "Design System/Badges/V2/Identifier",
  component: Identifier,
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

const CONTEXT: TagGroupItem[] = [
  {
    id: "trace",
    label: TRACE_ID,
    isIdentifier: true,
    leadingVisual: <Icon svg={<Icons.Trace />} />,
  },
  {
    id: "span",
    label: SPAN_ID,
    isIdentifier: true,
    leadingVisual: <Icon svg={<Icons.Span />} />,
  },
  {
    id: "dataset",
    label: "Golden questions",
    leadingVisual: <Icon svg={<Icons.Database />} />,
  },
];

/**
 * The assistant's attached context: a trace and a span have no names, so
 * their tags carry identifiers; a dataset carries its name.
 */
export const InATag: StoryFn = () => (
  <TagGroup
    aria-label="Context"
    items={CONTEXT}
    itemMaxWidth="180px"
    onAction={fn()}
    onRemove={fn()}
  />
);
InATag.tags = ["!dev"];

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
      <Tag leadingVisual={<Icon svg={<Icons.Trace />} />} maxWidth="180px">
        <Identifier value={TRACE_ID} />
      </Tag>
    </div>
  ),
};
