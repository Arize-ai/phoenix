import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

export type TimelineProps = PropsWithChildren<{
  /**
   * Whether more items follow the last rendered one. The last item's
   * separator then fades out instead of ending at the item.
   * @default false
   */
  isTruncated?: boolean;
}>;

const timelineCSS = css`
  --timeline-indicator-size: var(--global-dimension-size-150);
  --timeline-indicator-color: var(--global-color-gray-500);
  --timeline-separator-width: var(--global-dimension-size-25);
  --timeline-separator-color: var(--global-color-gray-300);
  --timeline-item-spacing: var(--global-dimension-size-200);
  --timeline-header-line-height: var(--global-line-height-s);
  --timeline-indicator-offset: calc(
    (var(--timeline-header-line-height) - var(--timeline-indicator-size)) / 2
  );

  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;

  .timeline__item {
    display: grid;
    grid-template-columns: var(--timeline-indicator-size) minmax(0, 1fr);
    grid-template-rows: auto auto var(--timeline-item-spacing);
    column-gap: var(--global-dimension-size-150);
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

  .timeline__separator {
    grid-column: 1;
    grid-row: 1 / 4;
    margin-top: calc(
      var(--timeline-header-line-height) + var(--timeline-indicator-offset)
    );
    justify-self: center;
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

  &:not([data-truncated="true"]) .timeline__item:last-child {
    grid-template-rows: auto auto;
    .timeline__separator {
      display: none;
    }
  }

  &[data-truncated="true"] .timeline__item:last-child .timeline__separator {
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

/**
 * One event in a `Timeline`. Put its leading line in a `TimelineHeader` and
 * any details below in a `TimelineContent`. The indicator centers on the
 * header's first line, which is sized for text at the small line height, so
 * a header that wraps keeps its indicator beside the line it starts on.
 */
export function TimelineItem({ children }: PropsWithChildren) {
  return (
    <li className="timeline__item">
      <span className="timeline__indicator" aria-hidden />
      <span className="timeline__separator" aria-hidden />
      {children}
    </li>
  );
}

export function TimelineHeader({ children }: PropsWithChildren) {
  return <div className="timeline__header">{children}</div>;
}

export function TimelineContent({ children }: PropsWithChildren) {
  return <div className="timeline__content">{children}</div>;
}
