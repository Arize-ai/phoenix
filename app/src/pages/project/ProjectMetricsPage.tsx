import { forwardRef } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";

import { TraceCountTimeSeries } from "./TraceCountTimeSeries";

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
          <TraceCountTimeSeries />
        </MetricPanel>
        <MetricPanel title="Feedback scores" subtitle="Daily averages">
          {"Feedback scores chart goes here"}
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-100">
        <MetricPanel title="Duration" subtitle="Daily quantiles in seconds">
          {"Duration chart goes here"}
        </MetricPanel>

        <MetricPanel title="Token usage" subtitle="Daily totals">
          {"Token usage chart goes here"}
        </MetricPanel>
      </Flex>
      <Flex direction="row" gap="size-100">
        <MetricPanel title="Estimated cost" subtitle="Total daily cost in USD">
          {"Estimated cost chart goes here"}
        </MetricPanel>
      </Flex>
    </main>
  );
}
