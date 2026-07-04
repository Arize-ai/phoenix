import { css } from "@emotion/react";
import React, { Suspense } from "react";

import { Flex, Heading, Loading, Text, View } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";

const DEFAULT_CHART_HEIGHT = 190;

interface MetricPanelHeaderProps {
  title: string;
  subtitle?: string;
}

function MetricPanelHeader({ title, subtitle }: MetricPanelHeaderProps) {
  return (
    <div
      css={css`
        padding: var(--global-dimension-size-100)
          var(--global-dimension-size-200) 0 var(--global-dimension-size-200);

        display: flex;
        flex-direction: row;
        gap: var(--global-dimension-size-100);
      `}
      className="dashboard-panel-header"
    >
      <Flex direction="column">
        <Heading>{title}</Heading>
        {subtitle && (
          <Text size="XS" color="gray-600">
            {subtitle}
          </Text>
        )}
      </Flex>
    </div>
  );
}

interface MetricPanelProps extends MetricPanelHeaderProps {
  children: React.ReactNode;
  /**
   * The height of the chart area in pixels, or "fill" to stretch the chart
   * area to the panel's available height (e.g. inside a resizable panel)
   * @default 190
   */
  chartHeight?: number | "fill";
  ref?: React.Ref<HTMLDivElement>;
}

export function MetricPanel({
  ref,
  title,
  subtitle,
  chartHeight = DEFAULT_CHART_HEIGHT,
  children,
}: MetricPanelProps) {
  return (
    <View
      borderWidth="thin"
      borderColor="gray-200"
      borderRadius="medium"
      height="100%"
      width="100%"
      data-testid={`dashboard-panel`}
      backgroundColor="gray-75"
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
            min-height: 0;
            padding: var(--global-dimension-size-200);
            /* Let hover UI (e.g. tall chart tooltips) escape the panel
               instead of being clipped at the chart height */
            overflow: visible;
            .recharts-responsive-container,
            .recharts-wrapper {
              overflow: visible !important;
            }
          `}
          style={chartHeight === "fill" ? undefined : { height: chartHeight }}
        >
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </View>
  );
}
