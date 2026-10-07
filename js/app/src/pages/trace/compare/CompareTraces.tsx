import { css } from "@emotion/react";
import { Fragment, Suspense, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import type { To } from "react-router";

import {
  Flex,
  LinkButton,
  Loading,
  TitleWithID,
  View,
} from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { HotkeysEnabledProvider } from "@phoenix/contexts";
import type { TraceSelectionSlot } from "@phoenix/utils/traceSelectionUtils";

import { TraceDetailsView } from "../TraceDetails";

export type CompareTracesProps = {
  /** The Relay node ID of the project the traces belong to */
  projectId: string;
  /** The traces to show side by side, in display order (left to right) */
  traces: TraceSelectionSlot[];
  /** Where each trace's **View Trace** link goes, given the trace */
  getTraceDetailsTo: (trace: TraceSelectionSlot) => To;
  /**
   * Called when the user picks a span in one of the compared traces, with the
   * position of that trace in `traces` and the span's Relay node ID.
   */
  onSpanSelectionChange: (traceIndex: number, spanNodeId: string) => void;
};

/**
 * Shows several traces side by side, each with its own trace tree and span
 * details, so their trajectories can be compared.
 */
export function CompareTraces({
  projectId,
  traces,
  getTraceDetailsTo,
  onSpanSelectionChange,
}: CompareTracesProps) {
  // Keyboard shortcuts target only the pane the user last worked in
  const [activeTraceIndex, setActiveTraceIndex] = useState(0);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "compare-traces-layout",
    storage: localStorage,
  });
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
      {traces.map((trace, index) => (
        <Fragment key={`${index}-${trace.traceId}`}>
          {index > 0 ? <Separator css={compactResizeHandleCSS} /> : null}
          <Panel id={`compare-trace-${index}`} minSize="20%">
            <CompareTracePane
              projectId={projectId}
              trace={trace}
              index={index}
              traceDetailsTo={getTraceDetailsTo(trace)}
              isActive={index === activeTraceIndex}
              onActivate={() => setActiveTraceIndex(index)}
              onSpanSelectionChange={(spanNodeId) =>
                onSpanSelectionChange(index, spanNodeId)
              }
            />
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}

function CompareTracePane({
  projectId,
  trace: { traceId, selectedSpanNodeId },
  index,
  traceDetailsTo,
  isActive,
  onActivate,
  onSpanSelectionChange,
}: {
  projectId: string;
  trace: TraceSelectionSlot;
  index: number;
  traceDetailsTo: To;
  isActive: boolean;
  onActivate: () => void;
  onSpanSelectionChange: (spanNodeId: string) => void;
}) {
  return (
    <section
      data-testid="compare-trace-pane"
      aria-label={`Trace ${traceId}`}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `}
    >
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
          <LinkButton size="S" to={traceDetailsTo}>
            View Trace
          </LinkButton>
        </Flex>
      </View>
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <HotkeysEnabledProvider isEnabled={isActive}>
            <TraceDetailsView
              traceId={traceId}
              projectId={projectId}
              selectedSpanNodeId={selectedSpanNodeId}
              onSpanSelectionChange={onSpanSelectionChange}
              layoutId={`compare-trace-${index}-layout`}
            />
          </HotkeysEnabledProvider>
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}
