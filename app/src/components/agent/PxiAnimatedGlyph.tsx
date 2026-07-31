import { css } from "@emotion/react";

import { classNames } from "@phoenix/utils/classNames";

import { getPxiGlyphSVGDataUrl, svgSize } from "./PxiGlyph";
import { pxiConicGradientCSS, pxiConicSpin } from "./pxiStyles";

const pxiGlyphMaskImage = `url("${getPxiGlyphSVGDataUrl({ fill: "black" })}")`;

export type PxiAnimatedGlyphSize = "S" | "M";

const animatedGlyphCSS = css`
  --pxi-animated-glyph-mark-size: 13px;
  display: grid;
  place-items: center;
  flex: none;
  width: var(--pxi-animated-glyph-mark-size);
  height: var(--pxi-animated-glyph-mark-size);

  &[data-size="S"] {
    --pxi-animated-glyph-mark-size: 11px;
  }

  &[data-icon-sized="true"] {
    width: ${svgSize}px;
    height: ${svgSize}px;
  }
`;

const animatedGlyphMarkCSS = css`
  display: block;
  width: var(--pxi-animated-glyph-mark-size);
  height: var(--pxi-animated-glyph-mark-size);
  background: color-mix(
    in srgb,
    var(--pxi-treatment-color-middle) 78%,
    var(--pxi-treatment-color-end)
  );
  -webkit-mask-image: ${pxiGlyphMaskImage};
  mask-image: ${pxiGlyphMaskImage};
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;

  &::before {
    content: "";
    ${pxiConicGradientCSS};
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0.35;
    animation: ${pxiConicSpin} var(--pxi-conic-spin-duration) linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

/** Animated blue PXI brand glyph shared by PXI action surfaces. */
export function PxiAnimatedGlyph({
  className,
  isIconSized = false,
  size = "M",
}: {
  className?: string;
  /** Reserves the same layout footprint as the static PXI glyph. */
  isIconSized?: boolean;
  size?: PxiAnimatedGlyphSize;
}) {
  return (
    <span
      className={classNames("pxi-animated-glyph", className)}
      css={animatedGlyphCSS}
      data-size={size}
      data-icon-sized={isIconSized ? "true" : undefined}
      aria-hidden="true"
    >
      <span className="pxi-animated-glyph__mark" css={animatedGlyphMarkCSS} />
    </span>
  );
}
