import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import type { LinkProps } from "react-router";
import { Link } from "react-router";

export type TimelineProps = PropsWithChildren<{
  /**
   * Whether more items follow the last rendered one. The last item's
   * separator then fades out instead of ending at the item.
   * @default false
   */
  isTruncated?: boolean;
}>;

const timelineCSS = css`
  --timeline-indicator-size: var(--global-dimension-size-125);
  --timeline-indicator-color: var(--global-color-gray-500);
  --timeline-separator-width: var(--global-dimension-size-25);
  --timeline-separator-color: var(--global-color-gray-300);
  --timeline-item-padding-block: var(--global-dimension-size-100);
  --timeline-item-padding-inline: var(--global-dimension-size-100);
  --timeline-item-gap: var(--global-dimension-size-50);
  --timeline-item-column-gap: var(--global-dimension-size-150);
  --timeline-first-line-height: var(--global-line-height-s);
  --timeline-indicator-offset: calc(
    (var(--timeline-first-line-height) - var(--timeline-indicator-size)) / 2
  );
  --timeline-separator-gap: var(--global-dimension-size-100);

  display: flex;
  flex-direction: column;
  gap: var(--timeline-item-gap);
  margin: 0;
  padding: 0;
  list-style: none;

  .timeline__item {
    position: relative;
    display: grid;
    grid-template-columns: var(--timeline-indicator-size) minmax(0, 1fr);
    column-gap: var(--timeline-item-column-gap);
    padding: var(--timeline-item-padding-block)
      var(--timeline-item-padding-inline);
    border-radius: var(--global-rounding-small);
  }

  a.timeline__item {
    isolation: isolate;
    color: inherit;
    text-decoration: none;
    /* Starts past the indicator column so the hover surface never covers
     the indicator or separator, leaving the content inset by the same
     padding as on the other sides */
    &::before {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 0;
      left: calc(
        var(--timeline-indicator-size) + var(--timeline-item-column-gap)
      );
      border-radius: inherit;
    }
    &:hover::before {
      background-color: var(--global-list-item-hover-background-color);
    }
    &[aria-current="page"] .timeline__indicator {
      --timeline-indicator-color: var(--global-color-gray-900);
      background-color: var(--timeline-indicator-color);
      /* Slightly smaller when filled so its perceived size matches the outlined dot */
      scale: 0.9;
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
  }

  .timeline__indicator {
    grid-area: 1 / 1;
    align-self: start;
    margin-top: var(--timeline-indicator-offset);
    box-sizing: border-box;
    width: var(--timeline-indicator-size);
    height: var(--timeline-indicator-size);
    border: var(--global-dimension-size-25) solid
      var(--timeline-indicator-color);
    border-radius: var(--global-rounding-full);
  }

  /* Runs across the gap and into the next item's top padding, stopping the
   same distance above the next indicator as it starts below its own */
  .timeline__separator {
    position: absolute;
    top: calc(
      var(--timeline-item-padding-block) + var(--timeline-indicator-offset) +
        var(--timeline-indicator-size) + var(--timeline-separator-gap)
    );
    bottom: calc(
      var(--timeline-separator-gap) -
        (var(--timeline-item-gap) + var(--timeline-item-padding-block) +
          var(--timeline-indicator-offset))
    );
    left: calc(
      var(--timeline-item-padding-inline) +
        (var(--timeline-indicator-size) - var(--timeline-separator-width)) / 2
    );
    width: var(--timeline-separator-width);
    border-radius: var(--global-rounding-full);
    background: var(--timeline-separator-color);
  }

  .timeline__content {
    grid-area: 1 / 2;
    min-width: 0;
  }

  &:not([data-truncated="true"]) > li:last-child .timeline__separator {
    display: none;
  }

  &[data-truncated="true"] > li:last-child .timeline__separator {
    background: linear-gradient(
      to bottom,
      var(--timeline-separator-color),
      transparent
    );
  }
`;

/**
 * A vertical sequence of items. Each item's indicator sits beside its first
 * line, and a separator joins it to the next item.
 */
export function Timeline({ isTruncated = false, children }: TimelineProps) {
  return (
    <ol css={timelineCSS} className="timeline" data-truncated={isTruncated}>
      {children}
    </ol>
  );
}

export type TimelineItemProps = PropsWithChildren<
  | {
      /**
       * Where the item leads. The whole item becomes one link with a hover
       * state.
       */
      to: LinkProps["to"];
      /**
       * Whether the item is the page currently shown.
       * @default false
       */
      isCurrent?: boolean;
    }
  | { to?: undefined; isCurrent?: never }
>;

/**
 * One item in a `Timeline`. The indicator is placed for a first line of text
 * at the small line height, not measured from the children, so start them
 * with a line of that height.
 */
export function TimelineItem({
  to,
  isCurrent = false,
  children,
}: TimelineItemProps) {
  const parts = (
    <>
      <span className="timeline__indicator" aria-hidden />
      <span className="timeline__separator" aria-hidden />
      <div className="timeline__content">{children}</div>
    </>
  );
  if (to === undefined) {
    return <li className="timeline__item">{parts}</li>;
  }
  return (
    <li>
      <Link
        to={to}
        className="timeline__item"
        aria-current={isCurrent ? "page" : undefined}
      >
        {parts}
      </Link>
    </li>
  );
}
