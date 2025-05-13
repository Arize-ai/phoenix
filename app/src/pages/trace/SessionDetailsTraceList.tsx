import { useMemo } from "react";
import { isNumber, isString } from "lodash";

import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import { Flex, Icon, Icons, Link, Text, View } from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { JSONBlock } from "@phoenix/components/code";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import {
  MimeType,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
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
    SessionDetailsQuery$data["session"]["traces"]
  >["edges"][number]["trace"]["rootSpan"]
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
            <TokenCount
              tokenCountTotal={rootSpan.cumulativeTokenCountTotal ?? 0}
              tokenCountCompletion={
                rootSpan.cumulativeTokenCountCompletion ?? 0
              }
              tokenCountPrompt={rootSpan.cumulativeTokenCountPrompt ?? 0}
            />
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
  traces,
}: {
  traces: SessionDetailsQuery$data["session"]["traces"];
}) {
  const sessionRootSpans = useMemo(() => {
    const edges = traces?.edges || [];
    return edges
      .map(({ trace }) => trace)
      .filter(
        (
          trace
        ): trace is typeof trace & {
          rootSpan: NonNullable<typeof trace.rootSpan>;
        } => trace.rootSpan !== null
      );
  }, [traces]);

  return (
    <View height={"100%"} flex={"1 1 auto"} overflow={"auto"}>
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
    </View>
  );
}
