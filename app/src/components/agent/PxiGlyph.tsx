import { css, keyframes } from "@emotion/react";

const DOT_R = 2.75;
const DOT_D = DOT_R * 2;
const GAP = 1;
const GRID = DOT_D + GAP;
const svgSize = DOT_D + GRID * 2;

const dots = [
  { cx: DOT_R, cy: DOT_R }, // TL
  { cx: DOT_R + GRID * 2, cy: DOT_R }, // TR
  { cx: DOT_R + GRID, cy: DOT_R + GRID }, // center
  { cx: DOT_R, cy: DOT_R + GRID * 2 }, // BL
  { cx: DOT_R + GRID * 2, cy: DOT_R + GRID * 2 }, // BR
];

const breathe = keyframes`
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.7; }
`;

const gapTL = keyframes`
  0%, 70%, 100% { transform: translate(0.5px, 0.5px); }
  20%           { transform: translate(-0.5px, -0.5px); }
`;

const gapTR = keyframes`
  0%, 70%, 100% { transform: translate(-0.5px, 0.5px); }
  20%           { transform: translate(0.5px, -0.5px); }
`;

const gapBL = keyframes`
  0%, 70%, 100% { transform: translate(0.5px, -0.5px); }
  20%           { transform: translate(-0.5px, 0.5px); }
`;

const gapBR = keyframes`
  0%, 70%, 100% { transform: translate(-0.5px, -0.5px); }
  20%           { transform: translate(0.5px, 0.5px); }
`;

const restingGlyphCSS = css`
  transform: scale(0.7);

  circle {
    opacity: 1;
    animation: none;
  }
`;

const thinkingGlyphCSS = css`
  .pxi-dot-center {
    animation: ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 1s;
  }

  .pxi-dot-tl {
    animation: ${gapTL} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0s, 0s;
  }

  .pxi-dot-tr {
    animation: ${gapTR} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.3s, 0.5s;
  }

  .pxi-dot-br {
    animation: ${gapBR} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.6s, 2s;
  }

  .pxi-dot-bl {
    animation: ${gapBL} 2.5s ease-in-out infinite,
      ${breathe} 2.5s ease-in-out infinite;
    animation-delay: 0.9s, 1.5s;
  }
`;

const variantCSS = {
  static: undefined,
  resting: restingGlyphCSS,
  thinking: thinkingGlyphCSS,
} as const;

export { svgSize };

/**
 * PXI dot-grid glyph (X pattern).
 */
export function PxiGlyph({
  className,
  fill = "currentColor",
  variant = "static",
}: {
  className?: string;
  fill?: string;
  variant?: "static" | "resting" | "thinking";
}) {
  return (
    <svg
      className={className}
      css={variantCSS[variant]}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      <circle
        className="pxi-dot-tl"
        cx={dots[0].cx}
        cy={dots[0].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="pxi-dot-tr"
        cx={dots[1].cx}
        cy={dots[1].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="pxi-dot-center"
        cx={dots[2].cx}
        cy={dots[2].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="pxi-dot-bl"
        cx={dots[3].cx}
        cy={dots[3].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="pxi-dot-br"
        cx={dots[4].cx}
        cy={dots[4].cy}
        r={DOT_R}
        fill={fill}
      />
    </svg>
  );
}
