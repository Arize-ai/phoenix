import { css } from "@emotion/react";

export const sectionNavCSS = css`
  // Sticky at the top of the scroll container so the links stay reachable
  // while the sections scroll beneath them. The rail variant sits beside the
  // sections and sticks the same way.
  position: sticky;
  top: 0;
  // Paint over the section content scrolling under the bar, which would
  // otherwise show through or over it.
  z-index: 1;
  flex: none;
  box-sizing: border-box;
  background-color: var(
    --section-nav-background-color,
    var(--global-background-color-default)
  );

  &[data-orientation="horizontal"] {
    // The same bottom edge as the tab bar, drawn as an inset shadow so the
    // links' indicator paints over it.
    box-shadow: inset 0 -1px 0 0 var(--global-border-color-default);
  }

  &[data-orientation="vertical"] {
    // In a flex row beside the sections, stretching would make the rail as
    // tall as the content and leave nothing for sticky positioning to do.
    align-self: flex-start;
  }

  .section-nav__list {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .section-nav__list[data-orientation="horizontal"] {
    flex-direction: row;
    // Narrow containers and high zoom scroll the bar sideways rather than
    // wrapping or truncating labels.
    overflow-x: auto;
    // Keep a link that receives keyboard focus clear of the edge fade when the
    // browser scrolls it into view.
    scroll-padding-inline: var(--section-nav-fade-size);
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }

    // The tab bar's directional fade: each edge with links hidden beyond it
    // dissolves, hinting that the bar can be scrolled.
    --section-nav-fade-size: var(--global-dimension-size-400);
    --section-nav-fade-start: 0px;
    --section-nav-fade-end: 0px;
    &[data-overflow-start="true"] {
      --section-nav-fade-start: var(--section-nav-fade-size);
    }
    &[data-overflow-end="true"] {
      --section-nav-fade-end: var(--section-nav-fade-size);
    }
    &:is([data-overflow-start="true"], [data-overflow-end="true"]) {
      mask-image: linear-gradient(
        to right,
        transparent,
        black var(--section-nav-fade-start),
        black calc(100% - var(--section-nav-fade-end)),
        transparent
      );
    }
  }

  .section-nav__list[data-orientation="vertical"] {
    flex-direction: column;
  }

  .section-nav__item {
    display: flex;
    flex: 0 0 auto;
  }

  .section-nav__link {
    display: flex;
    align-items: center;
    position: relative;
    // The hover pill and active rail pill sit at z-index -1; isolate the link
    // so they paint just behind its label.
    isolation: isolate;
    box-sizing: border-box;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    color: var(--global-text-color-700);
    font-weight: 400;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    white-space: nowrap;
    text-decoration: none;
    outline: none;
    transition: color 150ms ease-out;
    forced-color-adjust: none;
    -webkit-tap-highlight-color: transparent;

    // The tab's hover pill, inset from the hit area so adjacent pills never
    // touch.
    &:before {
      content: "";
      position: absolute;
      inset: var(--section-nav-pill-inset, var(--global-dimension-size-50));
      border-radius: var(--global-rounding-small);
      transition: background 150ms ease-out;
      z-index: -1;
    }

    &:hover,
    &:focus-visible,
    &[aria-current="true"] {
      color: var(--global-text-color-900);
    }

    // Weight, not only color, marks the current link, so the state does not
    // rest on color alone.
    &[aria-current="true"] {
      font-weight: 600;
    }

    &:hover:not([aria-current="true"]):before {
      background: var(--global-color-primary-50);
    }

    // Drawn inside the link, so the list's horizontal scroll clipping never
    // cuts the ring off.
    &:focus-visible:after {
      content: "";
      position: absolute;
      inset: var(--section-nav-pill-inset, var(--global-dimension-size-50));
      border-radius: var(--global-rounding-small);
      border: var(--focus-ring-thickness) solid var(--focus-ring-color);
    }
  }

  // The bold active label is wider than the regular one. Reserve the bold
  // width on every link so links do not shift sideways as the active one
  // changes during scrolling.
  .section-nav__label {
    display: inline-grid;
    &:after {
      content: attr(data-label);
      grid-area: 1 / 1;
      font-weight: 600;
      visibility: hidden;
      height: 0;
      overflow: hidden;
      user-select: none;
    }
    > span {
      grid-area: 1 / 1;
    }
  }

  // The tab's sliding indicator, moved between links by react-aria's
  // SharedElementTransition.
  .section-nav__indicator {
    position: absolute;
    border-radius: var(--global-rounding-small);
    transition-property: translate, width, height;
    transition-duration: 250ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  &[data-orientation="horizontal"] .section-nav__indicator {
    left: 0;
    bottom: 0;
    width: 100%;
    height: 3px;
    background: var(--global-color-primary);
    z-index: 1;
  }

  // The rail marks the active link with the tab rail's filled pill, and uses
  // the tab rail's tighter pill inset.
  &[data-orientation="vertical"] {
    --section-nav-pill-inset: var(--global-dimension-size-25)
      var(--global-dimension-size-50);
    .section-nav__indicator {
      inset: var(--section-nav-pill-inset);
      background: var(--global-color-primary-100);
      z-index: -1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .section-nav__link,
    .section-nav__link:before,
    .section-nav__indicator {
      transition: none;
    }
  }
`;

export const sectionNavSectionCSS = css`
  // Land anchor jumps below the sticky bar. SectionNav sets the variable on
  // the scroll container to the bar's height.
  scroll-margin-top: var(--section-nav-height, 0px);

  &:focus {
    outline: none;
  }
  // Clicking a link moves focus here. Keyboard users get a ring inset into
  // the section, so the scroll container's edges cannot clip it.
  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
`;
