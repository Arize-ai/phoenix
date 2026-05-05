import { css } from "@emotion/react";
import type { ElementType, HTMLAttributes, Ref } from "react";

/**
 * Divider sizes map to vertical margin (spacing above and below).
 * Defer lg/xl until usage patterns establish what values make sense.
 */
const SIZE_MAP = {
  xs: 4,
  sm: 8,
  md: 16,
} as const;

export type DividerSize = keyof typeof SIZE_MAP;
export type DividerVariant = "solid" | "fading";

export interface DividerProps extends Omit<
  HTMLAttributes<HTMLHRElement>,
  "children"
> {
  /** Visual variant: solid line or fading gradient. Default: "solid" */
  variant?: DividerVariant;
  /**
   * Vertical margin size. Omit for no vertical spacing.
   * xs=4px, sm=8px, md=16px
   */
  size?: DividerSize;
  /**
   * Orientation of the divider. Default: "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

const baseHrCSS = css`
  border: none;
  margin: 0;
  padding: 0;
`;

/**
 * Solid 1px line using the semantic border color.
 */
const solidHorizontalCSS = css`
  ${baseHrCSS}
  height: 1px;
  width: 100%;
  background-color: var(--global-border-color-default);
`;

const solidVerticalCSS = css`
  ${baseHrCSS}
  width: 1px;
  height: 100%;
  background-color: var(--global-border-color-default);
`;

const buildFadingGradient = ({
  direction,
}: {
  direction: "to right" | "to bottom";
}) => `
  linear-gradient(
    ${direction},
    transparent,
    var(--global-border-color-default) clamp(48px, 15%, 128px),
    var(--global-border-color-default) 50%,
    var(--global-border-color-default) calc(100% - clamp(48px, 15%, 128px)),
    transparent
  )
`;

/**
 * Fading gradient divider derived from the semantic border color with fixed,
 * clamped fade distances.
 */
const fadingHorizontalCSS = css`
  ${baseHrCSS}
  height: 1px;
  width: 100%;
  background: ${buildFadingGradient({
    direction: "to right",
  })};
  opacity: 0.78;
`;

const fadingVerticalCSS = css`
  ${baseHrCSS}
  width: 1px;
  height: 100%;
  background: ${buildFadingGradient({
    direction: "to bottom",
  })};
  opacity: 0.78;
`;

const getMarginCSS = (
  size: DividerSize,
  orientation: "horizontal" | "vertical"
) => {
  const value = SIZE_MAP[size];
  if (orientation === "horizontal") {
    return css`
      margin-top: ${value}px;
      margin-bottom: ${value}px;
    `;
  }
  return css`
    margin-left: ${value}px;
    margin-right: ${value}px;
  `;
};

const getVariantCSS = (
  variant: DividerVariant,
  orientation: "horizontal" | "vertical"
) => {
  if (variant === "fading") {
    return orientation === "horizontal"
      ? fadingHorizontalCSS
      : fadingVerticalCSS;
  }
  return orientation === "horizontal" ? solidHorizontalCSS : solidVerticalCSS;
};

/**
 * A horizontal or vertical rule for visual separation between content.
 *
 * Use the `variant` prop to choose between a solid line and a fading gradient.
 * Use the `size` prop to add vertical margin.
 *
 * @example
 * ```tsx
 * // Basic solid divider
 * <Divider />
 *
 * // Fading divider with small vertical margin
 * <Divider variant="fading" size="sm" />
 * ```
 */
function Divider({
  ref,
  variant = "solid",
  size,
  orientation = "horizontal",
  ...props
}: DividerProps & { ref?: Ref<HTMLHRElement> }) {
  const Component: ElementType = "hr";
  const variantCSS = getVariantCSS(variant, orientation);
  const marginCSS = size ? getMarginCSS(size, orientation) : undefined;

  return (
    <Component
      ref={ref}
      css={[variantCSS, marginCSS]}
      aria-orientation={orientation}
      {...props}
    />
  );
}

export { Divider };
