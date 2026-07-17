import { css } from "@emotion/react";
import React, { Suspense } from "react";

import type { HeadingProps } from "@phoenix/components";
import { Heading, Loading, Text } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";

const DEFAULT_CHART_HEIGHT = 190;

/**
 * Below this panel height the subtitle is dropped so the chart keeps the
 * space; the title alone still identifies the chart.
 */
const COMPACT_HEIGHT_BREAKPOINT = "200px";

const chartPanelCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  --chart-panel-tooltip-z-index: 1;
  border: var(--global-border-size-thin) solid var(--chart-panel-border-color);
  border-radius: var(--global-rounding-medium);
  background-color: var(--chart-panel-background-color);

  &:hover,
  &:focus-within {
    /* Lift only the active tooltip above synchronized sibling tooltips. */
    --chart-panel-tooltip-z-index: 2;
  }

  .chart-panel__header {
    flex: none;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0
      var(--global-dimension-size-150);
  }

  .chart-panel__header-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .chart-panel__header-actions {
    flex: none;
  }

  .chart-panel__title,
  .chart-panel__subtitle {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chart-panel__title.heading {
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chart-panel__chart {
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
 * In a fill-height context (e.g. a resizable charts strip or panel) the panel's
 * size is imposed by its parent, so it can be a size query container and shed
 * the subtitle as it gets short.
 */
const fillHeightPanelCSS = css`
  container-type: size;

  @container (max-height: ${COMPACT_HEIGHT_BREAKPOINT}) {
    .chart-panel__subtitle {
      display: none;
    }
  }
`;

interface ChartPanelHeaderProps {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  /**
   * Semantic heading level for the chart title. The visual size remains
   * consistent with the compact chart panel title treatment.
   * @default 4
   */
  headingLevel?: HeadingProps["level"];
}

function ChartPanelHeader({
  title,
  subtitle,
  headerActions,
  headingLevel = 4,
}: ChartPanelHeaderProps) {
  return (
    <div className="chart-panel__header">
      <div className="chart-panel__header-content">
        <Heading
          level={headingLevel}
          weight="heavy"
          className="chart-panel__title"
          title={title}
        >
          {title}
        </Heading>
        {subtitle && (
          <Text
            size="XS"
            color="gray-600"
            className="chart-panel__subtitle"
            title={subtitle}
          >
            {subtitle}
          </Text>
        )}
      </div>
      {headerActions && (
        <div className="chart-panel__header-actions">{headerActions}</div>
      )}
    </div>
  );
}

interface ChartPanelProps extends ChartPanelHeaderProps {
  children: React.ReactNode;
  /**
   * Stretch the chart area to the panel's available height (e.g. inside a
   * resizable panel) instead of the fixed default height
   */
  fillHeight?: boolean;
}

/**
 * A titled container for a single chart, rendering a header (title + optional
 * subtitle) above a bordered chart surface. The chart is wrapped in an error
 * boundary and suspense boundary so an individual chart can fail or load
 * independently. Used across the project metrics page, the metric charts strip
 * above tables, and the experiments analysis view so charts read consistently
 * wherever they appear.
 */
export function ChartPanel({
  title,
  subtitle,
  headerActions,
  headingLevel,
  fillHeight = false,
  children,
}: ChartPanelProps) {
  return (
    <section
      css={[chartPanelCSS, fillHeight && fillHeightPanelCSS]}
      className="chart-panel"
      data-testid="chart-panel"
    >
      <ChartPanelHeader
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
        headingLevel={headingLevel}
      />
      <div
        className="chart-panel__chart"
        style={fillHeight ? undefined : { height: DEFAULT_CHART_HEIGHT }}
      >
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ErrorBoundary>
      </div>
    </section>
  );
}
