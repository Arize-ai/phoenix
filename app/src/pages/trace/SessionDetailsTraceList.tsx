import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";
import { isNumber, isString, throttle } from "lodash";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useSearchParams } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  Link,
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
} from "@phoenix/constants/searchParams";
import { useTimeFormatters } from "@phoenix/hooks";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import type {
  SessionDetailsTraceList_traces$data,
  SessionDetailsTraceList_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTraceList_traces.graphql";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { EditSpanAnnotationsButton } from "./EditSpanAnnotationsButton";

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

function RootSpanMessage({
  role,
  value,
}: {
  role: "HUMAN" | "AI";
  value: unknown;
}) {
  const styles = useChatMessageStyles(role === "HUMAN" ? "user" : "assistant");
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
        <Text color="text-700">{role}</Text>
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

function RootSpanDetails({
  traceId,
  rootSpan,
  index,
}: RootSpanProps & { traceId: string; index: number }) {
  const { fullTimeFormatter } = useTimeFormatters();
  const startDate = useMemo(() => {
    return new Date(rootSpan.startTime);
  }, [rootSpan.startTime]);

  const user = useMemo(
    () => getUserFromRootSpanAttributes(rootSpan.attributes),
    [rootSpan.attributes]
  );
  return (
    <View height={"100%"}>
      <Flex
        direction={"column"}
        justifyContent={"space-between"}
        height={"100%"}
      >
        <Flex direction={"column"} gap="size-200">
          <Flex direction={"row"} justifyContent={"space-between"}>
            <Text>Trace #{index + 1}</Text>
            <Link
              to={`/projects/${rootSpan.project.id}/traces/${traceId}?${SELECTED_SPAN_NODE_ID_PARAM}=${rootSpan.id}`}
            >
              <Flex alignItems={"center"}>
                View Trace
                <Icon svg={<Icons.ArrowIosForwardOutline />} />
              </Flex>
            </Link>
          </Flex>
          <Flex direction={"row"} justifyContent={"space-between"}>
            {user != null ? <Text color="text-700">user: {user}</Text> : null}
            <Text color="text-700" flex={"end"} marginStart={"auto"}>
              {fullTimeFormatter(startDate)}
            </Text>
          </Flex>
          <Flex direction={"row"} gap={"size-100"}>
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
            ) : (
              "--"
            )}
          </Flex>
        </Flex>
        <Flex
          direction={"row"}
          justifyContent={"space-between"}
          alignItems="end"
        >
          <Flex direction={"column"} gap={"size-100"} maxWidth={"50%"}>
            <Text>Feedback</Text>
            <Flex gap={"size-50"} direction={"column"}>
              <AnnotationSummaryGroupTokens
                span={rootSpan}
                renderEmptyState={() => "--"}
              />
            </Flex>
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
      </Flex>
    </View>
  );
}

function RootSpanInputOutput({ rootSpan }: RootSpanProps) {
  return (
    <Flex direction={"column"} gap={"size-100"}>
      <RootSpanMessage role={"HUMAN"} value={rootSpan.input?.value} />
      <RootSpanMessage role={"AI"} value={rootSpan.output?.value} />
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
                  gap="size-50"
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

export function SessionDetailsTraceList({
  tracesRef,
}: {
  tracesRef: SessionDetailsTraceList_traces$key;
}) {
  const { data, loadNext, isLoadingNext, hasNext } = usePaginationFragment(
    graphql`
      fragment SessionDetailsTraceList_traces on ProjectSession
      @refetchable(queryName: "SessionDetailsTraceListRefetchQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String", defaultValue: null }
      ) {
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
    tracesRef
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

  // Clear the selected trace id from the URL when leaving the session
  // details view so it does not leak into other pages. `setSearchParams`
  // from react-router is not referentially stable — stash the latest
  // setter in a ref so this cleanup only runs on true unmount.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  useEffect(() => {
    return () => {
      setSearchParamsRef.current(
        (params) => {
          params.delete(SELECTED_TRACE_ID_PARAM);
          return params;
        },
        { replace: true }
      );
    };
  }, []);

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
        <SessionTurnList
          rows={sessionRootSpans}
          selectedTraceId={selectedTraceId}
          onTurnClick={handleTurnClick}
        />
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
          {sessionRootSpans.map(({ traceId, rootSpan }, index) => (
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
              <View borderBottomColor="default" borderBottomWidth={"thin"}>
                <Flex direction={"row"}>
                  <View
                    borderRightWidth={"thin"}
                    borderEndColor="default"
                    padding="size-200"
                    flex={"1 1 auto"}
                  >
                    <RootSpanInputOutput rootSpan={rootSpan} />
                  </View>
                  <View width={350} padding="size-200" flex="none">
                    <RootSpanDetails
                      traceId={traceId}
                      rootSpan={rootSpan}
                      index={index}
                    />
                  </View>
                </Flex>
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
