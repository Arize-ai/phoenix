import { css } from "@emotion/react";

/**
 * The outlined pill worn by annotation labels and the controls that stand in for
 * them (an overflow row's "+N" badge), so the two cannot drift apart.
 */
export const clickablePillCSS = css`
  transition: background-color 0.2s;
  &[data-clickable="true"] {
    cursor: pointer;
    &:hover,
    &[data-hovered] {
      background-color: var(--global-color-gray-300);
    }
  }
`;

export const outlinedPillCSS = css`
  border-radius: var(--global-dimension-size-50);
  border: 1px solid var(--global-border-color-default);
  ${clickablePillCSS};
`;

/**
 * A thin vertical separator between inline text pieces (e.g. an annotation
 * label and its score, or a model name and its tool count). Tinted with the
 * current text color so it inherits the surrounding text's color.
 */
export const inlineDividerCSS = css`
  width: 1px;
  height: 0.7em;
  background-color: currentColor;
  opacity: 0.2;
`;

/**
 * Hover invitation for quiet interactive text (click-to-copy IDs, values that
 * reveal a tooltip): a subtle background wash that appears on hover without
 * shifting the text's position. Matches the quiet Button hover treatment.
 */
export const quietHoverCSS = css`
  cursor: pointer;
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-50);
  margin: calc(-1 * var(--global-dimension-size-25))
    calc(-1 * var(--global-dimension-size-50));
  transition: background-color 0.2s;
  &:hover,
  &[data-hovered] {
    background-color: var(--hover-background);
  }
`;

/**
 * The hidden half of a reveal-on-hover pair. Compose this into the control
 * itself (or a wrapper around a set of controls); the consumer supplies the
 * trigger, e.g. `&:hover .controls { opacity: 1 }` on the larger hover target.
 *
 * Hides via opacity rather than display/visibility so the control keeps its
 * box (nothing shifts when it appears) and stays focusable, then keeps it
 * reachable off the pointer: it also reveals on focus (WCAG 2.1 SC 1.4.13,
 * Content on Hover or Focus) and never hides at all where hover is
 * unavailable, since a touch device has no pre-tap state to reveal it in.
 */
export const revealOnHoverCSS = css`
  opacity: 0;

  &:hover,
  &:focus-within,
  &[data-hovered],
  &[data-focus-visible] {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
`;
