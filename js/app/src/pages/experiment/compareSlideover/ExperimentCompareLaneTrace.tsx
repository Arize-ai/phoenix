import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import { Flex, LinkButton, TitleWithID, View } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import { HotkeysEnabledProvider } from "@phoenix/contexts";
import { TraceDetailsSkeleton, TraceDetailsView } from "@phoenix/pages/trace";

import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import type { CompareLane } from "./experimentCompareLaneTypes";
import { useCompareLaneRun } from "./useExperimentCompareLaneRunGroup";

const laneTraceCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

function LaneTraceDetails({
  traceId,
  projectId,
  layoutId,
  isActive,
}: {
  traceId: string;
  projectId: string;
  layoutId: string;
  /** Whether this lane's trace shortcuts respond */
  isActive: boolean;
}) {
  const [selectedSpanNodeId, setSelectedSpanNodeId] = useState<string | null>(
    null
  );
  return (
    <div css={laneTraceCSS}>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <TitleWithID title="Trace" id={traceId} />
          <LinkButton
            size="S"
            to={`/projects/${projectId}/traces/${encodeURIComponent(traceId)}`}
          >
            View Trace in Project
          </LinkButton>
        </Flex>
      </View>
      <ErrorBoundary>
        <Suspense fallback={<TraceDetailsSkeleton layoutId={layoutId} />}>
          <HotkeysEnabledProvider isEnabled={isActive}>
            <TraceDetailsView
              traceId={traceId}
              projectId={projectId}
              selectedSpanNodeId={selectedSpanNodeId}
              onSpanSelectionChange={setSelectedSpanNodeId}
              layoutId={layoutId}
            />
          </HotkeysEnabledProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/**
 * A lane in Traces mode: the shown run's trace, with its own span selection.
 */
export function ExperimentCompareLaneTrace({
  exampleId,
  lane,
  isActive,
}: {
  exampleId: string;
  lane: CompareLane;
  /** Whether this lane is the one keyboard shortcuts act on */
  isActive: boolean;
}) {
  const { runState, shownRun } = useCompareLaneRun({ exampleId, lane });
  const trace = shownRun?.trace;
  if (trace == null) {
    return (
      <View padding="size-100">
        <ExperimentCompareLaneEmpty
          message={
            runState.type === "no-runs"
              ? "No run for this example"
              : "No trace for this run"
          }
        />
      </View>
    );
  }
  return (
    <LaneTraceDetails
      key={trace.traceId}
      traceId={trace.traceId}
      projectId={trace.projectId}
      layoutId={`experiment-compare-${lane.side}-lane-trace-layout`}
      isActive={isActive}
    />
  );
}
