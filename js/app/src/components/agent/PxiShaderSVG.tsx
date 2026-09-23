const VIEW_BOX_WIDTH = 346.3;
const VIEW_BOX_HEIGHT = 346.7;
const PXI_SHADER_SVG_PADDING = 120;

const RECTS = [
  { x: 23.2, y: 23.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 123.2, y: 123.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 223.2, y: 23.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 23.2, y: 223.4, width: 100, height: 100, rx: 20, ry: 20 },
  { x: 223.2, y: 223.4, width: 100, height: 100, rx: 20, ry: 20 },
] as const;

export function getPxiShaderSVGDataUrl(color: string) {
  const rects = RECTS.map(
    ({ x, y, width, height, rx, ry }) =>
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}" fill="${color}"/>`
  ).join("");

  const svgWidth = VIEW_BOX_WIDTH + PXI_SHADER_SVG_PADDING * 2;
  const svgHeight = VIEW_BOX_HEIGHT + PXI_SHADER_SVG_PADDING * 2;
  const content = `<g transform="translate(${PXI_SHADER_SVG_PADDING} ${PXI_SHADER_SVG_PADDING})">${rects}</g>`;
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">${content}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

export function PxiShaderSVG({ size }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {RECTS.map(({ x, y, width, height, rx, ry }, index) => (
        <rect
          key={index}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={rx}
          ry={ry}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
