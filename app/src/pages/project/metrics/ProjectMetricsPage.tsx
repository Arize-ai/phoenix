import { forwardRef, Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import {
  Alert,
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
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

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

export function ProjectMetricsPage() {
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const { timeRange: contextTimeRange } = useTimeRange();
  const isOpenTimeRange =
    contextTimeRange.start === null || contextTimeRange.end === null;

  const timeRange = useMemo<TimeRange>(() => {
    const start = contextTimeRange.start;
    const end = contextTimeRange.end;

    if (start && end) {
      return { start, end };
    } else if (!start && end) {
      return { start: new Date(end.getTime() - ONE_MONTH_MS), end };
    } else if (start && !end) {
      return { start, end: new Date() };
    } else if (!start && !end) {
      return { start: new Date(Date.now() - ONE_MONTH_MS), end: new Date() };
    } else {
      throw new Error(
        `Invalid time range: ${JSON.stringify(contextTimeRange)}`
      );
    }
  }, [contextTimeRange]);
  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
      `}
    >
      {isOpenTimeRange && (
        <Alert variant="info" banner title="Time Range Adjusted">
          {`This view does not support open-ended time ranges. Your time range has
          been set to ${fullTimeFormatter(timeRange.start)} to ${fullTimeFormatter(timeRange.end)}`}
        </Alert>
      )}
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
            <TraceErrorsTimeSeries
              projectId={projectId}
              timeRange={timeRange}
            />
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
            <LLMSpanCountTimeSeries
              projectId={projectId}
              timeRange={timeRange}
            />
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
    </main>
  );
}
