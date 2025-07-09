import { useCallback, useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { isNumber, isString, throttle } from "lodash";
import { css } from "@emotion/react";

import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import {
  Flex,
  Icon,
  Icons,
  Link,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { JSONBlock } from "@phoenix/components/code";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanCumulativeTokenCount } from "@phoenix/components/trace/SpanCumulativeTokenCount";
import { TraceTokenCosts } from "@phoenix/components/trace/TraceTokenCosts";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  SessionDetailsTraceList_traces$data,
  SessionDetailsTraceList_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTraceList_traces.graphql";
import { MimeType } from "@phoenix/pages/trace/__generated__/SpanDetailsQuery.graphql";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

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
  mimeType,
}: {
  role: "HUMAN" | "AI";
  value: unknown;
  mimeType?: MimeType | null;
}) {
  const valueString = useMemo(() => {
    if (mimeType !== "json") {
      return String(value);
    }
    const parsed = safelyParseJSON(value as string);
    if (parsed.json == null) {
      return "--";
    }
    return JSON.stringify(parsed.json, null, 2);
  }, [value, mimeType]);
  const styles = useChatMessageStyles(role === "HUMAN" ? "user" : "assistant");
  return (
    <View
      alignSelf={role === "HUMAN" ? "start" : "end"}
      borderRadius={"medium"}
      borderColor={"dark"}
      borderWidth={"thin"}
      padding="size-200"
      maxWidth={"70%"}
      {...styles}
    >
      <Flex direction={"column"} gap={"size-50"}>
        <Text color="text-700">{role}</Text>
        {mimeType === "json" ? (
          <JSONBlock value={valueString} />
        ) : (
          <Text>{valueString}</Text>
        )}
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
      <RootSpanMessage
        role={"HUMAN"}
        value={rootSpan.input?.value}
        mimeType={rootSpan.input?.mimeType}
      />
      <RootSpanMessage
        role={"AI"}
        value={rootSpan.output?.value}
        mimeType={rootSpan.output?.mimeType}
      />
    </Flex>
  );
}

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

  return (
    <div
      css={css`
        height: 100%;
        flex: 1 1 auto;
        overflow: auto;
      `}
      onScroll={(e) =>
        debouncedFetchMoreOnBottomReached(e.target as HTMLDivElement)
      }
    >
      {sessionRootSpans.map(({ traceId, rootSpan }, index) => (
        <View
          borderBottomColor={"dark"}
          borderBottomWidth={"thin"}
          key={rootSpan.spanId}
        >
          <Flex direction={"row"}>
            <View
              borderRightWidth={"thin"}
              borderEndColor={"dark"}
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
      ))}
      {isLoadingNext && (
        <View
          borderBottomColor={"dark"}
          borderBottomWidth={"thin"}
          padding="size-200"
        >
          <Loading />
        </View>
      )}
    </div>
  );
}
