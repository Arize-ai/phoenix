import { css, keyframes } from "@emotion/react";

const DOT_R = 2.75;
const DOT_D = DOT_R * 2;
const GAP = 1;
const GRID = DOT_D + GAP;
export const svgSize = DOT_D + GRID * 2;

const dots = [
  { cx: DOT_R,            cy: DOT_R            }, // TL
  { cx: DOT_R + GRID * 2, cy: DOT_R            }, // TR
  { cx: DOT_R + GRID,     cy: DOT_R + GRID     }, // center
  { cx: DOT_R,            cy: DOT_R + GRID * 2 }, // BL
  { cx: DOT_R + GRID * 2, cy: DOT_R + GRID * 2 }, // BR
];

// 8-step co-fade: each half-cycle the arm dropout and center split match diagonals
const orbit = keyframes`
  0%    { content: "\u2871\u288E"; }
  12.5% { content: "\u2850\u288C"; }
  25%   { content: "\u2850\u280C"; }
  37.5% { content: "\u2851\u280C"; }
  50%   { content: "\u2871\u288E"; }
  62.5% { content: "\u2861\u2882"; }
  75%   { content: "\u2821\u2882"; }
  87.5% { content: "\u2821\u288A"; }
`;

const restingGlyphCSS = css`
  transform: scale(0.7);
`;

const thinkingSpanCSS = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: ${svgSize}px;
  line-height: 1;
  letter-spacing: 0;

  &::after {
    content: "\u2871\u288E";
    animation: ${orbit} 1600ms steps(1) infinite;
  }
`;

/**
 * PXI dot-grid glyph.
 * static/resting: original SVG 5-dot X. thinking: braille co-fade animation.
 */
export function PxiGlyph({
  className,
  fill = "currentColor",
  variant = "static",
  size,
}: {
  className?: string;
  fill?: string;
  variant?: "static" | "resting" | "thinking";
  size?: number | string;
}) {
  const dim = size ?? svgSize;

  if (variant === "thinking") {
    return (
      <span
        className={className}
        css={thinkingSpanCSS}
        style={{ color: fill, fontSize: dim }}
      />
    );
  }

  return (
    <svg
      className={className}
      css={variant === "resting" ? restingGlyphCSS : undefined}
      width={dim}
      height={dim}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={DOT_R} fill={fill} />
      ))}
    </svg>
  );
}
