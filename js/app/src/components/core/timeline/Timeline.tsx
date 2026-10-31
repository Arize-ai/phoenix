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
  --timeline-header-line-height: var(--global-line-height-s);
  --timeline-indicator-offset: calc(
    (var(--timeline-header-line-height) - var(--timeline-indicator-size)) / 2
  );

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
    column-gap: var(--global-dimension-size-150);
    padding: var(--timeline-item-padding-block)
      var(--timeline-item-padding-inline);
    border-radius: var(--global-rounding-small);
  }

  a.timeline__item {
    color: inherit;
    text-decoration: none;
    &:hover {
      background-color: var(--global-list-item-hover-background-color);
    }
    &[aria-current="page"] {
      background-color: var(--global-list-item-selected-background-color);
    }
    &:hover .timeline__separator,
    &[aria-current="page"] .timeline__separator {
      display: none;
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

  /* Runs from below the indicator across the gap and into the next item's
   top padding, so it meets the next indicator across item boundaries */
  .timeline__separator {
    position: absolute;
    top: calc(
      var(--timeline-item-padding-block) + var(--timeline-header-line-height) +
        var(--timeline-indicator-offset)
    );
    bottom: calc(
      -1 * (var(--timeline-item-padding-block) + var(--timeline-item-gap))
    );
    left: calc(
      var(--timeline-item-padding-inline) +
        (var(--timeline-indicator-size) - var(--timeline-separator-width)) / 2
    );
    width: var(--timeline-separator-width);
    border-radius: var(--global-rounding-full);
    background: var(--timeline-separator-color);
  }

  .timeline__header {
    grid-area: 1 / 2;
    min-width: 0;
  }

  .timeline__content {
    grid-area: 2 / 2;
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
 * A vertical sequence of events, such as the versions of a prompt. Each
 * item's indicator sits beside its header, and a separator joins it to the
 * next item.
 */
export function Timeline({ isTruncated = false, children }: TimelineProps) {
  return (
    <ol css={timelineCSS} className="timeline" data-truncated={isTruncated}>
      {children}
    </ol>
  );
}

export type TimelineItemProps = PropsWithChildren<{
  /**
   * Where the item leads. The whole item becomes one link with a hover state.
   */
  to?: LinkProps["to"];
  /**
   * Whether the item is the page currently shown. Only applies with `to`.
   * @default false
   */
  isCurrent?: boolean;
}>;

/**
 * One event in a `Timeline`. Put its leading line in a `TimelineHeader` and
 * any details below in a `TimelineContent`. The indicator centers on the
 * header's first line, which is sized for text at the small line height, so
 * a header that wraps keeps its indicator beside the line it starts on.
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
      {children}
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

export function TimelineHeader({ children }: PropsWithChildren) {
  return <div className="timeline__header">{children}</div>;
}

export function TimelineContent({ children }: PropsWithChildren) {
  return <div className="timeline__content">{children}</div>;
}
