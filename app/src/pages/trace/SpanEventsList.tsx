import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Disclosure,
  DisclosureGroup,
  type DisclosureGroupProps,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanEventsListQuery } from "./__generated__/SpanEventsListQuery.graphql";
import { ReadonlyJSONBlock } from "./ReadonlyJSONBlock";

type SpanEventsListProps = {
  spanId: string;
};

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
      css={css`
        .react-aria-Button[slot="trigger"] {
          padding: var(--global-dimension-size-200);
        }
      `}
    >
      {events.map((event, idx) => {
        const isException = event.name === "exception";
        const hasAttributes =
          event.attributes &&
          typeof event.attributes === "object" &&
          Object.keys(event.attributes as object).length > 0;

        const eventHeader = (
          <Flex direction="row" gap="size-100" alignItems="center">
            <View flex="none">
              <Text color="text-700">
                {fullTimeFormatter(new Date(event.timestamp))}
              </Text>
            </View>
            {isException && (
              <View flex="none">
                <Icon svg={<Icons.AlertTriangle />} color="danger" />
              </View>
            )}
            <Flex direction="row" gap="size-100">
              <Text weight="heavy">{event.name}</Text>
              <Truncate maxWidth="200px" title={event.message}>
                {event.message && <Text color="text-700">{event.message}</Text>}
              </Truncate>
            </Flex>
          </Flex>
        );

        return (
          <Disclosure id={idx} key={idx} isDisabled={!hasAttributes}>
            <DisclosureTrigger arrowPosition="start">
              {eventHeader}
            </DisclosureTrigger>
            {hasAttributes ? (
              <DisclosurePanel>
                <ReadonlyJSONBlock
                  basicSetup={{ lineNumbers: false, foldGutter: false }}
                >
                  {JSON.stringify(event.attributes, null, 2)}
                </ReadonlyJSONBlock>
              </DisclosurePanel>
            ) : null}
          </Disclosure>
        );
      })}
    </DisclosureGroup>
  );
}
