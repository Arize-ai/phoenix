import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts/ThemeContext";

import type { BadgeProps } from "./types";

const badgeCSS = css`
  --badge-base-color: var(--global-color-gray-500);
  --badge-bg-color: lch(from var(--badge-base-color) l c h / 0.1);
  --badge-border-color: lch(from var(--badge-base-color) l c h / 0.3);
  --badge-text-color: var(--badge-base-color);

  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);
  border: 1px solid var(--badge-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--badge-bg-color);
  color: var(--badge-text-color);
  font-weight: 600;
  line-height: 1.4;
  white-space: normal;
  box-sizing: border-box;

  &[data-overflow-mode="truncate"] {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Sizes */
  &[data-size="S"] {
    font-size: var(--global-font-size-xs);
    padding: 0 var(--global-dimension-static-size-50);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-s);
    padding: var(--global-dimension-static-size-25)
      var(--global-dimension-static-size-100);
  }
  &[data-size="L"] {
    font-size: var(--global-font-size-m);
    padding: var(--global-dimension-static-size-50)
      var(--global-dimension-static-size-100);
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
    --badge-bg-color: lch(from var(--badge-base-color) l c h / 0.1);
    --badge-border-color: lch(from var(--badge-base-color) l c h / 0.3);
    --badge-text-color: var(--badge-base-color);
  }
  &[data-theme="dark"] {
    --badge-bg-color: lch(from var(--badge-base-color) l c h / 0.2);
    --badge-border-color: lch(from var(--badge-base-color) l c h / 0.4);
    --badge-text-color: lch(
      from var(--badge-base-color) calc((l) * infinity) c h / 1
    );
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
    >
      {children}
    </span>
  );
};
