import { css } from "@emotion/react";

/**
 * The fill, border and text a family member derives from its base color
 * (`--family-base-color`). Requires `data-theme` on the element, since the
 * lightness steps invert between themes.
 */
export const derivedColorCSS = css`
  --family-base-color: var(--global-color-gray-600);
  background-color: var(--family-bg-color);
  border: 1px solid var(--family-border-color);
  color: var(--family-text-color);

  &[data-theme="light"] {
    --family-bg-color: lch(from var(--family-base-color) 96 calc(c * 0.3) h);
    --family-bg-color-hover: lch(
      from var(--family-base-color) 92 calc(c * 0.45) h
    );
    --family-bg-color-pressed: lch(
      from var(--family-base-color) 88 calc(c * 0.6) h
    );
    --family-border-color: lch(
      from var(--family-base-color) 88 calc(c * 0.4) h
    );
    --family-border-color-hover: lch(
      from var(--family-base-color) 76 calc(c * 0.8) h
    );
    --family-text-color: lch(from var(--family-base-color) 45 c h);
  }
  &[data-theme="dark"] {
    --family-bg-color: lch(from var(--family-base-color) 18 calc(c * 0.2) h);
    --family-bg-color-hover: lch(
      from var(--family-base-color) 24 calc(c * 0.35) h
    );
    --family-bg-color-pressed: lch(
      from var(--family-base-color) 30 calc(c * 0.5) h
    );
    --family-border-color: lch(
      from var(--family-base-color) 28 calc(c * 0.3) h
    );
    --family-border-color-hover: lch(
      from var(--family-base-color) 40 calc(c * 0.6) h
    );
    --family-text-color: lch(from var(--family-base-color) 90 calc(c * 0.8) h);
  }
`;

/**
 * The heights and type every family member shares, so a Badge, a Counter and
 * a Tag of one size line up in a row.
 */
export const familySizeCSS = css`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  max-width: 100%;
  font-size: var(--global-font-size-xs);
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;

  &[data-size="S"] {
    height: var(--global-dimension-size-200);
    padding: 0 var(--global-dimension-size-75);
  }
  &[data-size="M"] {
    height: var(--global-dimension-size-250);
    padding: 0 var(--global-dimension-size-100);
  }
`;

/**
 * A property marker (Badge, Counter) shows the state of the `MarkerTrigger`
 * it is the whole visible face of, keyed to React Aria's state attributes on
 * that trigger. Scoped to `MarkerTrigger` so a marker inside any other
 * control, which draws its own hover, does not change. The marker never
 * handles an event itself.
 */
export const inheritedStateCSS = css`
  .marker-trigger[data-hovered] > & {
    background-color: var(--family-bg-color-hover);
    border-color: var(--family-border-color-hover);
  }
  .marker-trigger[data-pressed] > & {
    background-color: var(--family-bg-color-pressed);
    border-color: var(--family-border-color-hover);
  }
  .marker-trigger[data-disabled] > & {
    opacity: var(--global-opacity-disabled);
  }
`;

export const truncatedTextCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/**
 * The dot a member draws in `--swatch-color`. `forced-color-adjust` keeps the
 * color in forced-colors mode, where a dot recolored to the system text color
 * would no longer match anything.
 */
export const swatchCSS = css`
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--swatch-color);
  forced-color-adjust: none;
`;
