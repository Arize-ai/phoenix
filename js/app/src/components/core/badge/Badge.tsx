import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts/ThemeContext";

import type { BadgeProps } from "./types";

const badgeCSS = css`
  --badge-base-color: var(--global-color-gray-600);
  --badge-bg-color: lch(from var(--badge-base-color) 96 calc(c * 0.3) h);
  --badge-border-color: lch(from var(--badge-base-color) 88 calc(c * 0.4) h);
  --badge-text-color: lch(from var(--badge-base-color) 45 c h);

  display: inline-flex;
  align-items: center;
  gap: var(--global-badge-gap);
  border: 1px solid var(--badge-border-color);
  border-radius: var(--global-badge-border-radius);
  background-color: var(--badge-bg-color);
  color: var(--badge-text-color);
  white-space: normal;
  box-sizing: border-box;

  &[data-overflow-mode="truncate"] {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Sizes */
  &[data-size="S"] {
    font-size: var(--global-badge-font-size-s);
    padding: var(--global-badge-padding-y-s) var(--global-badge-padding-x-s);
  }
  &[data-size="M"] {
    font-size: var(--global-badge-font-size-m);
    padding: var(--global-badge-padding-y-m) var(--global-badge-padding-x-m);
  }
  &[data-size="L"] {
    font-size: var(--global-badge-font-size-l);
    padding: var(--global-badge-padding-y-l) var(--global-badge-padding-x-l);
  }

  /* Variants */
  &[data-variant="info"] {
    --badge-base-color: var(--global-color-info);
  }
  &[data-variant="success"] {
    --badge-base-color: var(--global-color-success);
  }
  &[data-variant="warning"] {
    --badge-base-color: var(--global-color-warning);
  }
  &[data-variant="danger"] {
    --badge-base-color: var(--global-color-danger);
  }

  /* Theme-aware color derivation */
  &[data-theme="light"] {
    --badge-bg-color: lch(from var(--badge-base-color) 96 calc(c * 0.3) h);
    --badge-border-color: lch(from var(--badge-base-color) 88 calc(c * 0.4) h);
    --badge-text-color: lch(from var(--badge-base-color) 45 c h);
  }
  &[data-theme="dark"] {
    --badge-bg-color: lch(from var(--badge-base-color) 18 calc(c * 0.2) h);
    --badge-border-color: lch(from var(--badge-base-color) 28 calc(c * 0.3) h);
    --badge-text-color: lch(from var(--badge-base-color) 90 calc(c * 0.8) h);
  }
`;

export const Badge = ({
  children,
  variant = "default",
  size = "S",
  overflowMode = "wrap",
  css: propCSS,
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
      className="badge"
    >
      {children}
    </span>
  );
};
