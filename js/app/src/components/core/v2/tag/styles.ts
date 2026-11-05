import { css } from "@emotion/react";

import { derivedColorCSS, familySizeCSS, truncatedTextCSS } from "../styles";

/**
 * The hues a person can pick for a tag: the label and split color pickers'
 * swatches, each the `-500` step of a global color scale, plus neutral.
 */
export const TAG_COLORS = [
  "neutral",
  "red",
  "orange",
  "yellow",
  "chartreuse",
  "celery",
  "green",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "fuchsia",
  "magenta",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Shared by the standalone `Tag` and the tags a `TagGroup` renders, so a tag
 * looks the same alone and in a set. React Aria sets the state attributes on
 * whichever element owns the press: the tag itself, or its body button.
 */
export const tagCSS = css`
  ${familySizeCSS};
  ${derivedColorCSS};
  ${TAG_COLORS.filter((color) => color !== "neutral")
    .map(
      (color) =>
        `&[data-color="${color}"] { --family-base-color: var(--global-color-${color}-500); }`
    )
    .join("\n")}
  max-width: var(--tag-max-width, 100%);
  border-radius: var(--global-rounding-small);
  outline: none;
  cursor: default;
  user-select: none;
  text-decoration: none;
  forced-color-adjust: none;

  &[data-size="S"] {
    --tag-remove-size: var(--global-dimension-size-150);
  }
  &[data-size="M"] {
    --tag-remove-size: var(--global-dimension-size-175);
  }
  &[data-removable] {
    padding-inline-end: var(--global-dimension-size-25);
  }

  &[data-interactive] {
    cursor: pointer;
  }
  &[data-hovered],
  &:has(> .tag-v2__body[data-hovered]) {
    background-color: var(--family-bg-color-hover);
    border-color: var(--family-border-color-hover);
  }
  &[data-pressed],
  &:has(> .tag-v2__body[data-pressed]) {
    background-color: var(--family-bg-color-pressed);
  }
  &[data-focus-visible],
  &:has(> .tag-v2__body[data-focus-visible]) {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  &[data-selected] {
    background-color: var(--family-text-color);
    border-color: var(--family-text-color);
    color: var(--global-background-color-default);
  }
  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }

  .tag-v2__body {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: inherit;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-decoration: none;
    cursor: inherit;
    outline: none;
  }
  .tag-v2__leading-visual {
    display: flex;
    flex: none;
    font-size: 1em;
  }
  .tag-v2__text {
    ${truncatedTextCSS};
  }
  .tag-v2__remove {
    appearance: none;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--tag-remove-size);
    height: var(--tag-remove-size);
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--global-rounding-xsmall);
    background: none;
    color: inherit;
    font-size: calc(var(--tag-remove-size) * 0.7);
    cursor: pointer;
    outline: none;

    &[data-hovered] {
      background-color: color-mix(in srgb, currentColor 18%, transparent);
    }
    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
    &[data-disabled] {
      cursor: not-allowed;
    }
  }
`;
