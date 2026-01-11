import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks";

import { SpanEventsListQuery } from "./__generated__/SpanEventsListQuery.graphql";
import { JSONBlock } from "./SpanDetails";

type SpanEventsListProps = {
  spanId: string;
};

/**
 * Wrapper component that lazily fetches span events with attributes
 * when the Events tab is selected.
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

type SpanEvent = {
  name: string;
  message: string;
  timestamp: string;
  attributes: unknown;
};

function SpanEventsListContent({ events }: { events: readonly SpanEvent[] }) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (events.length === 0) {
    return (
      <View padding="size-200">
        <Text color="text-700">No events</Text>
      </View>
    );
  }

  return (
    <DisclosureGroup
      css={css`
        .react-aria-Button[slot="trigger"] {
          padding: var(--ac-global-dimension-static-size-200);
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
                <Icon svg={<Icons.AlertTriangleOutline />} color="danger" />
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
          <Disclosure key={idx} isDisabled={!hasAttributes}>
            <DisclosureTrigger arrowPosition="start">
              {eventHeader}
            </DisclosureTrigger>
            {hasAttributes ? (
              <DisclosurePanel>
                <JSONBlock
                  basicSetup={{ lineNumbers: false, foldGutter: false }}
                >
                  {JSON.stringify(event.attributes, null, 2)}
                </JSONBlock>
              </DisclosurePanel>
            ) : null}
          </Disclosure>
        );
      })}
    </DisclosureGroup>
  );
}
