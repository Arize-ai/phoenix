import { css, keyframes } from "@emotion/react";

/**
 * Solve-with-PXI affordance styling.
 *
 * Architecture: components (SolveWithPxiButton, PxiRing, PxiTag, menu items)
 * only emit structure + data attributes. All paint lives here, keyed off a
 * scope element that carries:
 *   - data-pxi-treatment="conic|aurora|glass"       (structural style switch)
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

const pxiAuroraDrift = keyframes`
  0%, 100% {
    background-position: 0% 0%, 100% 100%, 60% 0%;
  }
  50% {
    background-position: 45% 30%, 55% 60%, 20% 40%;
  }
`;

/** diagonal iridescent slide for the glass hairline + glow (ping-pong, seamless) */
const pxiGlassShimmer = keyframes`
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
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

  /* theme-tuned shared tokens (consumed by the secondary button + glass) */
  &[data-theme="light"] {
    --pxi-inner-light: rgba(255, 255, 255, 0.62);
  }
  &[data-theme="dark"] {
    --pxi-inner-light: rgba(255, 255, 255, 0.2);
  }

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
      /* TEMP: glow layer disabled for evaluation */
      display: none;
    }
  }

  /* --- trigger button --------------------------------------------------- */

  .pxi-solve-button {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    border: none;
    cursor: pointer;
    box-sizing: border-box;
    font-size: var(--global-font-size-s);
    font-weight: 500;
    font-family: inherit;
    line-height: 1;
    /* grayscale AA so the light-on-dark secondary label doesn't render a weight
       heavier than the dark-on-light primary under macOS subpixel smoothing */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border-radius: var(--pxi-button-radius, var(--global-rounding-small));
    transition:
      color 0.15s ease,
      background-color 0.15s ease,
      filter 0.15s ease;

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

    /* icon-only collapses any variant to a square, glyph-centered button
       while leaving its border/fill treatment intact */
    &[data-icon-only="true"] {
      padding: 0;
      justify-content: center;
      &[data-size="M"] {
        width: var(--global-button-height-m);
      }
      &[data-size="S"] {
        width: var(--global-button-height-s);
      }
    }

    /* primary = Phoenix's inverted button as the base — a neutral fill that
       flips per theme (near-black + light text in light theme, whiteish +
       dark text in dark theme) — dressed with the gradient treatment turned
       up past the secondary hairline. The fill carries the action; the
       animated stroke + halo carry the brand. On dark theme this reads like a
       PxiRing-framed panel: a light surface ringed and haloed in gradient. */
    &[data-pxi-variant="primary"] {
      background-color: var(--global-button-primary-background-color);
      /* Colored treatment overlay lives ON the fill, behind the text. Each
         treatment sets --pxi-fill-overlay (a gradient) below; this is the
         resting-state "glow" that used to be the ::after halo. It lifts away
         on hover, leaving the clean bright fill. */
      background-image: var(--pxi-fill-overlay, none);
      /* Crisp inverted foreground by default. Only tint the label toward the
         brand mid-stop in LIGHT theme: there the foreground is the light gray,
         so a little --pxi-c2 reads as a cool cast at no contrast cost. In dark
         theme the foreground is the dark gray on a light fill, where the same
         mix only lifts its luminance and makes the text look thin — so leave it
         crisp and let the colored glyph carry the brand. */
      color: var(--global-button-primary-foreground-color);
      [data-theme="light"] & {
        color: color-mix(
          in srgb,
          var(--global-button-primary-foreground-color) 88%,
          var(--pxi-c2)
        );
      }
      /* the gradient border stuff, stronger than the secondary hairline */
      --pxi-stroke-alpha: 1;
      --pxi-glow-alpha: calc(var(--pxi-glow) * 0.55);

      /* Face the gradient inward. A crisp hairline is stranded between two
         high-contrast fields (the neutral fill and the canvas), so one edge
         always washes out — but a *wide* band just reads as a rigid, thick
         border that never fades. The fix is a thin band feathered by a blur
         several times its own width: the band's flat core all but vanishes and
         what's left is a soft halo that ramps off onto the fill and the canvas
         alike. Keep blur >> band width or the border reads hard again. */
      &::before {
        padding: var(--pxi-ring-width);
        filter: blur(5px) saturate(1.15);
      }

      /* glyph keeps its full brand color (--pxi-c2) against the inverted fill,
         rather than collapsing to the foreground like it used to */
      &[data-hovered] {
        /* Hover resolves to the clean, bright resting fill — no dim toward
           gray-800 — and drops the colored overlay. Rest is colored; hover is
           crisp. */
        background-color: var(--global-button-primary-background-color);
        background-image: none;
        --pxi-stroke-alpha: 1;
        --pxi-anim-mult: 1;
      }
      &[data-pressed] {
        --pxi-stroke-alpha: 1;
        --pxi-glow-alpha: calc(var(--pxi-glow) * 0.6);
        filter: brightness(0.98);
      }
    }

    /* secondary = bordered normal action: gradient hairline + subtle tint */
    &[data-pxi-variant="secondary"] {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--pxi-c1) 14%, transparent),
        color-mix(in srgb, var(--pxi-c3) 9%, transparent)
      );
      backdrop-filter: blur(6px) saturate(1.4);
      box-shadow: inset 0 1px 0 var(--pxi-inner-light, rgba(255, 255, 255, 0.5));
      color: var(--global-text-color-900);
      /* the animated hairline IS the border */
      --pxi-stroke-alpha: 0.85;
      --pxi-glow-alpha: 0;

      &[data-hovered] {
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--pxi-c1) 22%, transparent),
          color-mix(in srgb, var(--pxi-c3) 15%, transparent)
        );
        --pxi-stroke-alpha: 1;
        --pxi-glow-alpha: calc(var(--pxi-glow) * 0.4);
      }
      &[data-pressed] {
        --pxi-glow-alpha: calc(var(--pxi-glow) * 0.25);
      }
    }

    &[data-pxi-variant="quiet"] {
      background-color: transparent;
      color: var(--global-text-color-700);
      --pxi-stroke-alpha: 0;
      --pxi-glow-alpha: 0;

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

  /* Glow carrier for the ring. The masked band is on ::before; the blur is on
     this element so it runs AFTER the mask (a single box always applies filter
     before mask, which re-hardens the clipped edge). Result: solid band, soft
     feathered edges. Treatments paint ::before's background + animation and may
     retune this element's opacity/blur/blend. */
  .pxi-ring__glow {
    --pxi-glow-band: calc(var(--pxi-ring-width) * 4 + 6px);
    position: absolute;
    inset: var(--pxi-ring-inset);
    z-index: -1;
    pointer-events: none;
    /* Inner corner radius is (outer radius − padding), clamped at 0: once the
       band is wider than the radius the inside corner squares off. Add the band
       width back so the inner corner keeps ~--pxi-radius and stays round. */
    border-radius: calc(var(--pxi-radius) + var(--pxi-glow-band));
    opacity: var(--pxi-glow-alpha);
    filter: blur(var(--pxi-spread));

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      /* hosts (Card, Select) may be transparent — confine the glow to a band
         around the edge so it halos the element instead of tinting its body */
      padding: var(--pxi-glow-band);
      ${ringMask}
    }
  }

  /* --- provenance tag ----------------------------------------------------- */

  .pxi-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-static-size-50);
    padding: 1px var(--global-dimension-static-size-100) 1px
      var(--global-dimension-size-75);
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
    /* resting colored overlay painted over the primary fill, behind the text */
    .pxi-solve-button[data-pxi-variant="primary"] {
      --pxi-fill-overlay: conic-gradient(
        from calc(var(--pxi-angle) + 45deg),
        color-mix(in srgb, var(--pxi-c1) 60%, transparent),
        color-mix(in srgb, var(--pxi-c2) 60%, transparent),
        color-mix(in srgb, var(--pxi-c3) 60%, transparent),
        color-mix(in srgb, var(--pxi-c1) 60%, transparent)
      );
      animation: ${pxiSpin} calc(var(--pxi-speed) * var(--pxi-anim-mult, 1))
        linear infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
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
    .pxi-ring__glow {
      filter: blur(var(--pxi-spread)) saturate(1.25);
    }
    .pxi-ring__glow::before {
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
    &[data-theme="light"] {
      .pxi-ring__glow {
        opacity: calc(var(--pxi-glow-alpha) * 0.75);
      }
    }
  }

  /* ====================================================================== */
  /* treatment: aurora — hairline stroke + blurred drifting halo            */
  /* ====================================================================== */

  &[data-pxi-treatment="aurora"] {
    /* resting colored overlay painted over the primary fill, behind the text */
    .pxi-solve-button[data-pxi-variant="primary"] {
      --pxi-fill-overlay:
        radial-gradient(
          80% 100% at 15% 0%,
          color-mix(in srgb, var(--pxi-c1) 65%, transparent) 0%,
          transparent 65%
        ),
        radial-gradient(
          80% 100% at 85% 100%,
          color-mix(in srgb, var(--pxi-c3) 65%, transparent) 0%,
          transparent 65%
        ),
        radial-gradient(
          60% 80% at 70% 10%,
          color-mix(in srgb, var(--pxi-c2) 65%, transparent) 0%,
          transparent 70%
        );
      background-size:
        170% 170%,
        170% 170%,
        170% 170%;
      animation: ${pxiAuroraDrift}
        calc(var(--pxi-speed) * 3 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
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
    .pxi-ring__glow::before {
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
      animation: ${pxiAuroraDrift}
        calc(var(--pxi-speed) * 3 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    &[data-theme="dark"] {
      .pxi-ring__glow {
        mix-blend-mode: plus-lighter;
      }
    }
    &[data-theme="light"] {
      .pxi-ring__glow {
        opacity: calc(var(--pxi-glow-alpha) * 0.65);
        filter: blur(var(--pxi-spread)) saturate(1.4);
      }
    }
  }

  /* ====================================================================== */
  /* treatment: glass — tinted translucency, animated iridescent hairline   */
  /* ====================================================================== */

  &[data-pxi-treatment="glass"] {
    .pxi-tag {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--pxi-c1) 16%, transparent),
        color-mix(in srgb, var(--pxi-c3) 10%, transparent)
      );
      backdrop-filter: blur(8px) saturate(1.5);
      color: var(--global-text-color-900);
    }
    /* resting colored overlay painted over the primary fill, behind the text */
    .pxi-solve-button[data-pxi-variant="primary"] {
      --pxi-fill-overlay: linear-gradient(
        135deg,
        color-mix(in srgb, var(--pxi-c1) 55%, transparent),
        color-mix(in srgb, var(--pxi-c2) 55%, transparent),
        color-mix(in srgb, var(--pxi-c3) 55%, transparent),
        color-mix(in srgb, var(--pxi-c2) 55%, transparent),
        color-mix(in srgb, var(--pxi-c1) 55%, transparent)
      );
      background-size: 250% 100%;
      animation: ${pxiGlassShimmer}
        calc(var(--pxi-speed) * 2 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    .pxi-solve-button::before,
    .pxi-ring::before,
    .pxi-tag::before {
      background: linear-gradient(
        135deg,
        var(--pxi-c1),
        var(--pxi-c2),
        var(--pxi-c3),
        var(--pxi-c2),
        var(--pxi-c1)
      );
      background-size: 250% 100%;
      opacity: calc(var(--pxi-stroke-alpha) * 0.8);
      animation: ${pxiGlassShimmer}
        calc(var(--pxi-speed) * 2 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    .pxi-ring__glow {
      opacity: calc(var(--pxi-glow-alpha) * 0.6);
    }
    .pxi-ring__glow::before {
      background: radial-gradient(
        60% 100% at 50% 120%,
        var(--pxi-c2),
        transparent 70%
      );
      background-size: 200% 200%;
      animation: ${pxiGlassShimmer}
        calc(var(--pxi-speed) * 2 * var(--pxi-anim-mult, 1)) ease-in-out
        infinite;
      animation-play-state: var(--pxi-anim-play, running);
    }
    &[data-theme="dark"] {
      .pxi-tag {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
      }
    }
    &[data-theme="light"] {
      .pxi-tag {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }
    }
  }

  /* ====================================================================== */
  /* motion control — freeze, don't remove (gradients stay legible)         */
  /* ====================================================================== */

  &[data-pxi-motion="off"] {
    .pxi-solve-button[data-pxi-variant="primary"],
    .pxi-solve-button::before,
    .pxi-solve-button::after,
    .pxi-ring::before,
    .pxi-ring__glow::before,
    .pxi-tag::before {
      animation-play-state: paused !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pxi-solve-button[data-pxi-variant="primary"],
    .pxi-solve-button::before,
    .pxi-solve-button::after,
    .pxi-ring::before,
    .pxi-ring__glow::before,
    .pxi-tag::before {
      animation-play-state: paused !important;
    }
  }
`;
