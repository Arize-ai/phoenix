import { css, keyframes } from "@emotion/react";

const DOT_R = 2.75;
const DOT_D = DOT_R * 2;
const GAP = 1;
const GRID = DOT_D + GAP;
export const svgSize = DOT_D + GRID * 2;
const thinkingGlyphSize = 16;

const dots = [
  { cx: DOT_R, cy: DOT_R }, // TL
  { cx: DOT_R + GRID * 2, cy: DOT_R }, // TR
  { cx: DOT_R + GRID, cy: DOT_R + GRID }, // center
  { cx: DOT_R, cy: DOT_R + GRID * 2 }, // BL
  { cx: DOT_R + GRID * 2, cy: DOT_R + GRID * 2 }, // BR
];

export type PxiGlyphThinkingVariant =
  | "wave-reveal"
  | "orbit-reveal"
  | "twinkle-reveal"
  | "wave-hold";

const restingGlyphCSS = css`
  transform: scale(0.7);
`;

const thinkingGlyphCSS = css`
  display: grid;
  grid-template-columns: repeat(3, calc(var(--pxi-thinking-size) / 4));
  grid-template-rows: repeat(3, calc(var(--pxi-thinking-size) / 4));
  gap: calc(var(--pxi-thinking-size) / 8);
  width: var(--pxi-thinking-size);
  height: var(--pxi-thinking-size);
  place-content: center;
  flex-shrink: 0;

  > span {
    width: calc(var(--pxi-thinking-size) / 4);
    height: calc(var(--pxi-thinking-size) / 4);
    border-radius: calc(var(--pxi-thinking-size) / 10.6666667);
    background: currentColor;
    opacity: 0.15;
  }
`;

const waveRevealMain = keyframes`
  0%, 100% { opacity: 0.15; }
  18% { opacity: 1; }
  32% { opacity: 0.5; }
  45%, 75% { opacity: 1; }
  88% { opacity: 0.5; }
`;

const waveRevealBackground = keyframes`
  0%, 100% { opacity: 0.15; }
  18% { opacity: 1; }
  32% { opacity: 0.4; }
  45%, 75% { opacity: 0.1; }
  88% { opacity: 0.2; }
`;

const orbitRevealCorner = keyframes`
  0%, 100% { opacity: 0.15; }
  8% { opacity: 1; }
  20% { opacity: 0.15; }
  38% { opacity: 0.5; }
  48%, 78% { opacity: 1; }
  90% { opacity: 0.5; }
`;

const orbitRevealEdge = keyframes`
  0%, 100% { opacity: 0.15; }
  8% { opacity: 1; }
  20% { opacity: 0.15; }
  38% { opacity: 0.3; }
  48%, 78% { opacity: 0.1; }
  90% { opacity: 0.2; }
`;

const orbitRevealCenter = keyframes`
  0%, 30% { opacity: 0.5; }
  42% { opacity: 0.7; }
  48%, 78% { opacity: 1; }
  90%, 100% { opacity: 0.7; }
`;

const twinkleRevealMain = keyframes`
  0%, 100% { opacity: 0.2; }
  15% { opacity: 1; }
  30% { opacity: 0.2; }
  42% { opacity: 0.5; }
  52%, 78% { opacity: 1; }
  90% { opacity: 0.5; }
`;

const twinkleRevealBackground = keyframes`
  0%, 100% { opacity: 0.2; }
  15% { opacity: 1; }
  30% { opacity: 0.2; }
  42% { opacity: 0.3; }
  52%, 78% { opacity: 0.1; }
  90% { opacity: 0.2; }
`;

const waveHoldMain = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

const waveHoldBackground = keyframes`
  0%, 40%, 100% { opacity: 0.1; }
  20% { opacity: 0.6; }
`;

const waveRevealGlyphCSS = css`
  > span:nth-of-type(1) { animation: ${waveRevealMain} 4s ease-in-out infinite 0s; }
  > span:nth-of-type(2) { animation: ${waveRevealBackground} 4s ease-in-out infinite 0.08s; }
  > span:nth-of-type(3) { animation: ${waveRevealMain} 4s ease-in-out infinite 0.16s; }
  > span:nth-of-type(4) { animation: ${waveRevealBackground} 4s ease-in-out infinite 0.24s; }
  > span:nth-of-type(5) { animation: ${waveRevealMain} 4s ease-in-out infinite 0.32s; }
  > span:nth-of-type(6) { animation: ${waveRevealBackground} 4s ease-in-out infinite 0.4s; }
  > span:nth-of-type(7) { animation: ${waveRevealMain} 4s ease-in-out infinite 0.48s; }
  > span:nth-of-type(8) { animation: ${waveRevealBackground} 4s ease-in-out infinite 0.56s; }
  > span:nth-of-type(9) { animation: ${waveRevealMain} 4s ease-in-out infinite 0.64s; }
`;

const orbitRevealGlyphCSS = css`
  > span:nth-of-type(1) { animation: ${orbitRevealCorner} 4s ease-in-out infinite 0s; }
  > span:nth-of-type(2) { animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.15s; }
  > span:nth-of-type(3) { animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.3s; }
  > span:nth-of-type(4) { animation: ${orbitRevealEdge} 4s ease-in-out infinite 1.05s; }
  > span:nth-of-type(5) { animation: ${orbitRevealCenter} 4s ease-in-out infinite; }
  > span:nth-of-type(6) { animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.45s; }
  > span:nth-of-type(7) { animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.9s; }
  > span:nth-of-type(8) { animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.75s; }
  > span:nth-of-type(9) { animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.6s; }
`;

const twinkleRevealGlyphCSS = css`
  > span:nth-of-type(1) { animation: ${twinkleRevealMain} 4s ease-in-out infinite 0s; }
  > span:nth-of-type(2) { animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.2s; }
  > span:nth-of-type(3) { animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.5s; }
  > span:nth-of-type(4) { animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.1s; }
  > span:nth-of-type(5) { animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.3s; }
  > span:nth-of-type(6) { animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.6s; }
  > span:nth-of-type(7) { animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.4s; }
  > span:nth-of-type(8) { animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.35s; }
  > span:nth-of-type(9) { animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.25s; }
`;

const waveHoldGlyphCSS = css`
  > span:nth-of-type(1),
  > span:nth-of-type(3),
  > span:nth-of-type(5),
  > span:nth-of-type(7),
  > span:nth-of-type(9) {
    animation: ${waveHoldMain} 3s ease-in-out infinite;
  }

  > span:nth-of-type(2) { animation: ${waveHoldBackground} 3s ease-in-out infinite 0s; }
  > span:nth-of-type(4) { animation: ${waveHoldBackground} 3s ease-in-out infinite 0.15s; }
  > span:nth-of-type(6) { animation: ${waveHoldBackground} 3s ease-in-out infinite 0.3s; }
  > span:nth-of-type(8) { animation: ${waveHoldBackground} 3s ease-in-out infinite 0.45s; }
`;

const thinkingGlyphVariantCSS: Record<
  PxiGlyphThinkingVariant,
  ReturnType<typeof css>
> = {
  "wave-reveal": waveRevealGlyphCSS,
  "orbit-reveal": orbitRevealGlyphCSS,
  "twinkle-reveal": twinkleRevealGlyphCSS,
  "wave-hold": waveHoldGlyphCSS,
};

/**
 * PXI dot-grid glyph.
 * static/resting: original SVG 5-dot X. thinking: animated 3x3 grid variants.
 */
export function PxiGlyph({
  className,
  fill = "currentColor",
  variant = "static",
  size,
  thinkingVariant = "orbit-reveal",
}: {
  className?: string;
  fill?: string;
  variant?: "static" | "resting" | "thinking";
  size?: number | string;
  thinkingVariant?: PxiGlyphThinkingVariant;
}) {
  const dim = size ?? (variant === "thinking" ? thinkingGlyphSize : svgSize);

  if (variant === "thinking") {
    const thinkingSize = typeof dim === "number" ? `${dim}px` : dim;
    const thinkingStyle =
      fill === "currentColor"
        ? ({
            "--pxi-thinking-size": thinkingSize,
          } as React.CSSProperties)
        : ({
            color: fill,
            "--pxi-thinking-size": thinkingSize,
          } as React.CSSProperties);

    return (
      <span
        className={className}
        css={[thinkingGlyphCSS, thinkingGlyphVariantCSS[thinkingVariant]]}
        style={thinkingStyle}
        aria-hidden="true"
      >
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} />
        ))}
      </span>
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
