import { Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { useLoaderData } from "react-router";
import { css } from "@emotion/react";

import { Flex, Heading, View } from "@phoenix/components";
import { ConnectedLastNTimeRangePicker } from "@phoenix/components/datetime";

import { DashboardBarChart } from "./DashboardBarChart";
import { DashboardPanel } from "./DashboardPanel";
import { projectDashboardLoader } from "./projectDashboardLoader";
const ResponsiveGridLayout = WidthProvider(Responsive);

const layouts: Layouts = {
  lg: [
    { i: "a", x: 0, y: 0, w: 12, h: 4 },
    { i: "b", x: 0, y: 4, w: 12, h: 4 },
  ],
};

export function ProjectDashboardPage() {
  const { project } = useLoaderData<typeof projectDashboardLoader>();
  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      `}
    >
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={1}>Dashboard: {project.name}</Heading>
          <ConnectedLastNTimeRangePicker />
        </Flex>
      </View>

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
        <div key="a">
          <DashboardPanel
            title="Trace Counts"
            subtitle="number of traces over time"
          >
            <DashboardBarChart />
          </DashboardPanel>
        </div>
        <div key="b">
          <DashboardPanel title="Grid Item B">
            <DashboardBarChart />
          </DashboardPanel>
        </div>
      </ResponsiveGridLayout>
    </main>
  );
}
