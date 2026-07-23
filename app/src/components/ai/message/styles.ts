import { css } from "@emotion/react";

import { hoverRevealCSS } from "@phoenix/components/core/styles";

// ---------------------------------------------------------------------------
// Message (root container)
// ---------------------------------------------------------------------------

export const messageCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);

  &[data-from="user"] {
    align-items: flex-end;
  }

  &[data-from="assistant"] {
    align-items: flex-start;
    width: 100%;
  }
`;

// ---------------------------------------------------------------------------
// MessageContent
// ---------------------------------------------------------------------------

export const messageContentCSS = css`
  word-wrap: break-word;
  overflow-wrap: break-word;
  min-width: 0;

  [data-from="user"] > & {
    background-color: var(--message-user-background-color);
    color: var(--message-user-text-color);
    border-radius: var(--message-user-border-radius);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    max-width: 75%;
  }

  [data-from="assistant"] > & {
    color: var(--global-text-color-900);
    width: 100%;
  }
`;

// ---------------------------------------------------------------------------
// MessageActions (container row)
// ---------------------------------------------------------------------------

export const messageActionsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  margin-left: auto;
`;

// ---------------------------------------------------------------------------
// MessageAction (icon button)
// Mirrors promptInputButtonCSS from prompt-input/styles.ts
// ---------------------------------------------------------------------------

export const messageActionCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--global-border-size-thin) solid transparent;
  border-radius: var(--global-rounding-small);
  background-color: transparent;
  color: var(--global-text-color-700);
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  padding: 0;
  flex: none;
  width: var(--global-button-height-s);
  min-width: var(--global-button-height-s);
  height: var(--global-button-height-s);

  .icon-wrap {
    font-size: var(--global-font-size-l);
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  &[data-hovered] {
    background-color: var(--hover-background);
    .icon-wrap {
      opacity: 1;
    }
  }

  &[data-pressed] {
    background-color: var(--global-color-primary-100);
    color: var(--global-text-color-900);
  }

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }
`;

// ---------------------------------------------------------------------------
// MessageToolbar (footer row)
// ---------------------------------------------------------------------------

export const messageToolbarCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding-top: var(--global-dimension-size-50);
  width: 100%;

  /* Reveal-on-interaction: keep per-message action toolbars hidden by default
     to reduce the persistent visual noise of stacked toolbars, and reveal them
     when the message is hovered or contains keyboard focus. A message can opt
     out (always show) via [data-pin-toolbar="true"] on the Message root — used
     for the most recent assistant turn. */
  ${hoverRevealCSS}
  transition: opacity 0.12s ease;

  [data-from]:hover > &,
  [data-from]:focus-within > &,
  [data-pin-toolbar="true"] > & {
    opacity: 1;
  }

  /* Keep the toolbar visible while one of its actions has an open menu/popover.
     The popover is portaled out of the message and takes focus with it, so
     :hover and :focus-within on the message both drop — but the trigger button
     keeps aria-expanded set, so the toolbar anchoring the open menu stays put
     instead of fading out from under it. */
  &:has([aria-expanded="true"]) {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// ---------------------------------------------------------------------------
// MessageBranchSelector (nav container)
// ---------------------------------------------------------------------------

export const messageBranchSelectorCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
`;

// ---------------------------------------------------------------------------
// MessageBranchPage ("1 of 3" text)
// ---------------------------------------------------------------------------

export const messageBranchPageCSS = css`
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-s);
  white-space: nowrap;
  user-select: none;
`;
