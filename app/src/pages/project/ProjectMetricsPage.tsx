import { forwardRef } from "react";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { TraceErrorsTimeSeries } from "@phoenix/pages/project/TraceErrorsTimeSeries";

import { SpanAnnotationScoreTimeSeries } from "./SpanAnnotationScoreTimeSeries";
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
      borderColor="dark"
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

            height: 200px;
          `}
        >
          {children}
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
  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-100);
        padding: var(--ac-global-dimension-size-100);
      `}
    >
      <Flex direction="row" gap="size-100">
        <MetricPanel
          title="Traces over time"
          subtitle="Overall volume of traces"
        >
          <TraceCountTimeSeries projectId={projectId} />
        </MetricPanel>
        <MetricPanel
          title="Traces with errors"
          subtitle="Overall volume of traces with errors"
        >
          <TraceErrorsTimeSeries projectId={projectId} />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-100">
        <MetricPanel title="Latency" subtitle="Latency percentiles">
          <TraceLatencyPercentilesTimeSeries projectId={projectId} />
        </MetricPanel>
        <MetricPanel
          title="Token usage"
          subtitle="Token usage by prompt and completion"
        >
          <TraceTokenCountTimeSeries projectId={projectId} />
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-100">
        <MetricPanel title="Cost" subtitle="Estimated cost in USD">
          <TraceTokenCostTimeSeries projectId={projectId} />
        </MetricPanel>
        <MetricPanel title="Feedback scores" subtitle="Average feedback scores">
          <SpanAnnotationScoreTimeSeries projectId={projectId} />
        </MetricPanel>
      </Flex>
    </main>
  );
}
