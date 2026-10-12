import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Badge, Icon, Icons } from "@phoenix/components";
import type {
  BadgeOverflowMode,
  BadgeProps,
  BadgeVariant,
} from "@phoenix/components/core/badge";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A compact status or metadata label. Choose the variant from what the label
 * means, so its color conveys that meaning at a glance:
 *
 * - **default** (neutral) — archived, deleted, paused, draft, not started, ended
 * - **info** (informative) — active, in use, live, published
 * - **success** (positive) — approved, complete, success, new, purchased, licensed
 * - **warning** (notice) — pending, request, needs review, expiring
 * - **danger** (negative) — error, alert, rejected, failed
 *
 * `S` is the default size and the one most pages need; use `M` and `L`
 * sparingly, to set a badge apart from the ones around it.
 */
const meta: Meta = {
  title: "Design System/Badges/Badge",
  component: Badge,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const VARIANTS: {
  label: BadgeVariant;
  code: true;
  text: string;
  icon: ReactNode;
}[] = [
  { label: "default", code: true, text: "Paused", icon: <Icons.StopCircle /> },
  { label: "info", code: true, text: "Active", icon: <Icons.Info /> },
  {
    label: "success",
    code: true,
    text: "Approved",
    icon: <Icons.CheckmarkCircle />,
  },
  {
    label: "warning",
    code: true,
    text: "Pending",
    icon: <Icons.AlertTriangle />,
  },
  { label: "danger", code: true, text: "Failed", icon: <Icons.CloseCircle /> },
];

const SIZES: { label: BadgeProps["size"] & string; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
  { label: "L", code: true },
];

const CONTENT: { label: string; withIcon: boolean }[] = [
  { label: "Text", withIcon: false },
  { label: "Leading icon", withIcon: true },
];

const OVERFLOW_MODES: { label: BadgeOverflowMode; code: true }[] = [
  { label: "wrap", code: true },
  { label: "truncate", code: true },
];

const LENGTHS: { label: string; text: string }[] = [
  { label: "Empty", text: "" },
  { label: "1 character", text: "3" },
  { label: "Regular", text: "Active" },
  { label: "Long", text: "24 days left in trial" },
];

export const Default: StoryFn = () => <Badge>Archived</Badge>;
Default.tags = ["!dev"];

export const VariantsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={SIZES}
    renderCell={(variant, size) => (
      <Badge variant={variant.label} size={size?.label}>
        {variant.text}
      </Badge>
    )}
  />
);
VariantsAndSizes.tags = ["!dev"];
VariantsAndSizes.parameters = { themeLayout: "column" };

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={SIZES}
    renderCell={(content, size) => (
      <Badge variant="success" size={size?.label}>
        {content.withIcon ? <Icon svg={<Icons.CheckmarkCircle />} /> : null}
        Approved
      </Badge>
    )}
  />
);
ContentAndSizes.tags = ["!dev"];
ContentAndSizes.parameters = { themeLayout: "column" };

export const ContentAndVariants: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={CONTENT}
    renderCell={(variant, content) => (
      <Badge variant={variant.label}>
        {content?.withIcon ? <Icon svg={variant.icon} /> : null}
        {variant.text}
      </Badge>
    )}
  />
);
ContentAndVariants.tags = ["!dev"];
ContentAndVariants.parameters = { themeLayout: "column" };

const containerCSS = css`
  width: 100%;
`;

/**
 * The badge wraps a label too long for its container by default.
 * `overflowMode="truncate"` is meant to keep it on one line with an
 * ellipsis, but it only stops the wrap: the badge grows past its container
 * to the full width of its label and shows no ellipsis.
 */
export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={OVERFLOW_MODES}
    columns={LENGTHS}
    cellWidth="80px"
    alignRows="start"
    renderCell={(overflowMode, length) => (
      <div css={containerCSS}>
        <Badge variant="info" overflowMode={overflowMode.label}>
          {length?.text}
        </Badge>
      </div>
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

const thumbnailRowCSS = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--global-dimension-size-100);
`;

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div css={thumbnailRowCSS}>
      {VARIANTS.map((variant) => (
        <Badge key={variant.label} variant={variant.label}>
          {variant.text}
        </Badge>
      ))}
    </div>
  ),
};
