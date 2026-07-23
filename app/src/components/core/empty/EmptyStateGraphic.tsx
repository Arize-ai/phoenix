import { css } from "@emotion/react";
import type { SerializedStyles } from "@emotion/react";
import { useId } from "react";
import type { ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components/core/icon";

/**
 * The decorative "stacked cards" graphic shown above an {@link EmptyState}.
 *
 * The composition (three stacked cards, edge fades, drop shadows) is identical
 * across light and dark themes — only the colors change — so the colors are
 * expressed as theme-scoped CSS custom properties that flip under
 * `.theme--dark`. The focal (middle) card holds an icon; the size of the
 * composition and which icon appears are not free-form — every empty state in
 * the app is one of the named {@link EmptyStateGraphicVariant}s enumerated in
 * {@link EMPTY_STATE_GRAPHICS} below, so a given region/topic always looks the
 * same wherever it appears.
 */

/** The two encoded compositions and the size each renders at. */
export type EmptyStateGraphicSize = "large" | "small";

interface EmptyStateGraphicSpec {
  /** Which encoded composition (and thus icon size) to render. */
  size: EmptyStateGraphicSize;
  /**
   * The icon for the focal card. Typically a Phoenix `<Icon>` element — it
   * inherits the graphic's icon color and is sized to fit the slot.
   */
  icon: ReactNode;
}

/**
 * Canonical empty-state graphics, keyed by the region/topic they belong to.
 * Each entry pins both the icon and the size, so a given surface looks the same
 * everywhere it appears and the noun→icon mapping cannot drift.
 *
 * To add a surface, add an entry here — see the phoenix-design skill
 * (`rules/empty-states.md`). `genericAdd` is the fallback for surfaces that do
 * not (yet) warrant their own entry. The `satisfies` checks every value against
 * {@link EmptyStateGraphicSpec} while keeping the keys as literals, so
 * {@link EmptyStateGraphicVariant} is derived from them and the type and the
 * table can never disagree.
 */
// Tags, labels, and splits are the same concept for empty-state purposes, so
// they share one spec — three discoverable keys, one source of truth.
const tagSpec: EmptyStateGraphicSpec = {
  size: "small",
  icon: <Icon svg={<Icons.PriceTags />} />,
};

const EMPTY_STATE_GRAPHICS = {
  // Generic action prompts. `genericAdd` is the fallback for surfaces without
  // their own entry.
  genericAdd: { size: "small", icon: <Icon svg={<Icons.Plus />} /> },
  genericEdit: { size: "small", icon: <Icon svg={<Icons.Edit />} /> },
  // Domain surfaces.
  trace: { size: "large", icon: <Icon svg={<Icons.Trace />} /> },
  dataset: { size: "large", icon: <Icon svg={<Icons.Database />} /> },
  evaluator: { size: "large", icon: <Icon svg={<Icons.Scale />} /> },
  session: {
    size: "large",
    icon: <Icon svg={<Icons.MessagesSquare />} />,
  },
  experiment: {
    size: "large",
    icon: <Icon svg={<Icons.Experiment />} />,
  },
  prompt: { size: "large", icon: <Icon svg={<Icons.LLMOutput />} /> },
  project: { size: "large", icon: <Icon svg={<Icons.Folder />} /> },
  annotation: { size: "small", icon: <Icon svg={<Icons.ThumbsUp />} /> },
  customAIProvider: {
    size: "small",
    icon: <Icon svg={<Icons.Sparkle />} />,
  },
  // The flag glyph is the intended icon for events (added to Icons.tsx).
  event: {
    size: "small",
    icon: <Icon svg={<Icons.FlagTriangleRight />} />,
  },
  attribute: { size: "small", icon: <Icon svg={<Icons.Info />} /> },
  config: { size: "small", icon: <Icon svg={<Icons.Settings />} /> },
  credential: { size: "small", icon: <Icon svg={<Icons.Key />} /> },
  version: { size: "small", icon: <Icon svg={<Icons.GitBranch />} /> },
  tag: tagSpec,
  label: tagSpec,
  split: tagSpec,
} satisfies Record<string, EmptyStateGraphicSpec>;

/** The set of named empty-state graphics, derived from {@link EMPTY_STATE_GRAPHICS}. */
export type EmptyStateGraphicVariant = keyof typeof EMPTY_STATE_GRAPHICS;

/** All variant names, for iteration (stories, tests, Storybook controls). */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys widens to string[]; keys are exactly the variant names
export const EMPTY_STATE_GRAPHIC_VARIANTS = Object.keys(
  EMPTY_STATE_GRAPHICS
) as EmptyStateGraphicVariant[];

/**
 * The render size each variant maps to, derived from the canonical table.
 * Exposed for iteration (e.g. grouping variants by size in stories/docs).
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries widens keys/values; entries come from the canonical table
export const EMPTY_STATE_GRAPHIC_SIZES = Object.fromEntries(
  Object.entries(EMPTY_STATE_GRAPHICS).map(([variant, spec]) => [
    variant,
    spec.size,
  ])
) as Record<EmptyStateGraphicVariant, EmptyStateGraphicSize>;

export interface EmptyStateGraphicProps {
  /**
   * Which canonical empty-state graphic to render.
   * @default "genericAdd"
   */
  variant?: EmptyStateGraphicVariant;
}

/**
 * Theme-aware colors for the graphic. Light values are taken verbatim from the
 * source SVGs; dark values come from the dark large variant and are reused for
 * the (inferred) dark small variant, since both share the same color roles. The
 * dot color, which only appears in the small variant, is the one inferred value:
 * it sits between the bar and icon colors, mirroring its placement in light.
 */
const colorsCSS = css`
  --esg-card-bg: #fdfdfd;
  --esg-stroke: #e2e2e2;
  --esg-stroke-subtle: #ededed;
  --esg-bar: #e2e2e2;
  --esg-icon: #a8a8a8;
  --esg-dots: #cfcfcf;

  .theme--dark & {
    --esg-card-bg: #101010;
    --esg-stroke: #232323;
    --esg-stroke-subtle: #232323;
    --esg-bar: #1b1b1b;
    --esg-icon: #424242;
    --esg-dots: #282828;
  }
`;

/**
 * Fades the top and bottom edges of the graphic to true transparency, so the
 * stacked cards appear to continue beyond the frame. The original design baked
 * this in as gradient rectangles painted in the (hardcoded) page background
 * color; masking the content instead is background-independent — whatever sits
 * behind the graphic shows through the faded edges. `top`/`bottom` are the
 * fade-band heights as a percentage of the graphic's height, taken from the
 * original overlay geometry.
 */
const edgeFadeMaskCSS = (top: string, bottom: string): SerializedStyles => {
  const mask = `linear-gradient(
    to bottom,
    transparent 0,
    #000 ${top},
    #000 calc(100% - ${bottom}),
    transparent 100%
  )`;
  return css`
    -webkit-mask-image: ${mask};
    mask-image: ${mask};
  `;
};

/**
 * The faded bottom edge reads as empty space, so tuck the graphic into whatever
 * follows it (e.g. an EmptyState's title) rather than stacking a full gap on top
 * of that implicit whitespace.
 */
const tuckCSS = css`
  display: block;
  margin-bottom: calc(-1 * var(--global-dimension-size-200));
`;

const iconSlotCSS = (slotSize: number): SerializedStyles => css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--esg-icon);
  svg {
    width: ${slotSize}px;
    height: ${slotSize}px;
    display: block;
  }
`;

/** A drop shadow matching the design's `filter*_d` definitions (dy 4, blur 6, 19% black). */
function DropShadow({
  id,
  x,
  y,
  width,
  height,
}: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <filter
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      filterUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feColorMatrix
        in="SourceAlpha"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        result="hardAlpha"
      />
      <feOffset dy="4" />
      <feGaussianBlur stdDeviation="6" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.19 0"
      />
      <feBlend
        mode="normal"
        in2="BackgroundImageFix"
        result="effect1_dropShadow"
      />
      <feBlend
        mode="normal"
        in="SourceGraphic"
        in2="effect1_dropShadow"
        result="shape"
      />
    </filter>
  );
}

function IconSlot({
  x,
  y,
  size,
  icon,
}: {
  x: number;
  y: number;
  size: number;
  icon: ReactNode;
}) {
  return (
    <foreignObject x={x} y={y} width={size} height={size}>
      <div css={iconSlotCSS(size)}>{icon}</div>
    </foreignObject>
  );
}

function LargeGraphic({ icon, ids }: { icon: ReactNode; ids: Ids }) {
  return (
    <svg
      width="198"
      height="158"
      viewBox="0 0 198 158"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      css={[colorsCSS, edgeFadeMaskCSS("34%", "34%"), tuckCSS]}
    >
      <g filter={`url(#${ids.f0})`}>
        <rect
          x="19"
          y="10"
          width="160"
          height="32"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="19.5"
          y="10.5"
          width="159"
          height="31"
          rx="7.5"
          stroke="var(--esg-stroke)"
          shapeRendering="crispEdges"
        />
        <rect
          opacity="0.68"
          x="31"
          y="22"
          width="136"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <g filter={`url(#${ids.f1})`}>
        <rect
          x="12"
          y="52"
          width="174"
          height="48"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="12.5"
          y="52.5"
          width="173"
          height="47"
          rx="7.5"
          stroke="var(--esg-stroke-subtle)"
          shapeRendering="crispEdges"
        />
        {/* Icon slot — replaces the original database glyph (center 34, 76). */}
        <IconSlot x={24} y={66} size={20} icon={icon} />
        <rect
          opacity="0.68"
          x="56"
          y="65"
          width="120"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
        <rect
          opacity="0.68"
          x="56"
          y="79"
          width="80"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <g filter={`url(#${ids.f2})`}>
        <rect
          x="19"
          y="110"
          width="160"
          height="32"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="19.5"
          y="110.5"
          width="159"
          height="31"
          rx="7.5"
          stroke="var(--esg-stroke)"
          shapeRendering="crispEdges"
        />
        <rect
          opacity="0.68"
          x="31"
          y="122"
          width="136"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <defs>
        <DropShadow id={ids.f0} x={7} y={2} width={184} height={56} />
        <DropShadow id={ids.f1} x={0} y={44} width={198} height={72} />
        <DropShadow id={ids.f2} x={7} y={102} width={184} height={56} />
      </defs>
    </svg>
  );
}

function SmallGraphic({ icon, ids }: { icon: ReactNode; ids: Ids }) {
  return (
    <svg
      width="198"
      height="140"
      viewBox="0 0 198 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      css={[colorsCSS, edgeFadeMaskCSS("38%", "31%"), tuckCSS]}
    >
      <g filter={`url(#${ids.f0})`}>
        <rect
          x="12"
          y="8"
          width="174"
          height="32"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="12.5"
          y="8.5"
          width="173"
          height="31"
          rx="7.5"
          stroke="var(--esg-stroke)"
          shapeRendering="crispEdges"
        />
        <path
          d="M27.75 22.5C28.5784 22.5 29.25 23.1716 29.25 24C29.25 24.8284 28.5784 25.5 27.75 25.5C26.9216 25.5 26.25 24.8284 26.25 24C26.25 23.1716 26.9216 22.5 27.75 22.5Z"
          fill="var(--esg-dots)"
        />
        <path
          d="M33 22.5C33.8284 22.5 34.5 23.1716 34.5 24C34.5 24.8284 33.8284 25.5 33 25.5C32.1716 25.5 31.5 24.8284 31.5 24C31.5 23.1716 32.1716 22.5 33 22.5Z"
          fill="var(--esg-dots)"
        />
        <path
          d="M38.25 22.5C39.0784 22.5 39.75 23.1716 39.75 24C39.75 24.8284 39.0784 25.5 38.25 25.5C37.4216 25.5 36.75 24.8284 36.75 24C36.75 23.1716 37.4216 22.5 38.25 22.5Z"
          fill="var(--esg-dots)"
        />
        <rect
          opacity="0.68"
          x="54"
          y="20"
          width="120"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <g filter={`url(#${ids.f1})`}>
        <rect
          x="12"
          y="50"
          width="174"
          height="32"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="12.5"
          y="50.5"
          width="173"
          height="31"
          rx="7.5"
          stroke="var(--esg-stroke-subtle)"
          shapeRendering="crispEdges"
        />
        {/* Icon slot — replaces the original pencil glyph (center 33, 66). */}
        <IconSlot x={25} y={58} size={16} icon={icon} />
        <rect
          opacity="0.68"
          x="54"
          y="62"
          width="120"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <g filter={`url(#${ids.f2})`}>
        <rect
          x="12"
          y="92"
          width="174"
          height="32"
          rx="8"
          fill="var(--esg-card-bg)"
          shapeRendering="crispEdges"
        />
        <rect
          x="12.5"
          y="92.5"
          width="173"
          height="31"
          rx="7.5"
          stroke="var(--esg-stroke)"
          shapeRendering="crispEdges"
        />
        <path
          d="M27.75 106.5C28.5784 106.5 29.25 107.172 29.25 108C29.25 108.828 28.5784 109.5 27.75 109.5C26.9216 109.5 26.25 108.828 26.25 108C26.25 107.172 26.9216 106.5 27.75 106.5Z"
          fill="var(--esg-dots)"
        />
        <path
          d="M33 106.5C33.8284 106.5 34.5 107.172 34.5 108C34.5 108.828 33.8284 109.5 33 109.5C32.1716 109.5 31.5 108.828 31.5 108C31.5 107.172 32.1716 106.5 33 106.5Z"
          fill="var(--esg-dots)"
        />
        <path
          d="M38.25 106.5C39.0784 106.5 39.75 107.172 39.75 108C39.75 108.828 39.0784 109.5 38.25 109.5C37.4216 109.5 36.75 108.828 36.75 108C36.75 107.172 37.4216 106.5 38.25 106.5Z"
          fill="var(--esg-dots)"
        />
        <rect
          opacity="0.68"
          x="54"
          y="104"
          width="120"
          height="8"
          rx="3"
          fill="var(--esg-bar)"
        />
      </g>
      <defs>
        <DropShadow id={ids.f0} x={0} y={0} width={198} height={56} />
        <DropShadow id={ids.f1} x={0} y={42} width={198} height={56} />
        <DropShadow id={ids.f2} x={0} y={84} width={198} height={56} />
      </defs>
    </svg>
  );
}

interface Ids {
  f0: string;
  f1: string;
  f2: string;
}

export function EmptyStateGraphic({
  variant = "genericAdd",
}: EmptyStateGraphicProps) {
  const { size, icon } = EMPTY_STATE_GRAPHICS[variant];

  // Namespace filter ids so multiple instances on one page don't collide.
  const uid = useId();
  const ids: Ids = {
    f0: `${uid}-f0`,
    f1: `${uid}-f1`,
    f2: `${uid}-f2`,
  };

  return size === "small" ? (
    <SmallGraphic icon={icon} ids={ids} />
  ) : (
    <LargeGraphic icon={icon} ids={ids} />
  );
}
