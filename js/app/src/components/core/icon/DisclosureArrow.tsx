import { css } from "@emotion/react";

import { classNames } from "@phoenix/utils/classNames";

import type { StylableProps } from "../types";
import { Icon } from "./Icon";
import * as Icons from "./Icons";

const disclosureArrowCSS = css`
  flex: none;
  color: var(--global-text-color-500);
  transition: transform 200ms ease-in-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  transform: rotate(0deg);
  &[data-expanded="true"] {
    transform: rotate(90deg);
  }
  &[data-position="end"] {
    transform: rotate(90deg);
    &[data-expanded="true"] {
      transform: rotate(-90deg);
    }
  }
`;

export interface DisclosureArrowProps extends StylableProps {
  /**
   * Whether the disclosure content is expanded
   */
  isExpanded: boolean;
  className?: string;
  /**
   * Where the arrow sits relative to the label. "start" rotates
   * right → down on expand, "end" rotates down → up.
   * @default "start"
   */
  position?: "start" | "end";
}

/**
 * The canonical expand / collapse affordance. Every disclosure surface
 * (cards, accordions, table row expanders, trees, collapsible panels)
 * renders this single rotating chevron so the gesture reads the same
 * everywhere in the app.
 */
export function DisclosureArrow({
  isExpanded,
  position = "start",
  css: propCSS,
  className,
}: DisclosureArrowProps) {
  return (
    <Icon
      svg={<Icons.ChevronRightSmall />}
      className={classNames("disclosure-arrow", className)}
      css={css(disclosureArrowCSS, propCSS)}
      data-expanded={isExpanded}
      data-position={position}
      aria-hidden="true"
    />
  );
}
