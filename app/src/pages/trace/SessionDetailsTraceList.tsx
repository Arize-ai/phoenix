import React, { useMemo } from "react";
import { isNumber, isString } from "lodash";

import { Flex, Icon, Icons, Text, View } from "@arizeai/components";
import {
  SemanticAttributePrefixes,
  UserAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";

import { Link } from "@phoenix/components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { SessionDetailsQuery$data } from "./__generated__/SessionDetailsQuery.graphql";
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
  value: string;
}) {
  const styles = useChatMessageStyles(role === "HUMAN" ? "user" : "assistant");
  return (
    <View
      alignSelf={role === "HUMAN" ? "start" : "end"}
      borderRadius={"medium"}
      borderColor={"dark"}
      borderWidth={"thin"}
      padding={"size-200"}
      maxWidth={"70%"}
      {...styles}
    >
      <Flex direction={"column"} gap={"size-50"}>
        <Text color="text-700" textSize="medium">
          {role}
        </Text>
        <Text>{value}</Text>
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
  rootSpan,
  index,
}: RootSpanProps & { index: number }) {
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
        <Flex direction={"column"} gap={"size-200"}>
          <Flex direction={"row"} justifyContent={"space-between"}>
            <Text>Trace #{index + 1}</Text>
            <Link
              to={`/projects/${rootSpan.project.id}/traces/${rootSpan.context.traceId}?selectedSpanNodeId=${rootSpan.id}`}
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
            <Text textSize="medium">Feedback</Text>
            <Flex gap={"size-50"} direction={"column"}>
              {rootSpan.spanAnnotations.length > 0
                ? rootSpan.spanAnnotations.map((annotation) => (
                    <AnnotationTooltip
                      key={annotation.name}
                      annotation={annotation}
                    >
                      <AnnotationLabel
                        annotation={annotation}
                        annotationDisplayPreference="label"
                      />
                    </AnnotationTooltip>
                  ))
                : "--"}
            </Flex>
          </Flex>
          <span>
            <EditSpanAnnotationsButton
              size={"compact"}
              spanNodeId={rootSpan.id}
              projectId={rootSpan.project.id}
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
      <RootSpanMessage role={"HUMAN"} value={rootSpan.input?.value ?? "--"} />
      <RootSpanMessage role={"AI"} value={rootSpan.output?.value ?? "--"} />
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
      .map(({ trace }) => trace.rootSpan)
      .filter(
        (rootSpan): rootSpan is NonNullable<typeof rootSpan> => rootSpan != null
      );
  }, [traces]);

  return (
    <View height={"100%"} flex={"1 1 auto"} overflow={"auto"}>
      {sessionRootSpans.map((rootSpan, index) => (
        <View
          borderBottomColor={"dark"}
          borderBottomWidth={"thin"}
          key={rootSpan.context.spanId}
        >
          <Flex direction={"row"}>
            <View
              borderRightWidth={"thin"}
              borderEndColor={"dark"}
              padding={"size-200"}
              flex={"1 1 auto"}
            >
              <RootSpanInputOutput rootSpan={rootSpan} />
            </View>
            <View width={350} padding={"size-200"} flex="none">
              <RootSpanDetails rootSpan={rootSpan} index={index} />
            </View>
          </Flex>
        </View>
      ))}
    </View>
  );
}
