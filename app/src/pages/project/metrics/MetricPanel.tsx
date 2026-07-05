import { css } from "@emotion/react";
import React, { Suspense } from "react";

import { Heading, Loading, Text } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";

const DEFAULT_CHART_HEIGHT = 190;

/**
 * Below this panel height the subtitle is dropped so the chart keeps the
 * space; the title alone still identifies the metric.
 */
const COMPACT_HEIGHT_BREAKPOINT = "200px";

const metricPanelCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  border: var(--global-border-size-thin) solid var(--chart-panel-border-color);
  border-radius: var(--global-rounding-medium);
  background-color: var(--chart-panel-background-color);

  .metric-panel__header {
    flex: none;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0
      var(--global-dimension-size-150);
  }

  .metric-panel__title,
  .metric-panel__subtitle {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .metric-panel__chart {
    flex: 1 1 auto;
    min-height: 0;
    /* Share the header's horizontal gutter so the chart's left edge (y-axis
       labels) and right edge line up with the title */
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    /* Let hover UI (e.g. tall chart tooltips) escape the panel
       instead of being clipped at the chart height */
    overflow: visible;
    .recharts-responsive-container,
    .recharts-wrapper {
      overflow: visible !important;
    }
  }
`;

/**
 * In a fill-height context (the resizable charts strip) the panel's size is
 * imposed by its parent, so it can be a size query container and shed the
 * subtitle as it gets short.
 */
const fillHeightPanelCSS = css`
  container-type: size;

  @container (max-height: ${COMPACT_HEIGHT_BREAKPOINT}) {
    .metric-panel__subtitle {
      display: none;
    }
  }
`;

interface MetricPanelHeaderProps {
  title: string;
  subtitle?: string;
}

function MetricPanelHeader({ title, subtitle }: MetricPanelHeaderProps) {
  return (
    <div className="metric-panel__header">
      <Heading
        level={4}
        weight="heavy"
        className="metric-panel__title"
        title={title}
      >
        {title}
      </Heading>
      {subtitle && (
        <Text
          size="XS"
          color="gray-600"
          className="metric-panel__subtitle"
          title={subtitle}
        >
          {subtitle}
        </Text>
      )}
    </div>
  );
}

interface MetricPanelProps extends MetricPanelHeaderProps {
  children: React.ReactNode;
  /**
   * Stretch the chart area to the panel's available height (e.g. inside a
   * resizable panel) instead of the fixed default height
   */
  fillHeight?: boolean;
}

export function MetricPanel({
  title,
  subtitle,
  fillHeight = false,
  children,
}: MetricPanelProps) {
  return (
    <section
      css={[metricPanelCSS, fillHeight && fillHeightPanelCSS]}
      className="metric-panel"
      data-testid="metric-panel"
    >
      <MetricPanelHeader title={title} subtitle={subtitle} />
      <div
        className="metric-panel__chart"
        style={fillHeight ? undefined : { height: DEFAULT_CHART_HEIGHT }}
      >
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ErrorBoundary>
      </div>
    </section>
  );
}
