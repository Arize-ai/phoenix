import { css, keyframes } from "@emotion/react";
import React from "react";

const BRAND_CELL_SIZE = 5.5;
const BRAND_CELL_RADIUS = 1.1;
const GAP = 1;
const GRID = BRAND_CELL_SIZE + GAP;
export const svgSize = BRAND_CELL_SIZE + GRID * 2;
const thinkingGlyphSize = 16;

const gridCells = [
  { x: 0, y: 0 },
  { x: GRID * 2, y: 0 },
  { x: GRID, y: GRID },
  { x: 0, y: GRID * 2 },
  { x: GRID * 2, y: GRID * 2 },
].map(({ x, y }) => ({
  x,
  y,
  width: BRAND_CELL_SIZE,
  height: BRAND_CELL_SIZE,
  rx: BRAND_CELL_RADIUS,
  ry: BRAND_CELL_RADIUS,
}));

export function getPxiGlyphSVGDataUrl({ fill }: { fill: string }) {
  const rects = gridCells
    .map(
      ({ x, y, width, height, rx, ry }) =>
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}" fill="${fill}"/>`
    )
    .join("");
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}">${rects}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

// The outline glyph sits in the same 24px viewBox as the icon set so it
// renders at the same optical size as other icons — the inner margin keeps
// the dense five-cell grid from reading larger than its neighbors.
const OUTLINE_VIEWBOX_SIZE = 24;
const OUTLINE_STROKE_WIDTH = 1.5;
const OUTLINE_INSET = (OUTLINE_VIEWBOX_SIZE - svgSize) / 2;

/**
 * Stroked, icon-sized variant of the PXI brand glyph for places that use
 * outline iconography (tab prefixes, menus) where the filled glyph reads too
 * heavy.
 */
export function PxiGlyphOutline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${OUTLINE_VIEWBOX_SIZE} ${OUTLINE_VIEWBOX_SIZE}`}
      style={{ fill: "none", stroke: "currentColor" }}
      strokeWidth={OUTLINE_STROKE_WIDTH}
    >
      <g transform={`translate(${OUTLINE_INSET} ${OUTLINE_INSET})`}>
        {gridCells.map((cell, index) => (
          <rect key={index} {...cell} />
        ))}
      </g>
    </svg>
  );
}

export type PxiGlyphAnimation =
  | "wave-reveal"
  | "orbit-reveal"
  | "twinkle-reveal"
  | "wave-hold";

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
  > span:nth-of-type(1) {
    animation: ${waveRevealMain} 4s ease-in-out infinite 0s;
  }
  > span:nth-of-type(2) {
    animation: ${waveRevealBackground} 4s ease-in-out infinite 0.08s;
  }
  > span:nth-of-type(3) {
    animation: ${waveRevealMain} 4s ease-in-out infinite 0.16s;
  }
  > span:nth-of-type(4) {
    animation: ${waveRevealBackground} 4s ease-in-out infinite 0.24s;
  }
  > span:nth-of-type(5) {
    animation: ${waveRevealMain} 4s ease-in-out infinite 0.32s;
  }
  > span:nth-of-type(6) {
    animation: ${waveRevealBackground} 4s ease-in-out infinite 0.4s;
  }
  > span:nth-of-type(7) {
    animation: ${waveRevealMain} 4s ease-in-out infinite 0.48s;
  }
  > span:nth-of-type(8) {
    animation: ${waveRevealBackground} 4s ease-in-out infinite 0.56s;
  }
  > span:nth-of-type(9) {
    animation: ${waveRevealMain} 4s ease-in-out infinite 0.64s;
  }
`;

const orbitRevealGlyphCSS = css`
  > span:nth-of-type(1) {
    animation: ${orbitRevealCorner} 4s ease-in-out infinite 0s;
  }
  > span:nth-of-type(2) {
    animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.15s;
  }
  > span:nth-of-type(3) {
    animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.3s;
  }
  > span:nth-of-type(4) {
    animation: ${orbitRevealEdge} 4s ease-in-out infinite 1.05s;
  }
  > span:nth-of-type(5) {
    animation: ${orbitRevealCenter} 4s ease-in-out infinite;
  }
  > span:nth-of-type(6) {
    animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.45s;
  }
  > span:nth-of-type(7) {
    animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.9s;
  }
  > span:nth-of-type(8) {
    animation: ${orbitRevealEdge} 4s ease-in-out infinite 0.75s;
  }
  > span:nth-of-type(9) {
    animation: ${orbitRevealCorner} 4s ease-in-out infinite 0.6s;
  }
`;

const twinkleRevealGlyphCSS = css`
  > span:nth-of-type(1) {
    animation: ${twinkleRevealMain} 4s ease-in-out infinite 0s;
  }
  > span:nth-of-type(2) {
    animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.2s;
  }
  > span:nth-of-type(3) {
    animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.5s;
  }
  > span:nth-of-type(4) {
    animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.1s;
  }
  > span:nth-of-type(5) {
    animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.3s;
  }
  > span:nth-of-type(6) {
    animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.6s;
  }
  > span:nth-of-type(7) {
    animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.4s;
  }
  > span:nth-of-type(8) {
    animation: ${twinkleRevealBackground} 4s ease-in-out infinite 0.35s;
  }
  > span:nth-of-type(9) {
    animation: ${twinkleRevealMain} 4s ease-in-out infinite 0.25s;
  }
`;

const waveHoldGlyphCSS = css`
  > span:nth-of-type(1),
  > span:nth-of-type(3),
  > span:nth-of-type(5),
  > span:nth-of-type(7),
  > span:nth-of-type(9) {
    animation: ${waveHoldMain} 3s ease-in-out infinite;
  }

  > span:nth-of-type(2) {
    animation: ${waveHoldBackground} 3s ease-in-out infinite 0s;
  }
  > span:nth-of-type(4) {
    animation: ${waveHoldBackground} 3s ease-in-out infinite 0.15s;
  }
  > span:nth-of-type(6) {
    animation: ${waveHoldBackground} 3s ease-in-out infinite 0.3s;
  }
  > span:nth-of-type(8) {
    animation: ${waveHoldBackground} 3s ease-in-out infinite 0.45s;
  }
`;

const thinkingGlyphAnimationCSS: Record<
  PxiGlyphAnimation,
  ReturnType<typeof css>
> = {
  "wave-reveal": waveRevealGlyphCSS,
  "orbit-reveal": orbitRevealGlyphCSS,
  "twinkle-reveal": twinkleRevealGlyphCSS,
  "wave-hold": waveHoldGlyphCSS,
};

/**
 * Assistant brand glyph. When `animation` is set, renders an animated 3x3 grid;
 * otherwise renders the static rounded-square 5-cell brand mark.
 */
export function PxiGlyph({
  className,
  fill = "currentColor",
  animation = false,
  size,
}: {
  className?: string;
  fill?: string;
  animation?: PxiGlyphAnimation | false;
  size?: number | string;
}) {
  const dim = size ?? (animation ? thinkingGlyphSize : svgSize);

  if (animation) {
    const thinkingSize = typeof dim === "number" ? `${dim}px` : dim;
    const thinkingStyle: React.CSSProperties &
      Record<"--pxi-thinking-size", string> =
      fill === "currentColor"
        ? {
            "--pxi-thinking-size": thinkingSize,
          }
        : {
            color: fill,
            "--pxi-thinking-size": thinkingSize,
          };

    return (
      <span
        className={className}
        css={[thinkingGlyphCSS, thinkingGlyphAnimationCSS[animation]]}
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
      width={dim}
      height={dim}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      {gridCells.map((cell, index) => (
        <rect key={index} {...cell} fill={fill} />
      ))}
    </svg>
  );
}
