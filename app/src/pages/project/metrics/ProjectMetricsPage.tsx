import { forwardRef, memo, Suspense, useMemo, useRef } from "react";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Loading,
  Text,
  useTimeRange,
  View,
} from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";
import { TopModelsByCost } from "@phoenix/pages/project/metrics/TopModelsByCost";
import { TopModelsByToken } from "@phoenix/pages/project/metrics/TopModelsByToken";
import { TraceErrorsTimeSeries } from "@phoenix/pages/project/metrics/TraceErrorsTimeSeries";

import { LLMSpanCountTimeSeries } from "./LLMSpanCountTimeSeries";
import { LLMSpanErrorsTimeSeries } from "./LLMSpanErrorsTimeSeries";
import { SpanAnnotationScoreTimeSeries } from "./SpanAnnotationScoreTimeSeries";
import { ToolSpanCountTimeSeries } from "./ToolSpanCountTimeSeries";
import { ToolSpanErrorsTimeSeries } from "./ToolSpanErrorsTimeSeries";
import { TraceCountTimeSeries } from "./TraceCountTimeSeries";
import { TraceLatencyPercentilesTimeSeries } from "./TraceLatencyPercentilesTimeSeries";
import { TraceTokenCostTimeSeries } from "./TraceTokenCostTimeSeries";
import { TraceTokenCountTimeSeries } from "./TraceTokenCountTimeSeries";

interface MetricPanelHeaderProps {
  title: string;
  subtitle?: string;
}

function MetricPanelHeader({ title, subtitle }: MetricPanelHeaderProps) {
  return (
    <div
      css={css`
        padding: var(--ac-global-dimension-size-100)
          var(--ac-global-dimension-size-200) 0
          var(--ac-global-dimension-size-200);

        display: flex;
        flex-direction: row;
        gap: var(--ac-global-dimension-size-100);
      `}
      className="dashboard-panel-header"
    >
      <Flex direction="column">
        <Heading>{title}</Heading>
        {subtitle && (
          <Text size="XS" color="grey-600">
            {subtitle}
          </Text>
        )}
      </Flex>
    </div>
  );
}

interface MetricPanelProps extends MetricPanelHeaderProps {
  children: React.ReactNode;
}

export const MetricPanel = forwardRef(function MetricPanel(
  { title, subtitle, children }: MetricPanelProps,
  ref: React.Ref<HTMLDivElement>
) {
  return (
    <View
      borderWidth="thin"
      borderColor="grey-200"
      borderRadius="medium"
      height="100%"
      width="100%"
      data-testid={`dashboard-panel`}
      backgroundColor="grey-75"
      ref={ref}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        <MetricPanelHeader title={title} subtitle={subtitle} />
        <div
          css={css`
            flex: 1 1 auto;
            padding: var(--ac-global-dimension-size-200);
            height: 190px;
            overflow: auto;
          `}
        >
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </View>
  );
});

type EpochTimeRange = {
  start: number;
  end: number;
};

/**
 * Hook that converts an open time range from context into a closed time range.
 * If the time range is already closed, it returns it as-is.
 * If it's open, it fills in missing start/end values based on a frozen "now" timestamp.
 *
 * The "now" timestamp is frozen and only updates when the context time range actually changes,
 * preventing unnecessary recalculations on every render.
 */
function useClosedTimeRange(): EpochTimeRange {
  const { timeRange: contextTimeRange } = useTimeRange();

  // Extract and memoize timestamps to get stable primitive values
  const startMs = useMemo(
    () => (contextTimeRange.start ? contextTimeRange.start.getTime() : null),
    [contextTimeRange.start]
  );
  const endMs = useMemo(
    () => (contextTimeRange.end ? contextTimeRange.end.getTime() : null),
    [contextTimeRange.end]
  );

  // Use a ref to freeze "now" until the context time range actually changes
  const lastTimestampsRef = useRef({ startMs, endMs });
  const frozenNowMsRef = useRef<number>(Date.now());

  // Only update frozen "now" when timestamps actually change
  if (
    lastTimestampsRef.current.startMs !== startMs ||
    lastTimestampsRef.current.endMs !== endMs
  ) {
    lastTimestampsRef.current = { startMs, endMs };
    frozenNowMsRef.current = Date.now();
  }

  const frozenNowMs = frozenNowMsRef.current;

  const epochTimeRange = useMemo<EpochTimeRange>(() => {
    let start = startMs;
    let end = endMs;
    if (start !== null && end !== null) {
      // closed range from context
      return { start, end };
    } else if (start === null && end !== null) {
      return { start: end - ONE_MONTH_MS, end };
    } else if (start !== null && end === null) {
      // If start is in the past, close at "now"; else, one month after start
      end = start < frozenNowMs ? frozenNowMs : start + ONE_MONTH_MS;
      return { start, end };
    } else {
      // both null → last month to now
      end = frozenNowMs;
      start = end - ONE_MONTH_MS;
      return { start, end };
    }
  }, [startMs, endMs, frozenNowMs]);

  return epochTimeRange;
}

export function ProjectMetricsPage() {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const epochTimeRange = useClosedTimeRange();

  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
      `}
    >
      <MetricPanels projectId={projectId} epochTimeRange={epochTimeRange} />
    </main>
  );
}
const MetricPanels = memo(function MetricPanels({
  projectId,
  epochTimeRange,
}: {
  projectId: string;
  epochTimeRange: EpochTimeRange;
}) {
  const timeRange = useMemo(
    () => ({
      start: new Date(epochTimeRange.start),
      end: new Date(epochTimeRange.end),
    }),
    [epochTimeRange]
  );
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-200);
        padding: var(--ac-global-dimension-size-200);
      `}
    >
      <Flex direction="row" gap="size-200">
        <MetricPanel
          title="Traces over time"
          subtitle="Overall volume of traces"
        >
          <TraceCountTimeSeries projectId={projectId} timeRange={timeRange} />
        </MetricPanel>
        <MetricPanel
          title="Traces with errors"
          subtitle="Overall volume of traces with errors"
        >
          <TraceErrorsTimeSeries projectId={projectId} timeRange={timeRange} />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-200">
        <MetricPanel title="Trace Latency" subtitle="Latency percentiles">
          <TraceLatencyPercentilesTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
        <MetricPanel
          title="Annotation scores"
          subtitle="Average annotation scores"
        >
          <SpanAnnotationScoreTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-200">
        <MetricPanel title="Cost" subtitle="Estimated cost in USD">
          <TraceTokenCostTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
        <MetricPanel title="Top models by cost">
          <TopModelsByCost projectId={projectId} timeRange={timeRange} />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-200">
        <MetricPanel
          title="Token usage"
          subtitle="Token usage by prompt and completion"
        >
          <TraceTokenCountTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
        <MetricPanel title="Top models by tokens">
          <TopModelsByToken projectId={projectId} timeRange={timeRange} />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-200">
        <MetricPanel title="LLM spans" subtitle="LLM span count over time">
          <LLMSpanCountTimeSeries projectId={projectId} timeRange={timeRange} />
        </MetricPanel>
        <MetricPanel
          title="LLM spans with errors"
          subtitle="LLM spans with errors over time"
        >
          <LLMSpanErrorsTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-200">
        <MetricPanel title="Tool spans" subtitle="Tool span count over time">
          <ToolSpanCountTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
        <MetricPanel
          title="Tool spans with errors"
          subtitle="Tool spans with errors over time"
        >
          <ToolSpanErrorsTimeSeries
            projectId={projectId}
            timeRange={timeRange}
          />
        </MetricPanel>
      </Flex>
    </div>
  );
});
