const VIEW_BOX_WIDTH = 346.3;
const VIEW_BOX_HEIGHT = 346.7;
const OUTLINE_INSET = 14;

export const PXI_SHADER_GLYPH_PADDING = 120;

const RECTS = [
  { x: 23.2, y: 23.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 123.2, y: 123.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 223.2, y: 23.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 23.2, y: 223.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 223.2, y: 223.4, width: 100, height: 100, rx: 20, ry: 20 },
] as const;

function getGlyphRect({
  x,
  y,
  width,
  height,
}: (typeof RECTS)[number], round: boolean) {
  const radius = round ? width / 2 : 20;
  return { x, y, width, height, rx: radius, ry: radius };
}

function getOutlineCenterlineRect(
  rect: ReturnType<typeof getGlyphRect>,
  round: boolean
) {
  const centerlineRadius = round
    ? rect.width / 2 - OUTLINE_INSET / 2
    : rect.rx - OUTLINE_INSET / 2;

  return {
    x: rect.x + OUTLINE_INSET / 2,
    y: rect.y + OUTLINE_INSET / 2,
    width: rect.width - OUTLINE_INSET,
    height: rect.height - OUTLINE_INSET,
    rx: centerlineRadius,
    ry: centerlineRadius,
  };
}

export function getPxiSquareGlyphSvgMarkup({
  round = false,
  fill = false,
  color = "white",
  padding = 0,
}: {
  round?: boolean;
  fill?: boolean;
  color?: string;
  padding?: number;
}) {
  const rects = RECTS.map((rect) => {
    const glyphRect = getGlyphRect(rect, round);

    if (fill) {
      return `<rect x="${glyphRect.x}" y="${glyphRect.y}" width="${glyphRect.width}" height="${glyphRect.height}" rx="${glyphRect.rx}" ry="${glyphRect.ry}" fill="${color}"/>`;
    }

    const outlineRect = getOutlineCenterlineRect(glyphRect, round);

    return `<rect x="${outlineRect.x}" y="${outlineRect.y}" width="${outlineRect.width}" height="${outlineRect.height}" rx="${outlineRect.rx}" ry="${outlineRect.ry}" fill="none" stroke="${color}" stroke-width="${OUTLINE_INSET}"/>`;
  }).join("");

  const svgWidth = VIEW_BOX_WIDTH + padding * 2;
  const svgHeight = VIEW_BOX_HEIGHT + padding * 2;
  const content = padding
    ? `<g transform="translate(${padding} ${padding})">${rects}</g>`
    : rects;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">${content}</svg>`;
}

/**
 * PXI glyph using the real square/circle SVG geometry.
 */
export function PxiSquareGlyph({
  className,
  color = "currentColor",
  size,
  round = false,
  fill: isFilled = false,
}: {
  className?: string;
  color?: string;
  size?: number | string;
  round?: boolean;
  fill?: boolean;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {RECTS.map((rect, index) => {
        const glyphRect = getGlyphRect(rect, round);

        if (isFilled) {
          return (
            <rect
              key={index}
              x={glyphRect.x}
              y={glyphRect.y}
              width={glyphRect.width}
              height={glyphRect.height}
              rx={glyphRect.rx}
              ry={glyphRect.ry}
              fill={color}
            />
          );
        }

        const outlineRect = getOutlineCenterlineRect(glyphRect, round);

        return (
          <rect
            key={index}
            x={outlineRect.x}
            y={outlineRect.y}
            width={outlineRect.width}
            height={outlineRect.height}
            rx={outlineRect.rx}
            ry={outlineRect.ry}
            fill="none"
            stroke={color}
            strokeWidth={OUTLINE_INSET}
          />
        );
      })}
    </svg>
  );
}