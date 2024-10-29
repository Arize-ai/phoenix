import React, { useMemo } from "react";

import { Flex, Icon, Icons, Text, View } from "@arizeai/components";

import { Link } from "@phoenix/components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { SessionDetailsQuery$data } from "./__generated__/SessionDetailsQuery.graphql";
import { EditSpanAnnotationsButton } from "./EditSpanAnnotationsButton";

function RootSpanMessage({
  role,
  value,
}: {
  role: "HUMAN" | "AI";
  value: string;
}) {
  return (
    <View
      alignSelf={role === "HUMAN" ? "start" : "end"}
      borderRadius={"medium"}
      borderColor={"dark"}
      borderWidth={"thin"}
      padding={"size-100"}
      maxWidth={"70%"}
    >
      <Flex direction={"column"} gap={"size-100"}>
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
  user,
}: RootSpanProps & { user?: string | null }) {
  const startDate = useMemo(() => {
    return new Date(rootSpan.startTime);
  }, [rootSpan.startTime]);
  return (
    <View height={"100%"}>
      <Flex
        direction={"column"}
        justifyContent={"space-between"}
        height={"100%"}
      >
        <Flex direction={"column"} gap={"size-200"}>
          <Flex direction={"row"} justifyContent={"space-between"}>
            <Text>Trace ID: {rootSpan.context.traceId}</Text>
            <Link
              to={`/projects/${rootSpan.project.id}/traces/${rootSpan.context.traceId}`}
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
        <Flex direction={"row"} justifyContent={"space-between"}>
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
  user,
}: {
  traces: SessionDetailsQuery$data["session"]["traces"];
  user?: string | null;
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
      {sessionRootSpans.map((rootSpan) => (
        <View
          borderBottomColor={"dark"}
          borderBottomWidth={"thin"}
          key={rootSpan.context.spanId}
        >
          <Flex direction={"row"}>
            <View
              width={"67%"}
              borderRightWidth={"thin"}
              borderEndColor={"dark"}
              padding={"size-200"}
            >
              <RootSpanInputOutput rootSpan={rootSpan} />
            </View>
            <View width={"33%"} padding={"size-200"}>
              <RootSpanDetails rootSpan={rootSpan} user={user} />
            </View>
          </Flex>
        </View>
      ))}
    </View>
  );
}
