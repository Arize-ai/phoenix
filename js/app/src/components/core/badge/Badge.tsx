import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts/ThemeContext";
import { classNames } from "@phoenix/utils/classNames";

import { derivedColorCSS, inheritedStateCSS } from "../styles";
import type { BadgeProps } from "./types";

const badgeCSS = css`
  ${derivedColorCSS};
  ${inheritedStateCSS};
  display: inline-flex;
  align-items: center;
  gap: var(--global-badge-gap);
  border-radius: var(--global-badge-border-radius);
  white-space: normal;
  box-sizing: border-box;

  &[data-overflow-mode="truncate"] {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Sizes. Line heights are paired with the font sizes so the badge keeps
     its own compact line box instead of stretching to a line-height
     inherited from surrounding text. */
  &[data-size="S"] {
    font-size: var(--global-badge-font-size-s);
    line-height: var(--global-line-height-xs);
    padding: var(--global-badge-padding-y-s) var(--global-badge-padding-x-s);
  }
  &[data-size="M"] {
    font-size: var(--global-badge-font-size-m);
    line-height: var(--global-line-height-s);
    padding: var(--global-badge-padding-y-m) var(--global-badge-padding-x-m);
  }
  &[data-size="L"] {
    font-size: var(--global-badge-font-size-l);
    line-height: var(--global-line-height-m);
    padding: var(--global-badge-padding-y-l) var(--global-badge-padding-x-l);
  }

  /* Variants */
  &[data-variant="info"] {
    --family-base-color: var(--global-color-info);
  }
  &[data-variant="success"] {
    --family-base-color: var(--global-color-success);
  }
  &[data-variant="warning"] {
    --family-base-color: var(--global-color-warning);
  }
  &[data-variant="danger"] {
    --family-base-color: var(--global-color-danger);
  }
`;

export const Badge = ({
  children,
  variant = "default",
  size = "S",
  overflowMode = "wrap",
  css: propCSS,
  className,
  ...otherProps
}: BadgeProps) => {
  const { theme } = useTheme();

  return (
    <span
      {...otherProps}
      css={css(badgeCSS, propCSS)}
      data-variant={variant}
      data-size={size}
      data-overflow-mode={overflowMode}
      data-theme={theme}
      // The emotion jsx transform delivers a caller's `css` prop as
      // `className`, so it must be merged, not overwritten.
      className={classNames("badge", className)}
    >
      {children}
    </span>
  );
};
