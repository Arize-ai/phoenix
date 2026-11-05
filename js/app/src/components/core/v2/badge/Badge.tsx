import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { useTheme } from "@phoenix/contexts/ThemeContext";

import {
  derivedColorCSS,
  familySizeCSS,
  inheritedStateCSS,
  truncatedTextCSS,
} from "../styles";
import type { FamilySize } from "../types";

/**
 * The categorical hues a nominal Kind may take. Green, orange and red are left
 * out because they are the success, warning and danger variants: a green span
 * kind would read as "OK".
 */
export const BADGE_COLORS = [
  "neutral",
  "blue",
  "cyan",
  "indigo",
  "purple",
  "fuchsia",
  "magenta",
  "seafoam",
  "chartreuse",
  "yellow",
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];

/**
 * The variants an evaluative Kind may take, each meaning what it means
 * everywhere else in Phoenix: good, worth knowing, caution, harm.
 */
export const BADGE_VARIANTS = ["success", "info", "warning", "danger"] as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

interface BadgeBaseProps {
  /**
   * The classification, one value from a closed set.
   */
  children: ReactNode;
  /**
   * `S` inside menu items and pickers; `M` everywhere else, table cells
   * included.
   * @default "M"
   */
  size?: FamilySize;
  /**
   * An icon set before the label.
   */
  leadingVisual?: ReactNode;
}

interface NominalBadgeProps extends BadgeBaseProps {
  /**
   * The categorical hue that identifies this value of a nominal axis, one
   * that names a type.
   * @default "neutral"
   */
  color?: BadgeColor;
  variant?: never;
}

interface EvaluativeBadgeProps extends BadgeBaseProps {
  /**
   * The judgment this value of an evaluative axis makes. Every value of the
   * axis takes a variant; its unremarkable value is a neutral `color`.
   */
  variant: BadgeVariant;
  color?: never;
}

export type BadgeProps = NominalBadgeProps | EvaluativeBadgeProps;

const badgeCSS = css`
  ${familySizeCSS};
  ${derivedColorCSS};
  ${inheritedStateCSS};
  border-radius: var(--global-rounding-large);

  &[data-color="neutral"] {
    --family-base-color: var(--global-color-gray-600);
  }
  ${BADGE_COLORS.filter((color) => color !== "neutral")
    .map(
      (color) =>
        `&[data-color="${color}"] { --family-base-color: var(--global-color-${color}-500); }`
    )
    .join("\n")}
  ${BADGE_VARIANTS.map(
    (variant) =>
      `&[data-variant="${variant}"] { --family-base-color: var(--global-color-${variant}); }`
  ).join("\n")}

  .badge-v2__leading-visual {
    display: flex;
    flex: none;
    font-size: 1em;
  }
  .badge-v2__text {
    ${truncatedTextCSS};
  }
`;

/**
 * A Kind: the classification of a thing, one value from a closed set. Round,
 * because it is a property of the thing it sits on. A nominal axis, such as
 * span kind, names a type and takes a categorical `color`; an evaluative
 * axis, such as a recommendation, judges the thing and takes a `variant`.
 *
 * A Badge is never its own hit target and is never focusable. To open detail
 * from one, put it inside a `MarkerTrigger`; the Badge then shows the
 * trigger's hover and pressed state. To filter by a kind, give the cell, row
 * or a menu the affordance, not the Badge.
 */
export function Badge({
  children,
  color = "neutral",
  variant,
  size = "M",
  leadingVisual,
}: BadgeProps) {
  const { theme } = useTheme();
  return (
    <span
      className="badge-v2"
      css={badgeCSS}
      data-color={variant ? undefined : color}
      data-variant={variant}
      data-size={size}
      data-theme={theme}
    >
      {leadingVisual ? (
        <span className="badge-v2__leading-visual" aria-hidden>
          {leadingVisual}
        </span>
      ) : null}
      <span className="badge-v2__text">{children}</span>
    </span>
  );
}
