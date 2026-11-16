import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";

export type EdgeFadeEdge = "bottom";

const GRADIENT_DIRECTIONS: Record<EdgeFadeEdge, string> = {
  bottom: "to bottom",
};

// Intentionally unbounded: no clamp to a minimum or maximum length. Bound it if
// real product use shows a short element fading too little or a tall one too
// much.
const DEFAULT_FADE_SIZE = "75%";

const FADE_SIZE = `var(--edge-fade-size, ${DEFAULT_FADE_SIZE})`;

const EASED_STOP_COUNT = 8;

/**
 * Smoothstep stops: a two-stop linear fade has a slope discontinuity where it
 * begins, which reads as a hard line (Mach banding).
 */
const EASED_STOPS = Array.from({ length: EASED_STOP_COUNT + 1 }, (_, i) => {
  const t = i / EASED_STOP_COUNT;
  const alpha = 1 - t * t * (3 - 2 * t);
  return `rgb(0 0 0 / ${alpha.toFixed(3)}) calc(100% - ${FADE_SIZE} * ${(1 - t).toFixed(3)})`;
}).join(", ");

/**
 * Skeletons sit only a few 8-bit gray levels above their background, so even
 * an eased fade quantizes into bands tens of pixels tall. Two noise layers
 * dither them. Excluding enveloped noise from gradient G adds N(1 − 2G),
 * which breaks up the band edges near both ends of the fade but vanishes
 * mid-fade; a second, independent noise added on top fills that middle and
 * cannot touch the solid content, since adding to full opacity leaves it
 * full. A last gradient clears that added noise from the faded-out tail.
 */
// Coprime tile sizes, so the two noise patterns only realign every
// 128 × 97 px rather than repeating visibly every tile.
const EDGE_NOISE_TILE_SIZE = 128;
const MIDDLE_NOISE_TILE_SIZE = 97;

function noiseImage(amplitude: number, seed: number, size: number): string {
  // fractalNoise's channels cluster around 0.5; map roughly 0.3–0.7 onto
  // 0–amplitude.
  const scale = (amplitude / 0.4).toFixed(3);
  const offset = ((-0.3 * amplitude) / 0.4).toFixed(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="n" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${scale} 0 0 0 ${offset}"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const EDGE_NOISE_IMAGE = noiseImage(0.35, 0, EDGE_NOISE_TILE_SIZE);
const MIDDLE_NOISE_IMAGE = noiseImage(0.25, 7, MIDDLE_NOISE_TILE_SIZE);

const bandStop = (alpha: number, t: number) =>
  `rgb(0 0 0 / ${alpha}) calc(100% - ${FADE_SIZE} * ${(1 - t).toFixed(3)})`;

/**
 * Fades an element's content to transparency toward one edge, so it appears
 * to trail off beyond the frame. It masks the content rather than painting a
 * gradient over it, so whatever sits behind the element shows through the
 * fade on any background.
 *
 * The fade band is `--edge-fade-size`, which defaults to three quarters of the
 * element's height. Set it on the element to size the band differently, such
 * as a fixed length for a tall element.
 */
export function edgeFadeCSS(edge: EdgeFadeEdge): SerializedStyles {
  const direction = GRADIENT_DIRECTIONS[edge];
  const gradient = `linear-gradient(${direction}, ${EASED_STOPS})`;
  const noiseEnvelope = `linear-gradient(${direction}, ${[
    bandStop(0, 0),
    bandStop(1, 0.1),
    bandStop(1, 0.8),
    bandStop(0, 1),
  ].join(", ")})`;
  const tailClip = `linear-gradient(${direction}, ${[
    bandStop(1, 0.85),
    bandStop(0, 1),
  ].join(", ")})`;
  const fill = "100% 100%";
  const tile = (size: number) => `${size}px ${size}px`;
  return css`
    mask-image:
      ${tailClip}, ${MIDDLE_NOISE_IMAGE}, ${gradient}, ${noiseEnvelope},
      ${EDGE_NOISE_IMAGE};
    mask-size:
      ${fill}, ${tile(MIDDLE_NOISE_TILE_SIZE)}, ${fill}, ${fill},
      ${tile(EDGE_NOISE_TILE_SIZE)};
    mask-repeat: no-repeat, repeat, no-repeat, no-repeat, repeat;
    mask-composite: intersect, add, exclude, intersect, add;
  `;
}
