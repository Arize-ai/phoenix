import { css } from "@emotion/react";
import type { CSSProperties } from "react";

import { swatchCSS, truncatedTextCSS } from "../styles";

export interface SwatchedNameProps {
  /**
   * The thing's own name, such as an experiment's or a label's. It truncates
   * when space runs out, and the whole name stays in its native tooltip.
   */
  name: string;
  /**
   * The color that keys the name to its other appearances: a series in a
   * chart, a color a person picked, a color derived from the name. Any CSS
   * color, including a `var()`.
   */
  color: string;
}

const swatchedNameCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  vertical-align: middle;

  .swatched-name__swatch {
    ${swatchCSS};
  }
  .swatched-name__name {
    ${truncatedTextCSS};
  }
`;

/**
 * A name led by the swatch that keys it to its other appearances on the
 * page, such as an experiment beside its series in a comparison chart. The
 * color identifies and judges nothing: it is often assigned by position, so
 * it means something only beside the other things it tells apart. A status
 * is a `StatusIndicator`, and a value from a closed set of kinds is a
 * `Badge`.
 *
 * The name takes its type from its context, so it fits a header, a table
 * cell or a menu item as the surrounding text does. The swatch is hidden
 * from assistive technology, since the name already says which one it is.
 */
export function SwatchedName({ name, color }: SwatchedNameProps) {
  return (
    <span
      className="swatched-name"
      css={swatchedNameCSS}
      style={{ "--swatch-color": color } as CSSProperties}
    >
      <span className="swatched-name__swatch" aria-hidden />
      <span className="swatched-name__name" title={name}>
        {name}
      </span>
    </span>
  );
}
