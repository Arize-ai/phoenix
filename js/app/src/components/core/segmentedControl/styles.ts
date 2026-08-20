import { css } from "@emotion/react";

/** Sizing lives on the track so the control scales from a single data-size. */
export const segmentedControlCSS = css`
  --segmented-control-rounding: var(--global-rounding-small);
  /* Concentric with the track, since segments span its full height. */
  --segmented-control-item-rounding: calc(
    var(--segmented-control-rounding) - var(--global-border-size-thin)
  );
  /* One clock for every moving part; mixed durations read as stutter. */
  --segmented-control-motion-duration: 200ms;
  --segmented-control-motion-easing: cubic-bezier(0, 0, 0.4, 1);

  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  /* A definite width opts out of a flex parent's align-items: stretch, which
     would widen the track without widening the segments. */
  width: fit-content;
  max-width: 100%;
  background-color: var(--global-segmented-control-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-segmented-control-border-color);
  border-radius: var(--segmented-control-rounding);

  /* Labels hold at 14px through M to match Button and Select in a toolbar. */
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

  &[data-justified="true"] {
    width: 100%;

    .segmented-control__item {
      flex: 1 1 0;
    }
  }

  /* Keyed on the BEM class, not the item's emotion class, so an item given its
     own css prop still divides from its neighbors. */
  .segmented-control__item + .segmented-control__item::before {
    content: "";
    position: absolute;
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

  /* Beside the thumb, the thumb's own edge does the separating. */
  .segmented-control__item[data-selected]::before,
  .segmented-control__item[data-selected] + .segmented-control__item::before {
    opacity: 0;
  }
`;

export const segmentedControlItemCSS = css`
  position: relative;
  /* The thumb is a child of the selected item and slides in from the previous
     one, so the selected item drops below its siblings (see [data-selected]) to
     keep the thumb from crossing over the labels it passes. */
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  /* Shrinkable, so an oversized control truncates labels rather than spilling
     segments outside the track. */
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
  /* Not clipped: the thumb spends the animation outside this box. */
  overflow: visible;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  forced-color-adjust: none;
  outline: none;
  transition: color var(--segmented-control-motion-duration)
    var(--segmented-control-motion-easing);

  /* Every reduced-motion override sits with the transition it cancels: one
     block on the track would tie on specificity and lose on source order. */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* Hover pill, inset so it reads as clickable without competing with the
     thumb. */
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

  /* Matching on data-size outranks Text's own font rules instead of tying with
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

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
`;

/** Its own box so the press animation leaves the thumb's geometry alone. */
export const segmentedControlItemContentCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  /* Here rather than on the item, so clipping the label never clips the thumb. */
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
 * react-aria re-parents the thumb into the newly selected item and seeds it with
 * the previous segment's offset and width, so animating translate and width is
 * what makes it slide across and stretch. Height is deliberately left out —
 * segments are all the same height, and animating it only adds jitter.
 */
export const segmentedControlThumbCSS = css`
  position: absolute;
  /* Bleeds out by the track's border width so the two borders paint on top of
     each other instead of reading as a doubled line. */
  top: calc(-1 * var(--global-border-size-thin));
  left: calc(-1 * var(--global-border-size-thin));
  width: calc(100% + 2 * var(--global-border-size-thin));
  height: calc(100% + 2 * var(--global-border-size-thin));
  box-sizing: border-box;
  z-index: -1;
  contain: strict;
  /* Zero, but written as a percentage on purpose: a box-size-dependent translate
     can't be lifted to the compositor, so it stays on the main thread and
     resolves in the same style recalc as the width stretch. Left compositable,
     it keeps gliding through dropped frames while width stalls, and the thumb
     visibly wobbles. */
  translate: 0% 0px;
  background-color: var(--global-segmented-control-thumb-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-segmented-control-thumb-border-color);
  border-radius: var(--segmented-control-rounding);
  transition-property: translate, width;
  transition-duration: var(--segmented-control-motion-duration);
  transition-timing-function: var(--segmented-control-motion-easing);

  /* none, not a zero duration: react-aria only snapshots the outgoing thumb when
     the incoming one has a transition-property. */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
