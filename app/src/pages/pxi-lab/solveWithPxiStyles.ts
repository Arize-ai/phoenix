import { css, keyframes } from "@emotion/react";

/**
 * Solve-with-PXI affordance styling.
 *
 * Architecture: components (SolveWithPxiButton, PxiRing, PxiTag, menu items)
 * only emit structure + data attributes. All paint lives here, keyed off a
 * scope element that carries:
 *   - data-pxi-treatment="conic|aurora|mono|glass"  (structural style switch)
 *   - data-theme="light|dark"                       (theme-tuned overrides)
 *   - data-pxi-motion="on|off"                      (freeze all animation)
 *   - CSS custom props (--pxi-c1..c3, --pxi-speed, --pxi-ring-width,
 *     --pxi-glow, --pxi-spread, --pxi-radius, --pxi-button-radius)
 *
 * Every affordance shares the same two-layer anatomy:
 *   ::before = stroke layer (the ring band, cut out via mask-composite)
 *   ::after  = glow layer   (blurred halo behind the element)
 * State (idle/eligible/active, hover, pressed) never repaints — it only
 * modulates three vars the treatments consume:
 *   --pxi-stroke-alpha, --pxi-glow-alpha, --pxi-anim-mult, --pxi-anim-play
 * This is what keeps a new treatment cheap: define paint once, states are free.
 */

/* --- animation primitives ------------------------------------------------ */

const pxiSpin = keyframes`
  to {
    --pxi-angle: 360deg;
  }
`;

/** traveling highlight along a border band (background-position wipe) */
const pxiWipe = keyframes`
  0% {
    background-position: 200% 0, 0 0;
  }
  100% {
    background-position: -150% 0, 0 0;
  }
`;

const pxiAuroraDrift = keyframes`
  0%, 100% {
    background-position: 0% 0%, 100% 100%, 60% 0%;
  }
  50% {
    background-position: 45% 30%, 55% 60%, 20% 40%;
  }
`;

/**
 * @property registration must be global (it cannot be scoped). Required for
 * animating the conic gradient angle; without it the keyframe interpolation
 * of --pxi-angle would snap instead of sweep.
 */
export const pxiGlobalCSS = css`
  @property --pxi-angle {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }
`;

/** cuts a pseudo-element down to just its padding band (the ring) */
const ringMask = `
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
`;

export const pxiScopeCSS = css`
  /* ====================================================================== */
  /* base anatomy                                                           */
  /* ====================================================================== */

  .pxi-solve-button,
  .pxi-ring,
  .pxi-tag {
    position: relative;
    isolation: isolate;

    &::before,
    &::after {
      content: "";
      position: absolute;
      pointer-events: none;
      border-radius: inherit;
    }
    /* stroke layer */
    &::before {
      inset: 0;
      padding: var(--pxi-ring-width);
      ${ringMask}
      z-index: 1;
      opacity: var(--pxi-stroke-alpha);
    }
    /* glow layer */
    &::after {
      inset: -2px;
      z-index: -1;
      opacity: var(--pxi-glow-alpha);
    }
  }

  /* --- trigger button --------------------------------------------------- */

  .pxi-solve-button {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-static-size-75);
    border: none;
    cursor: pointer;
    box-sizing: border-box;
    font-size: var(--global-font-size-s);
    font-weight: 500;
    font-family: inherit;
    line-height: 1;
    border-radius: var(--pxi-button-radius, var(--global-rounding-small));
    transition:
      color 0.15s ease,
      background-color 0.15s ease;

    /* calm at rest, lively on hover — states only touch the shared vars */
    --pxi-stroke-alpha: 0.75;
    --pxi-glow-alpha: calc(var(--pxi-glow) * 0.35);
    --pxi-anim-mult: 2.5;

    &[data-hovered] {
      --pxi-stroke-alpha: 1;
      --pxi-glow-alpha: var(--pxi-glow);
      --pxi-anim-mult: 1;
    }
    &[data-pressed] {
      --pxi-stroke-alpha: 1;
      --pxi-glow-alpha: calc(var(--pxi-glow) * 0.6);
    }
    &[data-focus-visible] {
      /* the system focus ring stays the system focus ring — the AI treatment
         must never impersonate focus */
      outline: var(--global-border-size-thick) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
    &[data-disabled] {
      opacity: var(--global-opacity-disabled);
      cursor: default;
    }

    &[data-size="M"] {
      height: var(--global-button-height-m);
      padding: 0 var(--global-dimension-static-size-200);
    }
    &[data-size="S"] {
      height: var(--global-button-height-s);
      padding: 0 var(--global-dimension-static-size-115);
      font-size: var(--global-font-size-xs);
    }

    &[data-pxi-variant="primary"] {
      background-color: var(--global-button-primary-background-color);
      color: var(--global-button-primary-foreground-color);
    }

    &[data-pxi-variant="quiet"] {
      background-color: transparent;
      color: var(--global-text-color-700);
      --pxi-stroke-alpha: 0;
      --pxi-glow-alpha: 0;

      &[data-size="M"] {
        width: var(--global-button-height-m);
        padding: 0;
        justify-content: center;
      }
      &[data-size="S"] {
        width: var(--global-button-height-s);
        padding: 0;
        justify-content: center;
      }
      &[data-hovered] {
        background-color: var(--hover-background);
        color: var(--global-text-color-900);
        --pxi-stroke-alpha: 0.9;
        --pxi-glow-alpha: calc(var(--pxi-glow) * 0.5);
      }
      &[data-pressed] {
        background-color: var(--global-color-primary-100);
      }
    }
  }

  .pxi-solve-button__glyph {
    display: inline-flex;
    flex-shrink: 0;
    /* the glyph carries the brand tint even when the chrome is quiet */
    color: var(--pxi-c2);
  }

  /* --- ring decorator ---------------------------------------------------- */

  .pxi-ring {
    display: block;
    border-radius: var(--pxi-radius);
    --pxi-ring-inset: calc(-1 * (var(--pxi-ring-width) + 3px));

    &::before {
      inset: var(--pxi-ring-inset);
      border-radius: calc(var(--pxi-radius) + 3px);
      z-index: 2;
    }
    &::after {
      inset: var(--pxi-ring-inset);
      border-radius: calc(var(--pxi-radius) + 3px);
      /* hosts (Card, Select) may be transparent — confine the glow to a band
         around the edge so it halos the element instead of tinting its body */
      padding: calc(var(--pxi-ring-width) * 4 + 6px);
      ${ringMask}
    }

    &[data-pxi-state="idle"] {
      --pxi-stroke-alpha: 0.3;
      --pxi-glow-alpha: 0;
      --pxi-anim-play: paused;
    }
    &[data-pxi-state="eligible"] {
      --pxi-stroke-alpha: 0.6;
      --pxi-glow-alpha: calc(var(--pxi-glow) * 0.3);
      --pxi-anim-mult: 2.5;
    }
    &[data-pxi-state="active"] {
      --pxi-stroke-alpha: 1;
      --pxi-glow-alpha: var(--pxi-glow);
      --pxi-anim-mult: 1;
    }
  }

  /* --- provenance tag ----------------------------------------------------- */

  .pxi-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-static-size-50);
    padding: 1px var(--global-dimension-static-size-100) 1px
      var(--global-dimension-static-size-75);
    border-radius: var(--global-rounding-full);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
    --pxi-stroke-alpha: 0.65;
    --pxi-glow-alpha: 0;
    --pxi-anim-mult: 3;

    &::before {
      /* chips always take a hairline regardless of the ring-width knob */
      padding: 1px;
    }

    .pxi-tag__glyph {
      display: inline-flex;
      color: var(--pxi-c2);
    }
  }

  /* --- hover reveal (messageToolbarCSS technique) ------------------------- */

  .pxi-hover-reveal {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-static-size-100);
  }
  .pxi-hover-reveal__affordance {
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .pxi-hover-reveal:hover .pxi-hover-reveal__affordance,
  .pxi-hover-reveal:focus-within .pxi-hover-reveal__affordance,
  .pxi-hover-reveal__affordance:has([aria-expanded="true"]) {
    opacity: 1;
  }
  @media (hover: none) {
    .pxi-hover-reveal__affordance {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pxi-hover-reveal__affordance {
      transition: none;
    }
  }

  /* --- menu / listbox item accent ------------------------------------------ */

  .pxi-menu-item__glyph {
    display: inline-flex;
    color: var(--pxi-c2);
  }
  .pxi-menu-item[data-hovered],
  .pxi-menu-item[data-focused] {
    background-color: color-mix(in srgb, var(--pxi-c2) 14%, transparent);
  }

  /* ====================================================================== */
  /* treatment: conic — animated conic-gradient border sweep                */
  /* ====================================================================== */

  &[data-pxi-treatment="conic"] {
    .pxi-solve-button::before,
    .pxi-ring::before,
    .pxi-tag::before {
      background: conic-gradient(
        from calc(var(--pxi-angle) + 45deg),
        var(--pxi-c1),
        var(--pxi-c2),
        var(--pxi-c3),
        var(--pxi-c1)
      );
      animation: ${pxiSpin} calc(var(--pxi-speed) * var(--pxi-anim-mult, 1))
        linear infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    .pxi-solve-button::after,
    .pxi-ring::after {
      background: conic-gradient(
        from calc(var(--pxi-angle) + 45deg),
        var(--pxi-c1),
        var(--pxi-c2),
        var(--pxi-c3),
        var(--pxi-c1)
      );
      filter: blur(var(--pxi-spread)) saturate(1.25);
      animation: ${pxiSpin} calc(var(--pxi-speed) * var(--pxi-anim-mult, 1))
        linear infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    &[data-theme="light"] {
      .pxi-solve-button::after,
      .pxi-ring::after {
        opacity: calc(var(--pxi-glow-alpha) * 0.75);
      }
    }
  }

  /* ====================================================================== */
  /* treatment: aurora — hairline stroke + blurred drifting halo            */
  /* ====================================================================== */

  &[data-pxi-treatment="aurora"] {
    .pxi-solve-button::before,
    .pxi-ring::before,
    .pxi-tag::before {
      background: linear-gradient(
        120deg,
        var(--pxi-c1),
        var(--pxi-c2),
        var(--pxi-c3)
      );
      opacity: calc(var(--pxi-stroke-alpha) * 0.75);
    }
    .pxi-solve-button::after,
    .pxi-ring::after {
      background:
        radial-gradient(80% 100% at 15% 0%, var(--pxi-c1) 0%, transparent 65%),
        radial-gradient(
          80% 100% at 85% 100%,
          var(--pxi-c3) 0%,
          transparent 65%
        ),
        radial-gradient(60% 80% at 70% 10%, var(--pxi-c2) 0%, transparent 70%);
      background-size:
        170% 170%,
        170% 170%,
        170% 170%;
      filter: blur(var(--pxi-spread));
      animation: ${pxiAuroraDrift}
        calc(var(--pxi-speed) * 3 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    &[data-theme="dark"] {
      .pxi-solve-button::after,
      .pxi-ring::after {
        mix-blend-mode: plus-lighter;
      }
    }
    &[data-theme="light"] {
      .pxi-solve-button::after,
      .pxi-ring::after {
        opacity: calc(var(--pxi-glow-alpha) * 0.65);
        filter: blur(var(--pxi-spread)) saturate(1.4);
      }
    }
  }

  /* ====================================================================== */
  /* treatment: mono — hairline at rest, border shimmer + glyph tint on demand */
  /* ====================================================================== */

  &[data-pxi-treatment="mono"] {
    .pxi-solve-button::before,
    .pxi-ring::before,
    .pxi-tag::before {
      /* layer 1: traveling color band (transparent until animated states
         raise its alpha); layer 2: constant hairline */
      background-image:
        linear-gradient(
          90deg,
          transparent 20%,
          var(--pxi-c1) 40%,
          var(--pxi-c2) 50%,
          var(--pxi-c3) 60%,
          transparent 80%
        ),
        linear-gradient(
          var(--global-text-color-300),
          var(--global-text-color-300)
        );
      background-size:
        250% 100%,
        100% 100%;
      background-position:
        200% 0,
        0 0;
      background-repeat: no-repeat, no-repeat;
    }
    /* the wipe runs only when the element is in a lively state */
    .pxi-solve-button[data-hovered]::before,
    .pxi-solve-button[data-pressed]::before,
    .pxi-ring[data-pxi-state="active"]::before,
    .pxi-ring[data-pxi-state="eligible"]::before {
      animation: ${pxiWipe} calc(var(--pxi-speed) * var(--pxi-anim-mult, 1))
        ease-in-out infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    /* restraint: no halo at all */
    .pxi-solve-button::after,
    .pxi-ring::after,
    .pxi-tag::after {
      display: none;
    }
    /* monochrome glyph until interaction earns the tint */
    .pxi-solve-button__glyph,
    .pxi-tag__glyph,
    .pxi-menu-item__glyph {
      color: currentColor;
    }
    .pxi-solve-button[data-hovered] .pxi-solve-button__glyph {
      color: var(--pxi-c2);
    }
    .pxi-menu-item[data-hovered],
    .pxi-menu-item[data-focused] {
      background-color: var(--hover-background);
    }
  }

  /* ====================================================================== */
  /* treatment: glass — tinted translucency, static gradient hairline       */
  /* ====================================================================== */

  &[data-pxi-treatment="glass"] {
    .pxi-solve-button,
    .pxi-tag {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--pxi-c1) 16%, transparent),
        color-mix(in srgb, var(--pxi-c3) 10%, transparent)
      );
      backdrop-filter: blur(8px) saturate(1.5);
      color: var(--global-text-color-900);
    }
    .pxi-solve-button[data-hovered] {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--pxi-c1) 26%, transparent),
        color-mix(in srgb, var(--pxi-c3) 18%, transparent)
      );
    }
    .pxi-solve-button::before,
    .pxi-ring::before,
    .pxi-tag::before {
      background: linear-gradient(
        135deg,
        var(--pxi-c1),
        var(--pxi-c2),
        var(--pxi-c3)
      );
      opacity: calc(var(--pxi-stroke-alpha) * 0.8);
    }
    .pxi-solve-button::after,
    .pxi-ring::after {
      background: radial-gradient(
        100% 100% at 50% 120%,
        var(--pxi-c2),
        transparent 70%
      );
      filter: blur(var(--pxi-spread));
      opacity: calc(var(--pxi-glow-alpha) * 0.6);
    }
    &[data-theme="dark"] {
      .pxi-solve-button,
      .pxi-tag {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
      }
    }
    &[data-theme="light"] {
      .pxi-solve-button,
      .pxi-tag {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }
    }
  }

  /* ====================================================================== */
  /* motion control — freeze, don't remove (gradients stay legible)         */
  /* ====================================================================== */

  &[data-pxi-motion="off"] {
    .pxi-solve-button::before,
    .pxi-solve-button::after,
    .pxi-ring::before,
    .pxi-ring::after,
    .pxi-tag::before {
      animation-play-state: paused !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pxi-solve-button::before,
    .pxi-solve-button::after,
    .pxi-ring::before,
    .pxi-ring::after,
    .pxi-tag::before {
      animation-play-state: paused !important;
    }
  }
`;
