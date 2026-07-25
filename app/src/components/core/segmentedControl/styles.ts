import { css } from "@emotion/react";

/**
 * The track. Sizing tokens are declared here rather than on the item so the
 * whole control scales from a single `data-size`, and so the item can stay
 * agnostic of which size it was rendered at.
 */
export const segmentedControlCSS = css`
  /* Matches buttons and fields — the control has to line up with them in a
     toolbar. */
  --segmented-control-rounding: var(--global-rounding-small);
  /* Segments span the track's full height (no vertical inset), so the control
     reads cleanly at any height and the thumb fills the corner it sits in.
     With the thumb flush against the border, concentric rounding
     (track − border) is exact rather than an approximation. */
  --segmented-control-item-rounding: calc(
    var(--segmented-control-rounding) - var(--global-border-size-thin)
  );
  /* One clock for every moving part — label color, divider fade, hover pill,
     and the thumb itself. Mixed durations make pieces of the control arrive
     at different times, which reads as stutter. */
  --segmented-control-motion-duration: 200ms;
  /* Leaves at full speed and decelerates into place, so motion reads as
     following the click rather than winding up first. */
  --segmented-control-motion-easing: cubic-bezier(0, 0, 0.4, 1);

  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  /* Sized to its segments rather than left auto: a definite width opts the track
     out of a flex parent's align-items: stretch, which would otherwise widen the
     track without widening the segments and leave dead track past the last one.
     The data-justified rule below overrides this to fill the container on
     purpose. */
  width: fit-content;
  max-width: 100%;
  /* Segments touch; a divider (on the item) separates unselected neighbors.
     A gap here would put daylight between the thumb and its neighbors, which
     reads as segments floating in the track rather than one control. */
  gap: 0;
  background-color: var(--global-segmented-control-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-segmented-control-border-color);
  border-radius: var(--segmented-control-rounding);

  /* Labels hold at 14px from S to M, matching Button and Select, which use one
     label size across those heights — a segmented control sits directly beside
     them in a toolbar, and a smaller label there reads as a caption rather than
     as a peer control. Only L steps up. */
  &[data-size="S"] {
    height: var(--global-button-height-s);
    --segmented-control-item-padding-x: var(--global-dimension-size-100);
    --segmented-control-item-font-size: var(--global-font-size-s);
    --segmented-control-item-line-height: var(--global-line-height-s);
  }

  &[data-size="M"] {
    height: var(--global-button-height-m);
    --segmented-control-item-padding-x: var(--global-dimension-size-150);
    --segmented-control-item-font-size: var(--global-font-size-s);
    --segmented-control-item-line-height: var(--global-line-height-s);
  }

  &[data-size="L"] {
    height: var(--global-button-height-l);
    --segmented-control-item-padding-x: var(--global-dimension-size-200);
    --segmented-control-item-font-size: var(--global-font-size-m);
    --segmented-control-item-line-height: var(--global-line-height-m);
  }

  /* Justified items share the track evenly and truncate rather than pushing
     the control wider than its container. */
  &[data-justified="true"] {
    width: 100%;

    .segmented-control__item {
      flex: 1 1 0;
    }
  }

  /* Divider between adjacent segments, hidden on either side of the selected
     one so the thumb's own edge does the separating there. Drawn on the item
     (not the track) so it can follow the selection, and kept above the thumb's
     z-index so it holds steady while the thumb slides underneath. Matched on
     the stable BEM class rather than on the item's emotion class, so a segment
     handed its own \`css\` prop — a different generated class — still divides
     from its neighbors. */
  .segmented-control__item + .segmented-control__item::before {
    content: "";
    position: absolute;
    /* Centered on the seam between the two segments it separates. */
    left: calc(-1 * var(--global-border-size-thin) / 2);
    top: 25%;
    height: 50%;
    width: var(--global-border-size-thin);
    background-color: var(--global-segmented-control-divider-color);
    transition: opacity var(--segmented-control-motion-duration)
      var(--segmented-control-motion-easing);

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  .segmented-control__item[data-selected]::before,
  .segmented-control__item[data-selected] + .segmented-control__item::before {
    opacity: 0;
  }
`;

export const segmentedControlItemCSS = css`
  position: relative;
  /* The thumb lives inside the selected item and slides in from wherever the
     previous selection was, so the selected item is dropped below its
     siblings — otherwise an item late in the DOM would drag its thumb over
     the labels it passes on the way. Each item's z-index also establishes the
     stacking context that keeps its own thumb from escaping. */
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  /* Shrinkable so a control that outgrows its container truncates its labels
     (see the content box below) instead of spilling its segments outside the
     track — the item itself can't clip, since the thumb has to escape it. */
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  min-width: 0;
  margin: 0;
  padding: 0 var(--segmented-control-item-padding-x);
  border: none;
  background-color: transparent;
  border-radius: var(--segmented-control-item-rounding);
  color: var(--global-segmented-control-item-text-color);
  font-family: inherit;
  font-size: var(--segmented-control-item-font-size);
  line-height: var(--segmented-control-item-line-height);
  font-weight: 400;
  white-space: nowrap;
  /* Deliberately not clipped: the thumb is a child of the selected item and
     spends the whole animation outside that item's box on its way over. */
  overflow: visible;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  forced-color-adjust: none;
  outline: none;
  transition: color var(--segmented-control-motion-duration)
    var(--segmented-control-motion-easing);

  /* Reduced-motion overrides are declared alongside the transition they
     cancel: a single block on the track would tie with these rules on
     specificity and lose on source order, since the item and thumb styles are
     inserted after the track's. */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* Hover pill: a small inset shape rather than washing the whole segment,
     so hover reads as "this is clickable" without competing with the thumb.
     Sits behind the label within the item's own stacking context. */
  &::after {
    content: "";
    position: absolute;
    inset: var(--global-dimension-size-50);
    border-radius: var(--segmented-control-item-rounding);
    background-color: transparent;
    transition: background-color var(--segmented-control-motion-duration)
      var(--segmented-control-motion-easing);
    z-index: -1;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  /* Labels take the item's state color and size-driven font metrics rather
     than the Text component's own defaults, so unselected segments recede and
     the label tracks the control's data-size. Text always renders data-size,
     and matching on it outranks Text's own font rules instead of tying with
     them and depending on insertion order. */
  .text[data-size] {
    color: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  &[data-hovered]:not([data-selected]):not([data-disabled]) {
    color: var(--global-segmented-control-item-text-color-hover);

    &::after {
      background-color: var(
        --global-segmented-control-item-background-color-hover
      );
    }
  }

  &[data-selected] {
    color: var(--global-segmented-control-item-text-color-selected);
    z-index: 0;
  }

  &[data-disabled] {
    cursor: default;
    color: var(--global-segmented-control-item-text-color-disabled);
  }

  /* Inset the ring so it reads as belonging to the segment instead of
     spilling over the track's edge. */
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
`;

/**
 * The label row. Kept as its own box so the press animation scales the
 * content without disturbing the thumb's geometry.
 */
export const segmentedControlItemContentCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  /* Truncation lives here rather than on the item so that clipping the label
     never clips the thumb sliding past. */
  overflow: hidden;
  transition: scale var(--segmented-control-motion-duration)
    var(--segmented-control-motion-easing);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  [data-pressed] > & {
    scale: 0.96;
  }
`;

/**
 * The thumb behind the selected segment. react-aria re-parents it into the
 * newly selected item and seeds it with the previous segment's offset and
 * width, so animating `translate` and `width` is what makes it appear to
 * slide across and stretch into its new home. Segments are all the same
 * height, so `height` is deliberately left out — animating it only adds
 * jitter.
 */
export const segmentedControlThumbCSS = css`
  position: absolute;
  /* Bleed out by the track's border width so the thumb's border paints
     exactly on top of it — otherwise the two borders sit side by side and
     read as a doubled line around the selected segment. */
  top: calc(-1 * var(--global-border-size-thin));
  left: calc(-1 * var(--global-border-size-thin));
  width: calc(100% + 2 * var(--global-border-size-thin));
  height: calc(100% + 2 * var(--global-border-size-thin));
  box-sizing: border-box;
  z-index: -1;
  /* The thumb has no content of its own; containing it keeps the slide from
     invalidating layout or paint beyond its own box. */
  contain: strict;
  /* The resting translate is 0, but written with a percentage on purpose: a
     box-size-dependent translate can't be lifted to the compositor, so the
     slide stays on the main thread where it's resolved in the same style
     recalc as the width stretch every frame. A compositable translate keeps
     gliding whenever the main thread drops a frame (the click's re-render
     guarantees it does) while width stalls — the two desync and the thumb
     visibly wobbles, worst when segment widths differ a lot. Pinned to the
     main thread they can only stall together, so the thumb stays rigid. */
  translate: 0% 0px;
  background-color: var(--global-segmented-control-thumb-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-segmented-control-thumb-border-color);
  /* The bleed puts the thumb's border in the same place as the track's, so
     the two share one radius and the corners coincide exactly. */
  border-radius: var(--segmented-control-rounding);
  transition-property: translate, width;
  transition-duration: var(--segmented-control-motion-duration);
  transition-timing-function: var(--segmented-control-motion-easing);

  /* "transition: none" rather than a zero duration: react-aria only snapshots
     the outgoing thumb when the incoming one has a transition-property, so
     this is what actually skips the slide instead of running it instantly. */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
