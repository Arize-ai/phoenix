import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Icon, Icons } from "@phoenix/components";
import type {
  BadgeColor,
  BadgeVariant,
  FamilySize,
} from "@phoenix/components/core/v2";
import { Badge as BadgeV2, MarkerTrigger } from "@phoenix/components/core/v2";

import { OptionGrid } from "../../../utils/OptionGrid";

/**
 * A Kind: the classification of a thing, one value from a closed set, such
 * as a span kind, an annotator kind or a model recommendation. Round,
 * because it is a property of the thing it sits on.
 *
 * Every axis is either nominal or evaluative, never both:
 *
 * - **Nominal** axes name a type (span kind, hosting type) and take a
 *   categorical `color`, which encodes identity. Green, orange and red are
 *   not offered, since a green span kind would read as "OK". Use `neutral`
 *   for an axis whose values need no color of their own.
 * - **Evaluative** axes judge the thing (a recommendation, a feature's
 *   maturity) and take a `variant`, which means what it means everywhere else
 *   in Phoenix: good, worth knowing, caution, harm. The axis's unremarkable
 *   value is `neutral`.
 *
 * To tell them apart, remove the judgment: if the value still says
 * something, as "Local" still says where a sandbox runs, the axis is nominal.
 * A value that changes over time, such as "Unavailable", is a status, not a
 * Kind.
 *
 * Use `S` inside menu items and pickers and `M` everywhere else, table cells
 * included.
 *
 * A Badge is never its own hit target and never focusable. When a kind must
 * open detail, put the Badge inside a `MarkerTrigger`: the trigger draws
 * only its focus ring, and the Badge shows the trigger's hover and pressed
 * state, which a static grid cannot hold, so hover and press the triggers in
 * `In a Trigger` to see them. To filter by a kind, give the cell, row or a
 * menu the affordance, never the Badge.
 */
const meta: Meta = {
  title: "Design System/Badges/V2/Badge",
  component: BadgeV2,
  subcomponents: { MarkerTrigger },
  tags: ["updated", "unreviewed", "incomplete", "unused"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const COLORS: { label: BadgeColor; code: true; text: string }[] = [
  { label: "neutral", code: true, text: "System" },
  { label: "blue", code: true, text: "Chain" },
  { label: "cyan", code: true, text: "Code" },
  { label: "indigo", code: true, text: "Embedding" },
  { label: "purple", code: true, text: "LLM" },
  { label: "fuchsia", code: true, text: "Guardrail" },
  { label: "magenta", code: true, text: "Decision" },
  { label: "seafoam", code: true, text: "Retriever" },
  { label: "chartreuse", code: true, text: "Evaluator" },
  { label: "yellow", code: true, text: "Tool" },
];

const VARIANTS: { label: BadgeVariant; code: true; text: string }[] = [
  { label: "success", code: true, text: "Recommended" },
  { label: "info", code: true, text: "Beta" },
  { label: "warning", code: true, text: "Restricted" },
  { label: "danger", code: true, text: "Not recommended" },
];

const SIZES: { label: FamilySize; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

const CONTENT: { label: string; withIcon: boolean }[] = [
  { label: "Text", withIcon: false },
  { label: "Leading visual", withIcon: true },
];

const LENGTHS: { label: string; text: string }[] = [
  { label: "Empty", text: "" },
  { label: "Regular", text: "LLM" },
  { label: "Long", text: "Retriever" },
];

const TRIGGER_STATES: { label: string; isDisabled: boolean }[] = [
  { label: "Enabled", isDisabled: false },
  { label: "Disabled", isDisabled: true },
];

const constrainedCSS = css`
  width: 64px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const Default: StoryFn = () => <BadgeV2 color="purple">LLM</BadgeV2>;
Default.tags = ["!dev"];

export const ColorsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={COLORS}
    columns={SIZES}
    renderCell={(color, size) => (
      <BadgeV2 color={color.label} size={size?.label}>
        {color.text}
      </BadgeV2>
    )}
  />
);
ColorsAndSizes.tags = ["!dev"];
ColorsAndSizes.parameters = { themeLayout: "column" };

export const VariantsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    columns={SIZES}
    renderCell={(variant, size) => (
      <BadgeV2 variant={variant.label} size={size?.label}>
        {variant.text}
      </BadgeV2>
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
      <BadgeV2
        color="blue"
        size={size?.label}
        leadingVisual={
          content.withIcon ? <Icon svg={<Icons.Span />} /> : undefined
        }
      >
        Chain
      </BadgeV2>
    )}
  />
);
ContentAndSizes.tags = ["!dev"];
ContentAndSizes.parameters = { themeLayout: "column" };

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    renderCell={(length) => (
      <div css={constrainedCSS}>
        <BadgeV2 color="seafoam">{length.text}</BadgeV2>
      </div>
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "row" };

export const InATrigger: StoryFn = () => (
  <OptionGrid
    rows={TRIGGER_STATES}
    columns={SIZES}
    renderCell={(state, size) => (
      <MarkerTrigger
        aria-label="Show span kind details"
        isDisabled={state.isDisabled}
        onPress={fn()}
      >
        <BadgeV2 color="purple" size={size?.label}>
          LLM
        </BadgeV2>
      </MarkerTrigger>
    )}
  />
);
InATrigger.tags = ["!dev"];
InATrigger.parameters = { themeLayout: "column" };

/**
 * A Badge that needs explaining takes an `explanation` on its
 * `MarkerTrigger` instead of an action. Hover, focus or press it to show the
 * explanation; the trigger holds its own open state, so it cannot be held
 * open here.
 */
export const WithExplanation: StoryFn = () => (
  <MarkerTrigger explanation="The assistant is in beta — expect changes as it evolves.">
    <BadgeV2 variant="info">Beta</BadgeV2>
  </MarkerTrigger>
);
WithExplanation.tags = ["!dev"];

const thumbnailCSS = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--global-dimension-size-100);
  max-width: 260px;
`;

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div css={thumbnailCSS}>
      {COLORS.slice(0, 8).map((color) => (
        <BadgeV2 key={color.label} color={color.label} size="M">
          {color.text}
        </BadgeV2>
      ))}
    </div>
  ),
};
