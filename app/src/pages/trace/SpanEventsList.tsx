import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Card,
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ExpandableContent,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
  PreBlock,
} from "@phoenix/components/code";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type { SpanEventsListQuery } from "./__generated__/SpanEventsListQuery.graphql";

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

const EXCEPTION_STACKTRACE = "exception.stacktrace";

function EventAttributesJSONView({ attributes }: { attributes: unknown }) {
  return (
    <JSONViewProvider
      value={attributes}
      defaultMode="table"
      indexNotation="dot"
    >
      <Card
        title="Attributes"
        extra={<JSONViewToolbar searchPlaceholder="Search event attributes" />}
      >
        <JSONViewBody />
      </Card>
    </JSONViewProvider>
  );
}

export function SpanEventAttributes({ event }: { event: SpanEvent }) {
  const exceptionAttributes =
    event.name === "exception" && isPlainObject(event.attributes)
      ? event.attributes
      : {};
  const { [EXCEPTION_STACKTRACE]: stacktrace, ...remainingAttributes } =
    exceptionAttributes;
  if (typeof stacktrace !== "string" || stacktrace.length === 0) {
    return (
      <View padding="size-200">
        <EventAttributesJSONView attributes={event.attributes} />
      </View>
    );
  }
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        <Card
          title="Stack trace"
          extra={
            <CopyToClipboardButton
              aria-label="Copy stack trace"
              text={stacktrace}
              tooltipText="Copy stack trace"
            />
          }
        >
          <ExpandableContent height={320} expandedBehavior="grow">
            <PreBlock>{stacktrace}</PreBlock>
          </ExpandableContent>
        </Card>
        {Object.keys(remainingAttributes).length > 0 ? (
          <EventAttributesJSONView attributes={remainingAttributes} />
        ) : null}
      </Flex>
    </View>
  );
}

function SpanEventsListContent({ events }: { events: readonly SpanEvent[] }) {
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
          Object.keys(event.attributes).length > 0;

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
          <Disclosure key={idx} isDisabled={!hasAttributes}>
            <DisclosureTrigger arrowPosition="start">
              {eventHeader}
            </DisclosureTrigger>
            {hasAttributes ? (
              <DisclosurePanel>
                <SpanEventAttributes event={event} />
              </DisclosurePanel>
            ) : null}
          </Disclosure>
        );
      })}
    </DisclosureGroup>
  );
}
