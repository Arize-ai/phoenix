import { css } from "@emotion/react";

export const disclosureGroupCSS = css`
  & > * {
    width: 100%;
  }

  // add border between items, only when child is expanded
  > .disclosure:not(:last-child) {
    &[data-expanded="true"] {
      border-bottom: 1px solid var(--global-disclosure-border-color);
    }
  }

  // a collapsed last item sits against the edge of whatever holds the group,
  // so the rule its trigger would draw is either a double line or a dangling one
  > .disclosure:last-child:not([data-expanded="true"]) {
    .react-aria-Button[slot="trigger"] {
      border-bottom: none;
    }
  }

  &[data-size="S"] > * {
    .react-aria-Heading {
      .react-aria-Button[slot="trigger"] {
        padding: var(--global-dimension-size-50);
      }
    }
  }
`;

export const disclosureCSS = css`
  .react-aria-Heading {
    margin: 0;
  }

  [slot="trigger"] {
    // reset trigger styles
    background: none;
    border: none;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    // the trigger fills its row, and its content row can shrink below the
    // width of an unbreakable token so text inside it can truncate
    width: 100%;
    box-sizing: border-box;
    > .flex {
      min-width: 0;
    }
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);

    // style trigger
    color: var(--global-text-color-900);
    border-bottom: 1px solid var(--global-disclosure-border-color);
    outline: none;
    background-color: transparent;
    &:hover:not([disabled]) {
      background-color: var(--global-disclosure-background-color-active);
    }
    &[data-focus-visible] {
      position: relative;
      z-index: 1;
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
    // only the hover tint animates. Animating every property would also
    // animate the rule under the trigger as it toggles between none and a
    // colored line, and a border with no color of its own is the text color,
    // so the line would sweep in from white
    &:not([disabled]) {
      transition: background-color 0.2s ease-in-out;
    }
    &[disabled] {
      cursor: default;
      opacity: 0.6;
    }

    // style trigger icon
    > svg,
    > i {
      rotate: 90deg;
      transition: rotate 200ms ease-in-out;
      width: 1em;
      height: 1em;
      fill: currentColor;
      color: var(--global-text-color-500);
    }

    &[data-arrow-position="start"] {
      flex-direction: row-reverse;
      > svg,
      > i {
        rotate: 0deg;
      }
    }
  }

  &[data-size="L"] .react-aria-Button[slot="trigger"] {
    height: 48px;
    max-height: 48px;
  }

  &[data-expanded] .react-aria-Button[slot="trigger"] {
    > svg,
    > i {
      rotate: -90deg;
    }

    &[data-arrow-position="start"] {
      > svg,
      > i {
        rotate: 90deg;
      }
    }
  }
`;
