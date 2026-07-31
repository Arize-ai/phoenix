import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Disclosure,
  DisclosureGroup,
  type DisclosureGroupProps,
  DisclosurePanel,
  DisclosureTrigger,
  Icon,
  Icons,
} from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanEventsListQuery } from "./__generated__/SpanEventsListQuery.graphql";
import { ReadonlyJSONBlock } from "./ReadonlyJSONBlock";
import { ExpandableSpanContent } from "./span/ExpandableSpanContent";

type SpanEventsListProps = {
  spanId: string;
};

const spanEventsListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: var(--global-grid-margin-xsmall);

  > .disclosure {
    overflow: hidden;
    border: 1px solid var(--tool-call-border-color);
    border-radius: var(--global-rounding-small);
    background: var(--tool-call-background-color);

    &:hover {
      border-color: var(--tool-call-border-color-hover);
    }
  }

  .react-aria-Button[slot="trigger"] {
    padding: var(--global-dimension-size-50);
    border-bottom: 0;
    background: var(--global-code-block-header-background-color);
    transition: none;

    &:hover:not([disabled]) {
      background: var(--tool-call-header-background-color-hover);
    }

    &[disabled] {
      opacity: 1;
    }
  }

  > .disclosure[data-expanded]
    > .react-aria-Heading
    > .react-aria-Button[slot="trigger"] {
    border-bottom: 1px solid var(--tool-call-body-border-color);
  }

  .disclosure__panel {
    overflow: hidden;
    background: var(--tool-call-body-background-color);
  }

  .span-events-list__summary {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    width: 100%;
    min-width: 0;
    color: var(--tool-call-title-color);
    font-size: var(--global-font-size-xs);
  }

  .span-events-list__title {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: var(--global-dimension-size-50);
    max-width: 55%;
    min-width: 0;
    color: var(--global-text-color-800);
  }

  .span-events-list__name,
  .span-events-list__message,
  .span-events-list__time {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .span-events-list__message {
    flex: 1 1 50px;
    min-width: 50px;
    color: var(--tool-call-secondary-color);
  }

  .span-events-list__time {
    flex: 0 1 auto;
    margin-left: auto;
    color: var(--tool-call-secondary-color);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`;

/**
 * Wrapper component that fetches span events with their full attributes when
 * the events section is mounted.
 */
export function SpanEventsList({ spanId }: SpanEventsListProps) {
  const data = useLazyLoadQuery<SpanEventsListQuery>(
    graphql`
      query SpanEventsListQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            events {
              name
              message
              timestamp
              attributes
            }
          }
        }
      }
    `,
    { id: spanId }
  );

  const events = data.span?.events ?? [];

  return <SpanEventsListContent events={events} />;
}

export type SpanEvent = {
  name: string;
  message: string;
  timestamp: string;
  attributes: unknown;
};

export function SpanEventsListContent({
  events,
  defaultExpandedKeys,
}: {
  events: readonly SpanEvent[];
  defaultExpandedKeys?: DisclosureGroupProps["defaultExpandedKeys"];
}) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (events.length === 0) {
    return (
      <EmptyStateArea>
        <EmptyState
          graphic={<EmptyStateGraphic variant="event" />}
          description="No events for this span"
        />
      </EmptyStateArea>
    );
  }

  return (
    <DisclosureGroup
      defaultExpandedKeys={defaultExpandedKeys}
      className="span-events-list"
      css={spanEventsListCSS}
    >
      {events.map((event, index) => {
        const isException = event.name === "exception";
        const hasAttributes =
          event.attributes &&
          typeof event.attributes === "object" &&
          Object.keys(event.attributes as object).length > 0;

        const eventHeader = (
          <div className="span-events-list__summary">
            <span className="span-events-list__title">
              {isException ? (
                <Icon svg={<Icons.AlertTriangle />} color="danger" />
              ) : null}
              <span className="span-events-list__name" title={event.name}>
                {event.name}
              </span>
            </span>
            {event.message ? (
              <span className="span-events-list__message" title={event.message}>
                {event.message}
              </span>
            ) : null}
            <span className="span-events-list__time">
              {fullTimeFormatter(new Date(event.timestamp))}
            </span>
          </div>
        );

        return (
          <Disclosure id={index} key={index} isDisabled={!hasAttributes}>
            {({ isExpanded }) => (
              <>
                <DisclosureTrigger
                  arrowPosition={hasAttributes ? "start" : "none"}
                >
                  {eventHeader}
                </DisclosureTrigger>
                {hasAttributes && isExpanded ? (
                  <DisclosurePanel>
                    <ExpandableSpanContent overlayBackgroundColor="var(--tool-call-body-background-color)">
                      <ReadonlyJSONBlock
                        basicSetup={{ lineNumbers: false, foldGutter: false }}
                      >
                        {JSON.stringify(event.attributes, null, 2)}
                      </ReadonlyJSONBlock>
                    </ExpandableSpanContent>
                  </DisclosurePanel>
                ) : null}
              </>
            )}
          </Disclosure>
        );
      })}
    </DisclosureGroup>
  );
}
