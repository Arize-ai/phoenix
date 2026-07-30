import { css } from "@emotion/react";
import throttle from "lodash/throttle";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PreloadedQuery } from "react-relay";
import { graphql, usePaginationFragment, usePreloadedQuery } from "react-relay";
import type { To } from "react-router";
import { useLocation, useSearchParams } from "react-router";

import {
  CopyableIDBadge,
  Flex,
  Icon,
  Icons,
  LinkButton,
  ListBox,
  ListBoxItem,
  Loading,
  Text,
  Truncate,
  View,
} from "@phoenix/components";
import { TraceDetailPanelAnnotationButton } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
  SESSION_VIEW_PARAM,
} from "@phoenix/constants/searchParams";
import { useTimeFormatters } from "@phoenix/hooks";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import type {
  SessionDetailsTraceList_traces$data,
  SessionDetailsTraceList_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTraceList_traces.graphql";
import type { SessionDetailsTraceListQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTraceListQuery.graphql";
import type { SessionDetailsTraceListRefetchQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTraceListRefetchQuery.graphql";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import { DetailsPanelContent } from "./DetailsPanel";
import type { SessionNavigationHeaderRenderer } from "./SessionDetails";
import {
  SessionDetailsNavigation,
  sessionDetailsNavigationTopLevelRowCSS,
} from "./SessionDetailsNavigation";
import { TraceTurnContent } from "./TraceTurnContent";

export { RootSpanMessage } from "./TraceTurnContent";

export const sessionDetailsTraceListQuery = graphql`
  query SessionDetailsTraceListQuery($id: ID!, $first: Int!) {
    session: node(id: $id) {
      ... on ProjectSession {
        ...SessionDetailsTraceList_traces @arguments(first: $first)
      }
    }
  }
`;

const getSessionTraceUrl = ({
  pathname,
  search,
  traceId,
  spanNodeId,
}: {
  pathname: string;
  search: string;
  traceId: string;
  spanNodeId: string;
}): To => {
  const params = new URLSearchParams(search);
  params.set(SESSION_VIEW_PARAM, "traces");
  params.set(SELECTED_TRACE_ID_PARAM, traceId);
  params.set(SELECTED_SPAN_NODE_ID_PARAM, spanNodeId);
  return {
    pathname,
    search: params.toString(),
  };
};

type RootSpanMessageRole = "INPUT" | "OUTPUT";

type SessionTraceRootSpan = NonNullable<
  NonNullable<
    SessionDetailsTraceList_traces$data["traces"]["edges"][number]["trace"]
  >["rootSpan"]
>;

type RootSpanProps = {
  rootSpan: SessionTraceRootSpan;
};

const sessionTurnDividerCSS = css`
  .session-turn-divider__rule {
    flex: 1;
    height: 0;
    border-top: 1px solid var(--global-color-gray-300);
  }
`;

/**
 * A divider that labels a turn ("Turn 01") and exposes the turn-level actions:
 * copy the trace ID and view the trace. The whole turn is one trace, so these
 * controls belong here rather than inside the OUTPUT bubble.
 */
function SessionTurnDivider({
  index,
  traceId,
  rootSpan,
}: RootSpanProps & { traceId: string; index: number }) {
  const location = useLocation();
  const paddedIndex = String(index + 1).padStart(2, "0");
  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="size-100"
      css={sessionTurnDividerCSS}
    >
      <Text fontFamily="mono" color="text-500">
        Turn {paddedIndex}
      </Text>
      <div className="session-turn-divider__rule" />
      <LinkButton
        size="S"
        variant="quiet"
        aria-label="View trace"
        leadingVisual={<Icon svg={<Icons.Trace />} />}
        to={getSessionTraceUrl({
          pathname: location.pathname,
          search: location.search,
          traceId,
          spanNodeId: rootSpan.id,
        })}
      >
        Trace
      </LinkButton>
      <CopyableIDBadge id={traceId} tooltipText="Copy Trace ID" />
    </Flex>
  );
}

function SessionTurnDetail({
  index,
  traceId,
  rootSpan,
}: RootSpanProps & { traceId: string; index: number }) {
  return (
    <TraceTurnContent
      rootSpan={rootSpan}
      header={
        <SessionTurnDivider
          index={index}
          traceId={traceId}
          rootSpan={rootSpan}
        />
      }
    />
  );
}

type SessionTurnRow = {
  id: string;
  traceId: string;
  rootSpan: SessionTraceRootSpan;
};

type IndexedSessionTurnRow = SessionTurnRow & { index: number };

function RootSpanPreviewLine({
  role,
  value,
}: {
  role: RootSpanMessageRole;
  value?: string | null;
}) {
  const isInput = role === "INPUT";
  const styles = useChatMessageStyles(isInput ? "user" : "assistant");
  if (!value) {
    return null;
  }
  return (
    <View
      borderStartColor={styles.borderColor}
      borderStartWidth="thick"
      minWidth={0}
      paddingStart="size-75"
      width="100%"
    >
      <Flex direction="row" alignItems="center" gap="size-75" minWidth={0}>
        <Truncate maxWidth="100%" title={value}>
          <Text color="text-700" size="XS">
            {value}
          </Text>
        </Truncate>
      </Flex>
    </View>
  );
}

const turnListCSS = css`
  height: 100%;
  max-height: 100%;
  padding: 0;

  .react-aria-ListBoxItem {
    margin: 0;
    border-radius: 0;
    border-left: 4px solid transparent;
    border-bottom: 1px solid var(--global-border-color-default);
    box-sizing: border-box;
    cursor: pointer;

    &[data-hovered],
    &[data-focused] {
      background: var(--global-list-item-hover-background-color);
    }

    &[data-selected] {
      background: var(--global-list-item-selected-background-color);
      color: var(--global-text-color-900);
      border-left-color: var(--global-list-item-selected-border-color);
    }
  }

  .session-turn-row__annotation-action {
    display: flex;
    flex: none;
    align-items: center;
    opacity: 0;
    pointer-events: none;
  }

  .react-aria-ListBoxItem[data-hovered] .session-turn-row__annotation-action,
  .react-aria-ListBoxItem:focus-within .session-turn-row__annotation-action {
    opacity: 1;
    pointer-events: auto;
  }
`;

function SessionTurnList({
  rows,
  selectedTraceId,
  onTurnClick,
}: {
  rows: ReadonlyArray<SessionTurnRow>;
  selectedTraceId: string | null;
  onTurnClick: (traceId: string) => void;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const indexedRows: IndexedSessionTurnRow[] = rows.map((row, index) => ({
    ...row,
    index,
  }));
  return (
    <ListBox
      aria-label="Session turns"
      items={indexedRows}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selectedTraceId ? [selectedTraceId] : []}
      onSelectionChange={(selection) => {
        if (selection === "all") return;
        const key = selection.keys().next().value;
        if (typeof key === "string") {
          onTurnClick(key);
        }
      }}
      css={turnListCSS}
    >
      {(row) => {
        const paddedIndex = String(row.index + 1).padStart(2, "0");
        const turnLabel = `${paddedIndex} | ${row.rootSpan.name}`;
        return (
          <ListBoxItem
            id={row.traceId}
            textValue={turnLabel}
            className="react-aria-ListBoxItem session-turn-row"
            css={sessionDetailsNavigationTopLevelRowCSS}
          >
            <Text
              className="session-turn-row__compact-index"
              fontFamily="mono"
              color="text-500"
            >
              {paddedIndex}
            </Text>
            <Flex
              className="session-turn-row__expanded-content"
              direction="column"
              gap="size-50"
            >
              <Flex
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                gap="size-100"
              >
                <Flex
                  className="session-turn-row__title"
                  direction="row"
                  alignItems="center"
                  flex={1}
                  minWidth={0}
                >
                  <Text fontFamily="mono" color="text-500">
                    {paddedIndex}
                  </Text>
                  <Truncate maxWidth="100%" title={row.rootSpan.name}>
                    <Text weight="heavy" size="S">
                      {row.rootSpan.name}
                    </Text>
                  </Truncate>
                </Flex>
                <Flex flexShrink={0}>
                  <Text color="text-700" size="XS">
                    {fullTimeFormatter(new Date(row.rootSpan.startTime))}
                  </Text>
                </Flex>
                <span
                  className="session-turn-row__annotation-action"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <TraceDetailPanelAnnotationButton traceNodeId={row.id} />
                </span>
              </Flex>
              <Flex direction="column" gap="size-50" minWidth={0}>
                <RootSpanPreviewLine
                  role="INPUT"
                  value={row.rootSpan.input?.truncatedValue}
                />
                <RootSpanPreviewLine
                  role="OUTPUT"
                  value={row.rootSpan.output?.truncatedValue}
                />
              </Flex>
              <Flex direction="row" gap="size-100" alignItems="center" wrap>
                <TokenCount size="S">
                  {row.rootSpan.cumulativeTokenCountTotal ?? 0}
                </TokenCount>
                {row.rootSpan.trace.costSummary?.total?.cost != null ? (
                  <TokenCosts size="S">
                    {row.rootSpan.trace.costSummary.total.cost}
                  </TokenCosts>
                ) : null}
                {row.rootSpan.latencyMs != null ? (
                  <LatencyText latencyMs={row.rootSpan.latencyMs} size="S" />
                ) : null}
              </Flex>
            </Flex>
          </ListBoxItem>
        );
      }}
    </ListBox>
  );
}

const turnDetailRowCSS = css`
  &[data-selected],
  &[data-after-selected] {
    .session-turn-divider__rule {
      visibility: hidden;
    }
  }

  &[data-selected] {
    background-color: var(--global-list-detail-selected-background-color);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }
`;

const turnLaneContentCSS = css`
  padding-inline: var(--global-grid-margin-xsmall);
`;

export function SessionDetailsTraceList({
  queryRef,
  renderNavigationHeader,
  sessionViewControl,
  isTreePanelCollapsed,
  isNavigationPointerOpen,
  onNavigationPointerOpenChange,
  renderMainContent,
}: {
  queryRef: PreloadedQuery<SessionDetailsTraceListQuery>;
  renderNavigationHeader: SessionNavigationHeaderRenderer;
  sessionViewControl: ReactNode;
  isTreePanelCollapsed: boolean;
  isNavigationPointerOpen: boolean;
  onNavigationPointerOpenChange: (isOpen: boolean) => void;
  renderMainContent: (content: ReactNode) => ReactNode;
}) {
  const queryData = usePreloadedQuery<SessionDetailsTraceListQuery>(
    sessionDetailsTraceListQuery,
    queryRef
  );
  if (queryData.session == null) {
    throw new Error("Session not found");
  }
  const { data, loadNext, isLoadingNext, hasNext } = usePaginationFragment<
    SessionDetailsTraceListRefetchQuery,
    SessionDetailsTraceList_traces$key
  >(
    graphql`
      fragment SessionDetailsTraceList_traces on ProjectSession
      @refetchable(queryName: "SessionDetailsTraceListRefetchQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String", defaultValue: null }
      ) {
        numTraces
        traces(first: $first, after: $after)
          @connection(key: "SessionDetailsTraceList_traces") {
          edges {
            trace: node {
              id
              traceId
              rootSpan {
                ...TraceTurnContent_rootSpan
                trace {
                  costSummary {
                    total {
                      cost
                    }
                  }
                }
                id
                name
                input {
                  truncatedValue
                  mimeType
                }
                output {
                  truncatedValue
                  mimeType
                }
                cumulativeTokenCountTotal
                latencyMs
                startTime
                spanId
              }
            }
          }
        }
      }
    `,
    queryData.session
  );

  const sessionRootSpans = useMemo(() => {
    return data.traces?.edges
      .filter(
        (
          trace
        ): trace is typeof trace & {
          trace: { rootSpan: NonNullable<typeof trace.trace.rootSpan> };
        } => trace.trace.rootSpan !== null
      )
      .map(({ trace }) => trace);
  }, [data]);

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        const withinRange = scrollHeight - scrollTop - clientHeight < 1024;
        if (withinRange && !isLoadingNext && hasNext) {
          loadNext(SESSION_DETAILS_PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  const debouncedFetchMoreOnBottomReached = useMemo(
    () => throttle(fetchMoreOnBottomReached, 100),
    [fetchMoreOnBottomReached]
  );

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTraceId = searchParams.get(SELECTED_TRACE_ID_PARAM);

  const handleTurnClick = (traceId: string) => {
    setSearchParams(
      (params) => {
        params.set(SELECTED_TRACE_ID_PARAM, traceId);
        return params;
      },
      { replace: true }
    );
  };

  // Scroll the selected turn into view on mount and when the selection
  // changes. The effect also re-runs when more turns are paginated in
  // (initial mount may have a selection whose row is not yet mounted),
  // so we dedupe via a ref to avoid snapping the scroll back to the
  // selected turn when the user has manually scrolled elsewhere and a
  // later page loads.
  const lastScrolledTraceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedTraceId == null) {
      lastScrolledTraceIdRef.current = null;
      return;
    }
    if (lastScrolledTraceIdRef.current === selectedTraceId) return;
    const el = rowRefs.current.get(selectedTraceId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      lastScrolledTraceIdRef.current = selectedTraceId;
    }
  }, [selectedTraceId, sessionRootSpans]);

  const selectedIndex =
    selectedTraceId == null
      ? -1
      : sessionRootSpans.findIndex(
          ({ traceId }) => traceId === selectedTraceId
        );

  const turnListPanel = (
    <div
      css={css`
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      `}
    >
      <SessionTurnList
        rows={sessionRootSpans}
        selectedTraceId={selectedTraceId}
        onTurnClick={handleTurnClick}
      />
    </div>
  );

  const turnDetails = (
    <div
      css={css`
        height: 100%;
        overflow: auto;
      `}
      onScroll={(event) =>
        debouncedFetchMoreOnBottomReached(event.currentTarget)
      }
    >
      {sessionRootSpans.map(({ traceId, rootSpan }, index) => {
        const isSelected = index === selectedIndex;
        // Hide this row's top divider when the row directly above it is
        // the selected one, since the selected row draws its own
        // border-bottom and a divider here would double up.
        const isAfterSelected =
          selectedIndex >= 0 && index === selectedIndex + 1;
        return (
          <div
            key={rootSpan.spanId}
            css={turnDetailRowCSS}
            data-selected={isSelected || undefined}
            data-after-selected={isAfterSelected || undefined}
            ref={(element) => {
              if (element) {
                rowRefs.current.set(traceId, element);
              } else {
                rowRefs.current.delete(traceId);
              }
            }}
          >
            <View
              paddingTop="size-100"
              paddingBottom="size-200"
              css={turnLaneContentCSS}
            >
              <SessionTurnDetail
                index={index}
                traceId={traceId}
                rootSpan={rootSpan}
              />
            </View>
          </div>
        );
      })}
      {isLoadingNext && (
        <View
          borderBottomColor="default"
          borderBottomWidth={"thin"}
          paddingY="size-200"
          css={turnLaneContentCSS}
        >
          <View width="100%" maxWidth="1000px" marginX="auto">
            <Loading />
          </View>
        </View>
      )}
    </div>
  );

  return (
    <DetailsPanelContent
      navigation={
        <>
          {renderNavigationHeader()}
          <SessionDetailsNavigation
            control={sessionViewControl}
            isCollapsed={isTreePanelCollapsed}
            isPointerOpen={isNavigationPointerOpen}
            onPointerOpenChange={onNavigationPointerOpenChange}
          >
            {turnListPanel}
          </SessionDetailsNavigation>
        </>
      }
    >
      {renderMainContent(turnDetails)}
    </DetailsPanelContent>
  );
}
