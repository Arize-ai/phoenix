import { Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { css } from "@emotion/react";

const ResponsiveGridLayout = WidthProvider(Responsive);

const layouts: Layouts = {
  lg: [
    { i: "feedback", x: 0, y: 0, w: 6, h: 4 },
    { i: "traces", x: 6, y: 0, w: 6, h: 4 },
    { i: "duration", x: 0, y: 4, w: 6, h: 4 },
    { i: "tokens", x: 6, y: 4, w: 6, h: 4 },
    { i: "cost", x: 0, y: 8, w: 12, h: 4 },
  ],
};

import { forwardRef } from "react";

import { Heading, Text, View } from "@phoenix/components";

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
        border-bottom: 1px solid var(--ac-global-color-grey-200);
        display: flex;
        flex-direction: row;
        gap: var(--ac-global-dimension-size-100);
      `}
      className="dashboard-panel-header"
    >
      <Heading>{title}</Heading>
      {subtitle && <Text>{subtitle}</Text>}
    </div>
  );
}

interface MetricPanelProps extends MetricPanelHeaderProps {
  children: React.ReactNode;
}

export const MetricPanel = forwardRef(function MetricPanel(
  { title, children }: MetricPanelProps,
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
      <MetricPanelHeader title={title} />
      {children}
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
      `}
    >
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        containerPadding={[16, 16]}
        isResizable={false}
        isDraggable={false}
        draggableHandle=".dashboard-panel-header"
      >
        <div key="feedback">
          <MetricPanel title="Feedback scores" subtitle="Daily averages">
            {"Feedback scores chart goes here"}
          </MetricPanel>
        </div>
        <div key="traces">
          <MetricPanel title="Number of traces" subtitle="Daily totals">
            {"Number of traces chart goes here"}
          </MetricPanel>
        </div>
        <div key="duration">
          <MetricPanel title="Duration" subtitle="Daily quantiles in seconds">
            {"Duration chart goes here"}
          </MetricPanel>
        </div>
        <div key="tokens">
          <MetricPanel title="Token usage" subtitle="Daily totals">
            {"Token usage chart goes here"}
          </MetricPanel>
        </div>
        <div key="cost">
          <MetricPanel
            title="Estimated cost"
            subtitle="Total daily cost in USD"
          >
            {"Estimated cost chart goes here"}
          </MetricPanel>
        </div>
      </ResponsiveGridLayout>
    </main>
  );
}
