import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { IDBadge, TitleWithID } from "@phoenix/components";
import type { ComponentSize } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * An entity's ID that copies itself to the clipboard when pressed. It is the
 * only copy affordance an ID needs; do not put a separate copy button beside
 * it.
 *
 * - **badge** — an ID that stands on its own, such as beside a page title
 *   (`TitleWithID`)
 * - **quiet** — an ID set among other metadata, such as a span header or an
 *   experiment row
 *
 * Hovering the ID shows a tooltip, which `tooltipText` names after the
 * entity (`Copy ID` by default). Pressing it copies the ID, and for two
 * seconds the tooltip reads `Copied` and the copy icon becomes a checkmark.
 *
 * `size` applies only to `badge`; a quiet ID renders the same at every size.
 */
const meta: Meta = {
  title: "Design System/Badges/ID Badge",
  component: IDBadge,
  subcomponents: { TitleWithID },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const SPAN_ID = "c5b943dba87507a2";

const VARIANTS: { label: "badge" | "quiet"; code: true }[] = [
  { label: "badge", code: true },
  { label: "quiet", code: true },
];

const SIZES: { label: ComponentSize; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
  { label: "L", code: true },
];

const LENGTHS: { label: string; id: string }[] = [
  { label: "Empty", id: "" },
  { label: "1 character", id: "7" },
  { label: "Span ID", id: SPAN_ID },
  { label: "Trace ID", id: "0f6b1e2c9a8d4b7e5c3a1f0e9d8c7b6a" },
  {
    label: "Long external ID",
    id: "support-ticket-regression-2026-09-escalation-0147",
  },
];

export const Default: StoryFn = () => <IDBadge id={SPAN_ID} />;
Default.tags = ["!dev"];

export const SizesAndVariants: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    columns={VARIANTS}
    renderCell={(size, variant) => (
      <IDBadge id={SPAN_ID} variant={variant?.label} size={size.label} />
    )}
  />
);
SizesAndVariants.tags = ["!dev"];
SizesAndVariants.parameters = { themeLayout: "column" };

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={VARIANTS}
    renderCell={(length, variant) => (
      <IDBadge id={length.id} variant={variant?.label} />
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <IDBadge id={SPAN_ID} />
      <IDBadge id={SPAN_ID} variant="quiet" />
    </div>
  ),
};
