import { css } from "@emotion/react";
import { Heatmap, LiquidMetal } from "@paper-design/shaders-react";

import { getPxiShaderSVGDataUrl, PxiShaderSVG } from "./PxiShaderSVG";

const containerCSS = css`
  position: relative;
  flex-shrink: 0;
  isolation: isolate;
  overflow: hidden;
  filter: saturate(0.35);
  -webkit-mask-image: radial-gradient(
    circle at center,
    rgba(0, 0, 0, 1) 36%,
    rgba(0, 0, 0, 0.92) 54%,
    rgba(0, 0, 0, 0.48) 68%,
    rgba(0, 0, 0, 0.12) 78%,
    rgba(0, 0, 0, 0) 88%
  );
  mask-image: radial-gradient(
    circle at center,
    rgba(0, 0, 0, 1) 36%,
    rgba(0, 0, 0, 0) 70%
  );
`;

const layerCSS = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

const shaderCSS = css`
  position: relative;
  flex-shrink: 0;
  mix-blend-mode: screen;
`;

const heatmapLayerCSS = css`
  opacity: 1;
`;

const centeredLayerCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SHADER_LAYER_SCALE = 0.9;
const SVG_LAYER_SCALE = 0.5;

const SVG_LIGHTEN_STYLE = {
  mixBlendMode: "normal" as const,
  color: "#16559072",
  opacity: 1,
};

const SVG_DIFFERENCE_STYLE = {
  mixBlendMode: "difference" as const,
  opacity: 0,
  color: "#761C0E",
};

const HEATMAP_COLORS: string[] = [
  "#FFFFFF",
  "#F7FAFF",
  "#FFFFFF",
  "#FFFFFF",
  "#F4F7FF",
  "#FFFFFF",
  "#FFFFFF",
];

const LIQUID_METAL_TINT = "#B5B5B5";

const liquidMetalGlyphImage = getPxiShaderSVGDataUrl("white");

const heatmapGlyphImage = getPxiShaderSVGDataUrl("black");

export interface PxiShaderGlyphLightProps {
  size?: number;
  scale?: number;
  className?: string;
}

export function PxiShaderGlyphLight({
  size = 160,
  scale = 1,
  className,
}: PxiShaderGlyphLightProps) {
  const shaderScale = SHADER_LAYER_SCALE * scale;
  const svgSize = size * SVG_LAYER_SCALE * scale;

  return (
    <div
      css={containerCSS}
      className={className}
      style={{ width: size, height: size }}
    >
      <div css={[layerCSS, heatmapLayerCSS]}>
        <Heatmap
          css={shaderCSS}
          image={heatmapGlyphImage}
          suspendWhenProcessingImage
          fit="contain"
          scale={shaderScale}
          speed={0.8}
          frame={2884763.8949998394}
          contour={0.541}
          angle={-124}
          noise={0}
          innerGlow={0}
          outerGlow={0.75}
          colors={HEATMAP_COLORS}
          colorBack="#00000000"
          style={{ width: size, height: size }}
        />
      </div>
      <div
        css={[layerCSS, centeredLayerCSS]}
        style={SVG_LIGHTEN_STYLE}
      >
        <PxiShaderSVG size={svgSize} />
      </div>
      <LiquidMetal
        css={[layerCSS, shaderCSS]}
        image={liquidMetalGlyphImage}
        suspendWhenProcessingImage
        fit="contain"
        scale={shaderScale}
        speed={0.81}
        frame={1598779.833000716}
        colorBack="#00000000"
        colorTint={LIQUID_METAL_TINT}
        distortion={0.18}
        contour={0.72}
        softness={1}
        repetition={3.75}
        shiftRed={0}
        shiftBlue={0}
        angle={76}
        style={{ width: size, height: size }}
      />
      <div css={[layerCSS, centeredLayerCSS]} style={SVG_DIFFERENCE_STYLE}>
        <PxiShaderSVG size={svgSize} />
      </div>
    </div>
  );
}