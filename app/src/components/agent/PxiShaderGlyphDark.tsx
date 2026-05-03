import { css } from "@emotion/react";
import { Heatmap, LiquidMetal } from "@paper-design/shaders-react";

import {
  getPxiSquareGlyphSvgMarkup,
  PXI_SHADER_GLYPH_PADDING,
  PxiSquareGlyph,
} from "./PxiSquareGlyph";

const containerCSS = css`
  position: relative;
  flex-shrink: 0;
  isolation: isolate;
  overflow: hidden;
  filter: saturate(0.36);
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
`;

const heatmapLayerCSS = css`
  mix-blend-mode: plus-lighter;
  opacity: 0.43;
`;

const centeredLayerCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const svgLightenCSS = css`
  mix-blend-mode: plus-lighter;
  opacity: 0.2;
  color: #ffffff;
`;

const svgDifferenceCSS = css`
  mix-blend-mode: difference;
  opacity: 0.4;
  color: #761c0e;
`;

const SHADER_LAYER_SCALE = 0.9;
const SVG_LAYER_SCALE = 0.5;

const liquidMetalGlyphImage = `data:image/svg+xml,${encodeURIComponent(
  getPxiSquareGlyphSvgMarkup({
    color: "white",
    fill: true,
    padding: PXI_SHADER_GLYPH_PADDING,
  })
)}`;

const heatmapGlyphImage = `data:image/svg+xml,${encodeURIComponent(
  getPxiSquareGlyphSvgMarkup({
    color: "black",
    fill: true,
    padding: PXI_SHADER_GLYPH_PADDING,
  })
)}`;

export interface PxiShaderGlyphDarkProps {
  size?: number;
  scale?: number;
  className?: string;
}

export function PxiShaderGlyphDark({
  size = 160,
  scale = 1,
  className,
}: PxiShaderGlyphDarkProps) {
  const shaderScale = SHADER_LAYER_SCALE * scale;
  const svgSize = size * SVG_LAYER_SCALE * scale;

  return (
    <div
      css={containerCSS}
      className={className}
      style={{ width: size, height: size }}
    >
      <LiquidMetal
        css={[layerCSS, shaderCSS]}
        image={liquidMetalGlyphImage}
        suspendWhenProcessingImage
        fit="contain"
        scale={shaderScale}
        speed={0.81}
        colorBack="#00000000"
        colorTint="#DDDDDD"
        distortion={0.17}
        contour={0.72}
        softness={1}
        repetition={3.75}
        shiftRed={0}
        shiftBlue={0}
        angle={45}
        style={{ width: size, height: size }}
      />
      <div css={[layerCSS, centeredLayerCSS, svgLightenCSS]}>
        <PxiSquareGlyph size={svgSize} fill />
      </div>
      <div css={[layerCSS, heatmapLayerCSS]}>
        <Heatmap
          css={shaderCSS}
          image={heatmapGlyphImage}
          suspendWhenProcessingImage
          fit="contain"
          scale={shaderScale}
          speed={1}
          frame={1847282.0999997417}
          contour={0.54}
          angle={-38}
          noise={0}
          innerGlow={0.28}
          outerGlow={0.37}
          colors={[
            "#29375D",
            "#1F3BA2",
            "#2F63E7",
            "#6BD7FF",
            "#FFE679",
            "#FF991E",
            "#FF4C00",
          ]}
          colorBack="#00000000"
          style={{ width: size, height: size }}
        />
      </div>
      <div css={[layerCSS, centeredLayerCSS, svgDifferenceCSS]}>
        <PxiSquareGlyph size={svgSize} fill />
      </div>
    </div>
  );
}