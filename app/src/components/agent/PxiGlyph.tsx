import { memo } from "react";

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

export { svgSize };

/**
 * PXI dot-grid glyph (X pattern). Pure SVG, no animation —
 * animation classes are applied by the parent via CSS targeting
 * the circle class names.
 */
export const PxiGlyph = memo(function PxiGlyph({
  className,
  fill = "currentColor",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      className={className}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
    >
      <circle
        className="fab-dot-tl"
        cx={dots[0].cx}
        cy={dots[0].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="fab-dot-tr"
        cx={dots[1].cx}
        cy={dots[1].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="fab-dot-center"
        cx={dots[2].cx}
        cy={dots[2].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="fab-dot-bl"
        cx={dots[3].cx}
        cy={dots[3].cy}
        r={DOT_R}
        fill={fill}
      />
      <circle
        className="fab-dot-br"
        cx={dots[4].cx}
        cy={dots[4].cy}
        r={DOT_R}
        fill={fill}
      />
    </svg>
  );
});
