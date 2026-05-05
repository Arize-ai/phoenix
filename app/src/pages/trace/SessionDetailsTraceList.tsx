import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";
import { isNumber, isString, throttle } from "lodash";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PreloadedQuery } from "react-relay";
import { graphql, usePaginationFragment, usePreloadedQuery } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import type { To } from "react-router";
import { useLocation, useSearchParams } from "react-router";

import {
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
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanCumulativeTokenCount } from "@phoenix/components/trace/SpanCumulativeTokenCount";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTokenCosts } from "@phoenix/components/trace/TraceTokenCosts";
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
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { EditSpanAnnotationsButton } from "./EditSpanAnnotationsButton";
import { SessionViewTabs } from "./SessionViewTabs";
import type { SessionView } from "./SessionViewTabs";

export const sessionDetailsTraceListQuery = graphql`
  query SessionDetailsTraceListQuery($id: ID!, $first: Int!) {
    session: node(id: $id) {
      ... on ProjectSession {
        ...SessionDetailsTraceList_traces @arguments(first: $first)
      }
    }
  }
`;

const getUserFromRootSpanAttributes = (attributes: string) => {
  const { json: parsedAttributes } = safelyParseJSON(attributes);
  if (parsedAttributes == null || !isStringKeyedObject(parsedAttributes)) {
    return null;
  }
  const userAttributes = parsedAttributes[SemanticAttributePrefixes.user];
  if (userAttributes == null || !isStringKeyedObject(userAttributes)) {
    return null;
  }
  const userId = userAttributes[UserAttributePostfixes.id];
  return isString(userId) || isNumber(userId) ? userId : null;
};

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

function RootSpanMessage({
  label,
  role,
  value,
}: {
  label?: string;
  role: "HUMAN" | "AI";
  value: unknown;
}) {
  const styles = useChatMessageStyles(role === "HUMAN" ? "user" : "assistant");
  const defaultLabel = role === "HUMAN" ? "INPUT" : "OUTPUT";
  return (
    <View
      alignSelf={role === "HUMAN" ? "start" : "end"}
      borderRadius={"medium"}
      borderColor="default"
      borderWidth={"thin"}
      padding="size-200"
      maxWidth={"70%"}
      {...styles}
    >
      <Flex direction={"column"} gap={"size-50"}>
        <Text color="text-700">{label ?? defaultLabel}</Text>
        <DynamicContent value={value} />
      </Flex>
    </View>
  );
}

type SessionTraceRootSpan = NonNullable<
  NonNullable<
    SessionDetailsTraceList_traces$data["traces"]["edges"][number]["trace"]
  >["rootSpan"]
>;

type RootSpanProps = {
  rootSpan: SessionTraceRootSpan;
};

function RootSpanStartTime({ rootSpan }: RootSpanProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  const startDate = new Date(rootSpan.startTime);

  return (
    <Text color="text-700" size="XS">
      {fullTimeFormatter(startDate)}
    </Text>
  );
}

function RootSpanTraceLink({
  traceId,
  rootSpan,
}: RootSpanProps & { traceId: string }) {
  const location = useLocation();

  return (
    <Flex direction="row" justifyContent="end">
      <LinkButton
        size="S"
        variant="quiet"
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
    </Flex>
  );
}

function RootSpanOutputMetadata({ rootSpan }: RootSpanProps) {
  return (
    <Flex direction="column" gap="size-100">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
        wrap
      >
        <Flex direction="row" alignItems="center" gap="size-100" wrap>
          <SpanCumulativeTokenCount
            tokenCountTotal={rootSpan.cumulativeTokenCountTotal || 0}
            nodeId={rootSpan.id}
          />
          {rootSpan.trace.costSummary?.total?.cost != null && (
            <TraceTokenCosts
              totalCost={rootSpan.trace.costSummary.total.cost}
              nodeId={rootSpan.trace.id}
            />
          )}
          {rootSpan.latencyMs != null ? (
            <LatencyText latencyMs={rootSpan.latencyMs} />
          ) : null}
        </Flex>
        <span>
          <EditSpanAnnotationsButton
            size="S"
            spanNodeId={rootSpan.id}
            projectId={rootSpan.project.id}
            buttonText="Annotate"
          />
        </span>
      </Flex>
      <AnnotationSummaryGroupTokens
        span={rootSpan}
        renderEmptyState={() => null}
      />
    </Flex>
  );
}

function SessionTurnDetail({
  traceId,
  rootSpan,
}: RootSpanProps & { traceId: string }) {
  const user = getUserFromRootSpanAttributes(rootSpan.attributes);
  const inputLabel = user != null ? `USER: ${user}` : "INPUT";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-100">
        <RootSpanMessage
          label={inputLabel}
          role="HUMAN"
          value={rootSpan.input?.value}
        />
        <RootSpanStartTime rootSpan={rootSpan} />
      </Flex>
      <Flex direction="column" gap="size-100">
        <RootSpanTraceLink traceId={traceId} rootSpan={rootSpan} />
        <RootSpanMessage role="AI" value={rootSpan.output?.value} />
        <RootSpanOutputMetadata rootSpan={rootSpan} />
      </Flex>
    </Flex>
  );
}

type SessionTurnRow = {
  traceId: string;
  rootSpan: SessionTraceRootSpan;
};

type IndexedSessionTurnRow = SessionTurnRow & { index: number };

const turnListCSS = css`
  height: 100%;
  max-height: 100%;
  padding: 0;

  .react-aria-ListBoxItem {
    margin: 0;
    padding: var(--global-dimension-static-size-200);
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
          <ListBoxItem id={row.traceId} textValue={turnLabel}>
            <Flex direction="column" gap="size-100">
              <Flex
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap="size-100"
              >
                <Flex
                  direction="row"
                  gap="size-100"
                  alignItems="center"
                  flex={1}
                  minWidth={0}
                >
                  <Text fontFamily="mono" color="text-500">
                    {paddedIndex}
                  </Text>
                  <Flex flex={1} minWidth={0}>
                    <Truncate maxWidth="100%" title={row.rootSpan.name}>
                      <Text weight="heavy">{row.rootSpan.name}</Text>
                    </Truncate>
                  </Flex>
                </Flex>
                <Text color="text-700" size="XS">
                  {fullTimeFormatter(new Date(row.rootSpan.startTime))}
                </Text>
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
  &[data-selected] {
    background-color: var(--global-list-detail-selected-background-color);
  }
`;

const panelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

export function SessionDetailsTraceList({
  queryRef,
  sessionView,
  onSessionViewChange,
  traceCount,
}: {
  queryRef: PreloadedQuery<SessionDetailsTraceListQuery>;
  sessionView: SessionView;
  onSessionViewChange: (view: SessionView) => void;
  traceCount: number;
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
                trace {
                  id
                  costSummary {
                    total {
                      cost
                    }
                  }
                }
                id
                name
                attributes
                project {
                  id
                }
                input {
                  value
                  mimeType
                }
                output {
                  value
                  mimeType
                }
                cumulativeTokenCountTotal
                latencyMs
                startTime
                spanId
                ...AnnotationSummaryGroup
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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "session-details-layout",
    panelIds: ["session-turns", "session-turn-details"],
    storage: localStorage,
  });
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

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      css={css`
        flex: 1 1 auto;
        overflow: hidden;
      `}
    >
      <Panel id="session-turns" defaultSize="20%" minSize="10%">
        <div css={panelContentCSS}>
          <SessionViewTabs
            sessionView={sessionView}
            onSessionViewChange={onSessionViewChange}
            traceCount={traceCount}
          >
            {turnListPanel}
          </SessionViewTabs>
        </div>
      </Panel>
      <Separator css={compactResizeHandleCSS} />
      <Panel id="session-turn-details">
        <div
          css={css`
            height: 100%;
            overflow: auto;
          `}
          onScroll={(e) =>
            debouncedFetchMoreOnBottomReached(e.target as HTMLDivElement)
          }
        >
          {sessionRootSpans.map(({ traceId, rootSpan }) => (
            <div
              key={rootSpan.spanId}
              css={turnDetailRowCSS}
              data-selected={traceId === selectedTraceId || undefined}
              ref={(el) => {
                if (el) {
                  rowRefs.current.set(traceId, el);
                } else {
                  rowRefs.current.delete(traceId);
                }
              }}
            >
              <View
                borderBottomColor="default"
                borderBottomWidth="thin"
                padding="size-200"
              >
                <SessionTurnDetail traceId={traceId} rootSpan={rootSpan} />
              </View>
            </div>
          ))}
          {isLoadingNext && (
            <View
              borderBottomColor="default"
              borderBottomWidth={"thin"}
              padding="size-200"
            >
              <Loading />
            </View>
          )}
        </div>
      </Panel>
    </Group>
  );
}
